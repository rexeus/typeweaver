import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";

/**
 * @param {string} directory
 * @returns {string[]}
 */
export const collectGeneratedFiles = directory =>
  readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const entryPath = path.join(directory, entry.name);
    return entry.isDirectory() ? collectGeneratedFiles(entryPath) : [entryPath];
  });

export const GENERATED_SOURCE_EXTENSIONS = new Set([
  ".ts",
  ".mts",
  ".cts",
  ".js",
  ".mjs",
  ".cjs",
]);
const FORBIDDEN_GENERATED_PACKAGES = [
  "effect",
  "@rexeus/typeweaver-gen",
  "@rexeus/typeweaver-effect",
];

// Reject the exact package name and every subpath of it, so
// `effect/experimental`, `@rexeus/typeweaver-gen/foo`, and
// `@rexeus/typeweaver-effect/runtime` are all caught. Unrelated packages like
// `effectively` or `zod` are not.
/**
 * @param {string} specifier
 * @returns {boolean}
 */
export const isForbiddenGeneratedSpecifier = specifier =>
  FORBIDDEN_GENERATED_PACKAGES.some(
    packageName =>
      specifier === packageName || specifier.startsWith(`${packageName}/`)
  );

// `preProcessFile` records static imports, side-effect imports, import/export
// re-exports, dynamic `import(...)`, and CommonJS `require(...)` alike, so the
// scan does not depend on how a generated module was written.
/**
 * @param {string} source
 * @returns {string[]}
 */
export const collectBareModuleSpecifiers = source =>
  ts
    .preProcessFile(source, true, true)
    .importedFiles.map(imported => imported.fileName)
    .filter(
      specifier => !specifier.startsWith(".") && !specifier.startsWith("node:")
    );

const SCANNER_CHARACTERIZATION_SOURCE = [
  'import "effect";',
  'import "effect/experimental";',
  'import { Effect } from "@rexeus/typeweaver-gen";',
  'import { helper } from "@rexeus/typeweaver-gen/internal";',
  'export * from "@rexeus/typeweaver-effect";',
  'export { runtime } from "@rexeus/typeweaver-effect/runtime";',
  'const dynamicRoot = await import("effect");',
  'const dynamicSubpath = await import("effect/Effect");',
  'const requireSubpath = require("@rexeus/typeweaver-effect/adapter");',
  'import "zod";',
].join("\n");

/**
 * @returns {void}
 */
export const verifyGeneratedImportScanner = () => {
  const collected = collectBareModuleSpecifiers(
    SCANNER_CHARACTERIZATION_SOURCE
  );
  for (const specifier of [
    "effect",
    "effect/experimental",
    "@rexeus/typeweaver-gen",
    "@rexeus/typeweaver-gen/internal",
    "@rexeus/typeweaver-effect",
    "@rexeus/typeweaver-effect/runtime",
    "effect/Effect",
    "@rexeus/typeweaver-effect/adapter",
    "zod",
  ]) {
    assert(
      collected.includes(specifier),
      `module-specifier collector missed ${specifier}; collected ${collected.join(", ")}`
    );
  }
  const forbidden = collected.filter(isForbiddenGeneratedSpecifier);
  assert(
    forbidden.length >= 7,
    `forbidden classifier should flag the root and subpath forms; flagged ${forbidden.join(", ")}`
  );
  for (const specifier of [
    "effect",
    "effect/experimental",
    "@rexeus/typeweaver-gen",
    "@rexeus/typeweaver-gen/internal",
    "@rexeus/typeweaver-effect",
    "@rexeus/typeweaver-effect/runtime",
    "effect/Effect",
    "@rexeus/typeweaver-effect/adapter",
  ]) {
    assert(
      isForbiddenGeneratedSpecifier(specifier),
      `forbidden classifier missed ${specifier}`
    );
  }
  assert(
    !forbidden.includes("zod"),
    "forbidden classifier incorrectly flagged zod"
  );
  assert(
    !isForbiddenGeneratedSpecifier("effectively") &&
      !isForbiddenGeneratedSpecifier("@rexeus/typeweaver-generation"),
    "forbidden classifier matched an unrelated package name"
  );
};

/**
 * @param {string} outputRoot
 * @returns {void}
 */
export const assertNoForbiddenModuleSpecifiers = outputRoot => {
  /** @type {string[]} */
  const offenders = [];
  for (const filePath of collectGeneratedFiles(outputRoot)) {
    if (!GENERATED_SOURCE_EXTENSIONS.has(path.extname(filePath))) {
      continue;
    }
    const source = readFileSync(filePath, "utf8");
    for (const specifier of collectBareModuleSpecifiers(source)) {
      if (isForbiddenGeneratedSpecifier(specifier)) {
        offenders.push(
          `${path.relative(outputRoot, filePath)} -> ${specifier}`
        );
      }
    }
  }
  assert.deepEqual(
    offenders,
    [],
    `generated output imports Effect-native packages:\n${offenders.join("\n")}`
  );
};

const PROJECTION_OUTPUT_FILES = {
  types: ["responses/OkResponse.ts", "lib/types"],
  clients: ["health/HealthClient.ts", "lib/clients"],
  server: ["health/HealthRouter.ts", "lib/server"],
  hono: ["health/HealthHono.ts", "lib/hono"],
  command: ["command/cli.mts", "command/index.ts", "lib/command"],
  openapi: ["openapi/openapi.json"],
  "aws-cdk": ["health/HealthHttpApiRoutes.ts", "lib/aws-cdk"],
};

/**
 * @param {string} outputRoot
 * @returns {void}
 */
export const assertProjectionOutputsExist = outputRoot => {
  for (const [projection, files] of Object.entries(PROJECTION_OUTPUT_FILES)) {
    for (const file of files) {
      assert(
        existsSync(path.join(outputRoot, file)),
        `missing ${projection} projection output ${file}`
      );
    }
  }
};
