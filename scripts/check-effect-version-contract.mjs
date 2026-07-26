import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { validateEffectPackageVersions } from "./lib/effect-version-contract.mjs";

const workspaceRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const read = relativePath =>
  readFileSync(path.join(workspaceRoot, relativePath), "utf8");
const contract = JSON.parse(read("config/effect-baseline.json"));
const requiredDocuments = [
  "MIGRATION.md",
  "docs/adr/0003-effect-native-plugin-api.md",
  "docs/adr/0008-effect-v3-baseline.md",
  "docs/plugin-authoring.md",
  "packages/gen/README.md",
];
const failures = [];
const skillRoot = path.join(workspaceRoot, ".agents", "skills", "effect-ts");

const collectSkillFiles = directory =>
  readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    if (entry.name === ".git" || entry.name === "node_modules") {
      return [];
    }
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? collectSkillFiles(target) : [target];
  });

for (const document of requiredDocuments) {
  const content = read(document);
  if (!content.includes(contract.runtimeVersion)) {
    failures.push(
      `${document} does not state Effect ${contract.runtimeVersion}`
    );
  }
  if (!content.includes(contract.peerRange)) {
    failures.push(
      `${document} does not state peer range ${contract.peerRange}`
    );
  }
}

const workspaceConfig = read("pnpm-workspace.yaml");
if (!workspaceConfig.includes(`effect: "${contract.peerRange}"`)) {
  failures.push("pnpm-workspace.yaml does not match the Effect peer contract");
}

const rootPackage = JSON.parse(read("package.json"));
if (
  rootPackage.devDependencies["@effect/language-service"] !==
  contract.languageServiceVersion
) {
  failures.push(
    "package.json does not exactly pin the contracted Effect language service"
  );
}

const lockfile = read("pnpm-lock.yaml");
const resolvedEffectVersions = new Set(
  Array.from(lockfile.matchAll(/^  effect@([^:]+):$/gm), match => match[1])
);
if (
  resolvedEffectVersions.size !== 1 ||
  !resolvedEffectVersions.has(contract.runtimeVersion)
) {
  failures.push(
    `pnpm-lock.yaml resolves unexpected Effect versions: ${Array.from(resolvedEffectVersions).join(", ")}`
  );
}
if (
  !lockfile.includes(
    `  '@effect/language-service@${contract.languageServiceVersion}':`
  )
) {
  failures.push(
    "pnpm-lock.yaml does not resolve the contracted language service"
  );
}

const skill = read(".agents/skills/effect-ts/SKILL.md");
const skillSetup = read(".agents/skills/effect-ts/references/setup.md");
for (const expected of [
  contract.runtimeVersion,
  contract.peerRange,
  contract.referenceRepository,
  contract.referenceTag,
  contract.referenceCommit,
]) {
  if (!`${skill}\n${skillSetup}`.includes(expected)) {
    failures.push(`Effect skill setup does not contain ${expected}`);
  }
}
if (
  skill.includes("- use `effect@beta`") ||
  skillSetup.includes('repo_url="https://github.com/Effect-TS/effect-smol"')
) {
  failures.push(
    "Effect skill still contains active Effect 4 beta setup guidance"
  );
}

for (const expected of [
  "Mandatory Version Contract",
  "./references/typeweaver-effect-3.md",
  "archived conceptual material",
  "pinned Effect 3.22 source",
]) {
  if (!skill.includes(expected)) {
    failures.push(`Effect skill is missing mandatory v3 routing: ${expected}`);
  }
}

const activeV3Guide = read(
  ".agents/skills/effect-ts/references/typeweaver-effect-3.md"
);
for (const expected of [
  "Do not use Effect 4's `Schema.TaggedErrorClass`.",
  "Do not use Effect 4's `Context.Service` or `Effect.service`.",
  "Do not use Effect 4's `Cause.hasDies` or `cause.reasons`.",
]) {
  if (!activeV3Guide.includes(expected)) {
    failures.push(`Active Effect 3 guide is missing its v4 guard: ${expected}`);
  }
}

for (const entry of readdirSync(path.join(skillRoot, "references"), {
  withFileTypes: true,
})) {
  if (
    !entry.isFile() ||
    (!entry.name.startsWith("guide-") && entry.name !== "features.md")
  ) {
    continue;
  }
  const content = read(`.agents/skills/effect-ts/references/${entry.name}`);
  if (!content.includes("Archived Effect 4 material")) {
    failures.push(
      `.agents/skills/effect-ts/references/${entry.name} is missing its inactive v4 banner`
    );
  }
}

const skillHash = createHash("sha256");
for (const file of collectSkillFiles(skillRoot).sort((left, right) =>
  path
    .relative(skillRoot, left)
    .split(path.sep)
    .join("/")
    .localeCompare(path.relative(skillRoot, right).split(path.sep).join("/"))
)) {
  skillHash.update(path.relative(skillRoot, file).split(path.sep).join("/"));
  skillHash.update(readFileSync(file));
}
const skillLock = JSON.parse(read("skills-lock.json"));
if (skillLock.skills["effect-ts"]?.computedHash !== skillHash.digest("hex")) {
  failures.push("skills-lock.json does not match the repo-local Effect skill");
}

failures.push(
  ...validateEffectPackageVersions({
    workspaceRoot,
    runtimeVersion: contract.runtimeVersion,
  })
);

if (failures.length > 0) {
  process.stderr.write(`${failures.join("\n")}\n`);
  process.exit(1);
}

process.stdout.write(
  `Effect version contract verified: runtime ${contract.runtimeVersion}, peer ${contract.peerRange}\n`
);
