import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { assertLintPolicyConfiguration } from "./lib/lint-policy-contract.mjs";
import {
  assertConfigurationWeakeningDetection,
  assertLintPolicyProbes,
  writeDependencyFixtures,
  writeTestScopeFixtures,
  writeUnusedDisableFixture,
} from "./lib/lint-policy-probes.mjs";
import { spawnPnpmSync } from "./lib/pnpm-command.mjs";

/** @typedef {{ code: string, filename: string, message: string, severity: string }} LintDiagnostic */
/** @typedef {{ diagnostics: LintDiagnostic[] }} LintOutput */
/** @typedef {{ name: string, rule: string, valid: string, invalid: string }} LintCase */

const workspaceRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);

assertLintPolicyConfiguration();

const importTarget = [
  "export const namedTarget = 1;",
  "export type Target = number;",
  "export default function target(): number {",
  "  return namedTarget;",
  "}",
  "",
].join("\n");

const classValidFixture = [
  'import { readFileSync } from "node:fs";',
  "export const value: unknown = readFileSync;",
  "",
].join("\n");

const classInvalidFixture = [
  'import { readFileSync } from "fs";',
  "export const value: unknown = readFileSync;",
  "",
].join("\n");

/** @type {LintCase[]} */
const cases = [
  {
    name: "no-explicit-any",
    rule: "typescript(no-explicit-any)",
    valid: "export const value: unknown = 1;\n",
    invalid: "export const value: any = 1;\n",
  },
  {
    name: "no-floating-promises",
    rule: "typescript(no-floating-promises)",
    valid: "export const run = (): void => {\n  void Promise.resolve(1);\n};\n",
    invalid: "export const run = (): void => {\n  Promise.resolve(1);\n};\n",
  },
  {
    name: "no-misused-promises",
    rule: "typescript(no-misused-promises)",
    valid: [
      "const invoke = (callback: () => Promise<void>): void => {",
      "  void callback();",
      "};",
      "export const run = (): void => {",
      "  invoke(async () => {});",
      "};",
      "",
    ].join("\n"),
    invalid: [
      "const invoke = (callback: () => void): void => {",
      "  callback();",
      "};",
      "export const run = (): void => {",
      "  invoke(async () => {});",
      "};",
      "",
    ].join("\n"),
  },
  {
    name: "no-non-null-assertion",
    rule: "typescript(no-non-null-assertion)",
    valid: [
      "export const length = (value: string | undefined): number =>",
      "  value === undefined ? 0 : value.length;",
      "",
    ].join("\n"),
    invalid: [
      "export const length = (value: string | undefined): number =>",
      "  value!.length;",
      "",
    ].join("\n"),
  },
  {
    name: "no-unsafe-argument",
    rule: "typescript(no-unsafe-argument)",
    valid: [
      "declare const source: unknown;",
      "const accept = (input: unknown): unknown => input;",
      "export const passed = accept(source);",
      "",
    ].join("\n"),
    invalid: [
      "declare const source: any;",
      "const accept = (input: string): string => input;",
      "export const passed = accept(source);",
      "",
    ].join("\n"),
  },
  {
    name: "no-unsafe-assignment",
    rule: "typescript(no-unsafe-assignment)",
    valid:
      "declare const source: unknown;\nexport const assigned: unknown = source;\n",
    invalid:
      "declare const source: any;\nexport const assigned: string = source;\n",
  },
  {
    name: "no-unsafe-call",
    rule: "typescript(no-unsafe-call)",
    valid:
      "declare const source: () => unknown;\nexport const called: unknown = source();\n",
    invalid:
      "declare const source: any;\nexport const called: unknown = source();\n",
  },
  {
    name: "no-unsafe-member-access",
    rule: "typescript(no-unsafe-member-access)",
    valid:
      "declare const source: { readonly member: unknown };\nexport const member: unknown = source.member;\n",
    invalid:
      "declare const source: any;\nexport const member: unknown = source.member;\n",
  },
  {
    name: "no-unsafe-return",
    rule: "typescript(no-unsafe-return)",
    valid:
      "declare const source: unknown;\nexport const getValue = (): unknown => source;\n",
    invalid:
      "declare const source: any;\nexport const getValue = (): string => source;\n",
  },
  {
    name: "switch-exhaustiveness-check",
    rule: "typescript(switch-exhaustiveness-check)",
    valid: [
      'type Kind = "a" | "b";',
      "export const describe = (kind: Kind): number => {",
      "  switch (kind) {",
      '    case "a":',
      "      return 1;",
      '    case "b":',
      "      return 2;",
      "  }",
      "};",
      "",
    ].join("\n"),
    invalid: [
      'type Kind = "a" | "b";',
      "export const describe = (kind: Kind): number => {",
      "  switch (kind) {",
      '    case "a":',
      "      return 1;",
      "    default:",
      "      return 0;",
      "  }",
      "};",
      "",
    ].join("\n"),
  },
  {
    name: "no-eval",
    rule: "eslint(no-eval)",
    valid: "export const run = (): unknown => 1;\n",
    invalid: 'export const run = (): unknown => eval("1");\n',
  },
  {
    name: "no-implied-eval",
    rule: "eslint(no-implied-eval)",
    valid:
      "export const run = (): void => {\n  setTimeout(() => undefined, 0);\n};\n",
    invalid: 'export const run = (): void => {\n  setTimeout("1", 0);\n};\n',
  },
  {
    name: "no-new-func",
    rule: "eslint(no-new-func)",
    valid: "export const run = (): unknown => 1;\n",
    invalid: 'export const run = (): unknown => new Function("return 1")();\n',
  },
  {
    name: "no-duplicates",
    rule: "import(no-duplicates)",
    valid:
      'import { readFileSync, writeFileSync } from "node:fs";\nexport const value = [readFileSync, writeFileSync];\n',
    invalid:
      'import { readFileSync } from "node:fs";\nimport { writeFileSync } from "node:fs";\nexport const value = [readFileSync, writeFileSync];\n',
  },
  {
    name: "no-namespace",
    rule: "import(no-namespace)",
    valid:
      'import { readFileSync } from "node:fs";\nexport const value = readFileSync;\n',
    invalid: 'import * as fs from "node:fs";\nexport const value = fs;\n',
  },
  {
    name: "no-unassigned-import",
    rule: "import(no-unassigned-import)",
    valid:
      'import { namedTarget } from "./importTarget.js";\nexport const value = namedTarget;\n',
    invalid: 'import "./importTarget.js";\nexport const value = 1;\n',
  },
  {
    name: "consistent-type-specifier-style",
    rule: "import(consistent-type-specifier-style)",
    valid: [
      'import { namedTarget } from "./importTarget.js";',
      'import type { Target } from "./importTarget.js";',
      "export const value: Target = namedTarget;",
      "",
    ].join("\n"),
    invalid: [
      'import { type Target, namedTarget } from "./importTarget.js";',
      "export const value: Target = namedTarget;",
      "",
    ].join("\n"),
  },
  {
    name: "no-named-default",
    rule: "import(no-named-default)",
    valid:
      'import target from "./importTarget.js";\nexport const value = target;\n',
    invalid:
      'import { default as target } from "./importTarget.js";\nexport const value = target;\n',
  },
  {
    name: "no-self-import",
    rule: "import(no-self-import)",
    valid: "export const value = 1;\n",
    invalid: [
      'import { value as selfValue } from "./no-self-import.invalid.js";',
      "export const value = 1;",
      "export const other = selfValue;",
      "",
    ].join("\n"),
  },
  {
    name: "max-dependencies",
    rule: "import(max-dependencies)",
    valid: [
      ...Array.from(
        { length: 10 },
        (_, index) =>
          `import { dependency${index} } from "./dependency${index}.js";`
      ),
      `export const value = [${Array.from(
        { length: 10 },
        (_, index) => `dependency${index}`
      ).join(", ")}];`,
      "",
    ].join("\n"),
    invalid: [
      ...Array.from(
        { length: 11 },
        (_, index) =>
          `import { dependency${index} } from "./dependency${index}.js";`
      ),
      `export const value = [${Array.from(
        { length: 11 },
        (_, index) => `dependency${index}`
      ).join(", ")}];`,
      "",
    ].join("\n"),
  },
  {
    name: "prefer-node-protocol",
    rule: "unicorn(prefer-node-protocol)",
    valid: classValidFixture,
    invalid: classInvalidFixture,
  },
];

