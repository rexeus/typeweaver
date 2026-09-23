import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import {
  NATIVE_EFFECT_DOCUMENT_TOKENS,
  validateNativeEffectWorkspaceContract,
} from "./lib/effect-native-contract.mjs";
import { validateEffectPackageVersions } from "./lib/effect-version-contract.mjs";

/** @typedef {import("./lib/tooling-types.mjs").EffectBaselineContract} EffectBaselineContract */
/** @typedef {import("./lib/tooling-types.mjs").PackageManifest} PackageManifest */
/** @typedef {Record<string, PackageManifest | undefined>} PackageManifestMap */
/** @typedef {{ skills: Record<string, { computedHash?: string } | undefined> }} SkillLock */

const workspaceRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
/**
 * @param {string} relativePath
 * @returns {string}
 */
const read = relativePath =>
  readFileSync(path.join(workspaceRoot, relativePath), "utf8");
/** @type {EffectBaselineContract} */
const contract = JSON.parse(read("config/effect-baseline.json"));
const requiredDocuments = [
  "MIGRATION.md",
  "docs/adr/0003-effect-native-plugin-api.md",
  "docs/adr/0008-effect-4-baseline.md",
  "docs/plugin-authoring.md",
  "packages/gen/README.md",
];
const failures = [];
const skillRoot = path.join(workspaceRoot, ".agents", "skills", "effect-ts");

/**
 * @param {string} directory
 * @returns {string[]}
 */
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

if (Object.keys(contract.acceptedEffectDependencies ?? {}).length === 0) {
  failures.push(
    "config/effect-baseline.json must list acceptedEffectDependencies"
  );
}

const workspaceConfig = read("pnpm-workspace.yaml");
if (!workspaceConfig.includes(`effect: "${contract.peerRange}"`)) {
  failures.push("pnpm-workspace.yaml does not match the Effect peer contract");
}

/** @type {PackageManifest} */
const rootPackage = JSON.parse(read("package.json"));
if (rootPackage.devDependencies?.["@effect/tsgo"] !== contract.tsgoVersion) {
  failures.push(
    "package.json does not exactly pin the contracted @effect/tsgo version"
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
if (!lockfile.includes(`  '@effect/tsgo@${contract.tsgoVersion}':`)) {
  failures.push(
    "pnpm-lock.yaml does not resolve the contracted @effect/tsgo version"
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
  "./references/typeweaver-effect-4.md",
  "archived conceptual material",
  "pinned Effect 4.0.0-rc.116 source",
]) {
  if (!skill.includes(expected)) {
    failures.push(
      `Effect skill is missing mandatory native routing: ${expected}`
    );
  }
}

const activeV4Guide = read(
  ".agents/skills/effect-ts/references/typeweaver-effect-4.md"
);
for (const expected of [
  "Context.Service",
  "Result",
  "Cause",
  "Schema",
  "4.0.0-rc.116",
]) {
  if (!activeV4Guide.includes(expected)) {
    failures.push(
      `Active Effect 4 guide is missing rc.116 guidance: ${expected}`
    );
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
/** @type {SkillLock} */
const skillLock = JSON.parse(read("skills-lock.json"));
if (skillLock.skills["effect-ts"]?.computedHash !== skillHash.digest("hex")) {
  failures.push("skills-lock.json does not match the repo-local Effect skill");
}

failures.push(
  ...validateEffectPackageVersions({
    workspaceRoot,
    runtimeVersion: contract.runtimeVersion,
    acceptedEffectDependencies: contract.acceptedEffectDependencies ?? {},
  })
);

/**
 * @param {string} relativePath
 * @returns {string | undefined}
 */
const readOptional = relativePath => {
  try {
    return read(relativePath);
  } catch {
    return undefined;
  }
};
/** @type {PackageManifestMap} */
const manifests = {
  cli: JSON.parse(read("packages/cli/package.json")),
  gen: JSON.parse(read("packages/gen/package.json")),
  effect: JSON.parse(read("packages/effect/package.json")),
  hono: JSON.parse(read("packages/hono/package.json")),
  clients: JSON.parse(read("packages/clients/package.json")),
  command: JSON.parse(read("packages/command/package.json")),
  types: JSON.parse(read("packages/types/package.json")),
  server: JSON.parse(read("packages/server/package.json")),
  openapi: JSON.parse(read("packages/openapi/package.json")),
  "aws-cdk": JSON.parse(read("packages/aws-cdk/package.json")),
  core: JSON.parse(read("packages/core/package.json")),
};
/** @type {Record<string, string | undefined>} */
const documents = Object.fromEntries(
  Object.keys(NATIVE_EFFECT_DOCUMENT_TOKENS).map(document => [
    document,
    readOptional(document),
  ])
);
failures.push(
  ...validateNativeEffectWorkspaceContract({
    contract,
    manifests,
    documents,
  })
);

if (failures.length > 0) {
  process.stderr.write(`${failures.join("\n")}\n`);
  process.exit(1);
}

process.stdout.write(
  `Effect version contract verified: runtime ${contract.runtimeVersion}, peer ${contract.peerRange}\n`
);
