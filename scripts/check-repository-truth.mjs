import { readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import {
  deriveMetadataFields,
  extractMetadataProjectionFields,
  metadataProjectionMatches,
} from "./lib/repository-truth.mjs";

const workspaceRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
/** @typedef {import("./lib/tooling-types.mjs").PackageManifest} PackageManifest */

/**
 * @param {string} relativePath
 * @returns {string}
 */
const read = relativePath =>
  readFileSync(path.join(workspaceRoot, relativePath), "utf8");
/** @type {PackageManifest} */
const packageManifest = JSON.parse(read("package.json"));
const agentGuidance = read("AGENTS.md");
const cliReadme = read("packages/cli/README.md");
const effectReadme = read("packages/effect/README.md");
const failures = [];

const toolContracts = [
  { packageName: "tsdown", guidanceName: "tsdown" },
  { packageName: "oxlint", guidanceName: "Oxlint" },
  { packageName: "oxfmt", guidanceName: "Oxfmt" },
];
const expectedStatements = [
  `Node.js ${String(packageManifest.engines?.node)}`,
  String(packageManifest.packageManager),
];

for (const { packageName, guidanceName } of toolContracts) {
  if (packageManifest.devDependencies?.[packageName] === undefined) {
    failures.push(`package.json does not declare ${packageName}`);
    continue;
  }
  expectedStatements.push(guidanceName);
}

// The private workspace compiler-profile package and the exact optional-property
// flag it introduces are durable toolchain facts that contributor guidance must
// state. The package must also stay unpublished.
const compilerProfilePackage = "@rexeus/typeweaver-tsconfig";
if (packageManifest.devDependencies?.[compilerProfilePackage] === undefined) {
  failures.push(`package.json does not declare ${compilerProfilePackage}`);
} else {
  expectedStatements.push(compilerProfilePackage, "exactOptionalPropertyTypes");
}
const compilerProfileManifest = JSON.parse(
  read("packages/tsconfig/package.json")
);
if (compilerProfileManifest.private !== true) {
  failures.push(
    "packages/tsconfig/package.json must remain private and unpublished"
  );
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

if (cliReadme.includes("OpenAPI 3.1.1")) {
  failures.push(
    "packages/cli/README.md still claims the obsolete OpenAPI 3.1.1 profile"
  );
}

if (effectReadme.includes("typed error mappers for each operation")) {
  failures.push(
    "packages/effect/README.md overstates generated HEAD-operation coverage"
  );
}

// The OpenAPI guide's metadata projection sentence must name exactly the fields
// the authoring contract defines and the document assembler projects, while the
// separate securitySchemes/security sentence stays out of scope.
const openApiReadme = read("packages/openapi/README.md");
const apiMetadataSource = read("packages/core/src/ApiMetadata.ts");
const supportedMetadataFields = deriveMetadataFields(apiMetadataSource);
if (supportedMetadataFields.length === 0) {
  failures.push("packages/core/src/ApiMetadata.ts defines no metadata fields");
} else if (
  !metadataProjectionMatches({
    apiMetadataSource,
    documentSource: openApiReadme,
  })
) {
  const documentedMetadataFields =
    extractMetadataProjectionFields(openApiReadme);
  failures.push(
    `packages/openapi/README.md metadata projection must name exactly ${supportedMetadataFields.join(", ")}; found ${documentedMetadataFields.join(", ") || "(none)"}`
  );
}

// `pnpm doctor` resolves to a pnpm builtin rather than the scaffold's script.
// Onboarding documents must name the explicit `pnpm run doctor` form.
for (const document of [
  "docs/getting-started.md",
  "packages/cli/src/templates/project-init/README.md.tmpl",
]) {
  if (read(document).includes("pnpm doctor")) {
    failures.push(
      `${document} invokes the pnpm builtin instead of \`pnpm run doctor\``
    );
  }
}

if (failures.length > 0) {
  process.stderr.write(`${failures.join("\n")}\n`);
  process.exit(1);
}

process.stdout.write(
  `Repository guidance verified: Node.js ${String(packageManifest.engines?.node)}, ${String(packageManifest.packageManager)}, tsdown, Oxlint, Oxfmt\n`
);