/**
 * @param {import("node:child_process").SpawnSyncReturns<string>} result
 * @returns {LintOutput}
 */
const parseLintOutput = result => {
  if (result.error !== undefined) {
    throw result.error;
  }
  try {
    return JSON.parse(result.stdout);
  } catch (error) {
    throw new Error(
      `pnpm lint did not return JSON\n${result.stdout}\n${result.stderr}`,
      { cause: error }
    );
  }
};

/**
 * @returns {LintDiagnostic[]}
 */
const runRootLint = () =>
  parseLintOutput(
    spawnPnpmSync({
      args: ["--silent", "run", "lint", "--format=json"],
      cwd: workspaceRoot,
      encoding: "utf8",
      maxBuffer: 50 * 1024 * 1024,
    })
  ).diagnostics;

/**
 * @param {string} directory
 * @param {string} fileName
 * @param {string} content
 * @returns {string}
 */
const writeFixture = (directory, fileName, content) => {
  writeFileSync(path.join(directory, fileName), content);
  return fileName;
};

/**
 * @param {readonly LintDiagnostic[]} diagnostics
 * @param {string} fixtureRoot
 * @returns {void}
 */
const assertCases = (diagnostics, fixtureRoot) => {
  const failures = [];
  for (const testCase of cases) {
    const validName = `${testCase.name}.valid.ts`;
    const invalidName = `${testCase.name}.invalid.ts`;
    const validPath = path.join(fixtureRoot, validName);
    const invalidPath = path.join(fixtureRoot, invalidName);

    const validDiagnostics = diagnostics.filter(
      diagnostic =>
        path.resolve(workspaceRoot, diagnostic.filename) === validPath
    );
    if (validDiagnostics.length > 0) {
      failures.push(
        `${testCase.name}: valid fixture produced ${JSON.stringify(
          validDiagnostics.map(diagnostic => diagnostic.code)
        )}`
      );
    }

    const invalidDiagnostics = diagnostics.filter(
      diagnostic =>
        path.resolve(workspaceRoot, diagnostic.filename) === invalidPath
    );
    if (
      !invalidDiagnostics.some(diagnostic => diagnostic.code === testCase.rule)
    ) {
      failures.push(
        `${testCase.name}: invalid fixture did not produce ${testCase.rule} (got ${JSON.stringify(
          invalidDiagnostics.map(diagnostic => diagnostic.code)
        )})`
      );
    }
  }
  if (failures.length > 0) {
    throw new Error(`Lint policy failures:\n${failures.join("\n")}`);
  }
};

