import { readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const workspaceRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const read = relativePath =>
  readFileSync(path.join(workspaceRoot, relativePath), "utf8");
const packageManifest = JSON.parse(read("package.json"));
const agentGuidance = read("AGENTS.md");
const failures = [];

const toolContracts = [
  { packageName: "tsdown", guidanceName: "tsdown" },
  { packageName: "oxlint", guidanceName: "Oxlint" },
  { packageName: "oxfmt", guidanceName: "Oxfmt" },
];
const expectedStatements = [
  `Node.js ${packageManifest.engines.node}`,
  packageManifest.packageManager,
];

for (const { packageName, guidanceName } of toolContracts) {
  if (packageManifest.devDependencies[packageName] === undefined) {
    failures.push(`package.json does not declare ${packageName}`);
    continue;
  }
  expectedStatements.push(guidanceName);
}

for (const statement of expectedStatements) {
  if (!agentGuidance.includes(statement)) {
    failures.push(`AGENTS.md does not state repository truth: ${statement}`);
  }
}

for (const obsoleteTool of ["pkgroll", "Prettier", "ESLint"]) {
  if (agentGuidance.includes(obsoleteTool)) {
    failures.push(`AGENTS.md still names obsolete tool: ${obsoleteTool}`);
  }
}

if (failures.length > 0) {
  process.stderr.write(`${failures.join("\n")}\n`);
  process.exit(1);
}

process.stdout.write(
  `Repository guidance verified: Node.js ${packageManifest.engines.node}, ${packageManifest.packageManager}, tsdown, Oxlint, Oxfmt\n`
);