/**
 * @param {readonly LintDiagnostic[]} diagnostics
 * @param {string} fixtureRoot
 * @returns {void}
 */
const assertCycleCase = (diagnostics, fixtureRoot) => {
  const cyclePath = path.join(fixtureRoot, "no-cycle.part-a.ts");
  const cycleDiagnostics = diagnostics.filter(
    diagnostic => path.resolve(workspaceRoot, diagnostic.filename) === cyclePath
  );
  if (
    !cycleDiagnostics.some(diagnostic => diagnostic.code === "import(no-cycle)")
  ) {
    throw new Error(
      `no-cycle: invalid fixture did not produce import(no-cycle) (got ${JSON.stringify(
        cycleDiagnostics.map(diagnostic => diagnostic.code)
      )})`
    );
  }
};

const fixtureRoot = mkdtempSync(
  path.join(workspaceRoot, "packages", "test-utils", ".lint-policy-run-")
);

try {
  mkdirSync(fixtureRoot, { recursive: true });
  writeFileSync(
    path.join(fixtureRoot, "package.json"),
    JSON.stringify({ type: "module" }, null, 2)
  );
  writeFileSync(
    path.join(fixtureRoot, "tsconfig.json"),
    JSON.stringify(
      {
        extends: "@rexeus/typeweaver-tsconfig/node.json",
        include: ["**/*.ts"],
      },
      null,
      2
    )
  );
  writeFixture(fixtureRoot, "importTarget.ts", importTarget);
  writeDependencyFixtures(fixtureRoot);
  for (const testCase of cases) {
    writeFixture(fixtureRoot, `${testCase.name}.valid.ts`, testCase.valid);
    writeFixture(fixtureRoot, `${testCase.name}.invalid.ts`, testCase.invalid);
  }
  writeFixture(
    fixtureRoot,
    "no-cycle.part-a.ts",
    'import { partB } from "./no-cycle.part-b.js";\nexport const partA = partB;\n'
  );
  writeFixture(
    fixtureRoot,
    "no-cycle.part-b.ts",
    'import { partA } from "./no-cycle.part-a.js";\nexport const partB = partA;\n'
  );
  writeTestScopeFixtures(fixtureRoot);
  writeUnusedDisableFixture(fixtureRoot);

  const diagnostics = runRootLint();
  assertCases(diagnostics, fixtureRoot);
  assertCycleCase(diagnostics, fixtureRoot);
  assertLintPolicyProbes(diagnostics, fixtureRoot);
} finally {
  rmSync(fixtureRoot, { recursive: true, force: true });
}

const weakeningChecks = assertConfigurationWeakeningDetection();

process.stdout.write(
  `Verified ${cases.length + 1} lint rules, test-scope and unused-disable enforcement, ` +
    `deny-warnings, and ${weakeningChecks} configuration-weakening rejections\n`
);
