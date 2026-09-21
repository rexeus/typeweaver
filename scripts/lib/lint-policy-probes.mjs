import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  assertLintPolicyConfiguration,
  readLintConfig,
  workspaceRoot,
} from "./lint-policy-contract.mjs";
import { mutationCases } from "./lint-policy-mutations.mjs";
import { spawnPnpmSync } from "./pnpm-command.mjs";
import { assertStricterMaintainabilityProbes } from "./stricter-maintainability-probes.mjs";

/** @typedef {import("./lint-policy-contract.mjs").LintConfig} LintConfig */
/** @typedef {import("./lint-policy-contract.mjs").LintOverride} LintOverride */
/** @typedef {{ code: string, filename: string, message: string, severity: string }} LintDiagnostic */

/**
 * Test containers receive every type-aware safety rule; only the structural
 * container budgets are relaxed. These fixtures prove that a semantic rule
 * still fires through the test override instead of a broad rule-disabling one.
 *
 * @param {string} fixtureRoot
 * @returns {void}
 */
export const writeTestScopeFixtures = fixtureRoot => {
  const testRoot = path.join(fixtureRoot, "__test__");
  mkdirSync(testRoot, { recursive: true });
  writeFileSync(
    path.join(testRoot, "test-scope.valid.ts"),
    "export const value: unknown = 1;\n"
  );
  writeFileSync(
    path.join(testRoot, "test-scope.invalid.ts"),
    "export const value: any = 1;\n"
  );
};

/**
 * @param {string} fixtureRoot
 * @returns {void}
 */
export const writeDependencyFixtures = fixtureRoot => {
  for (let index = 0; index < 11; index += 1) {
    writeFileSync(
      path.join(fixtureRoot, `dependency${index}.ts`),
      `export const dependency${index} = ${index};\n`
    );
  }
};

/**
 * @param {string} fixtureRoot
 * @returns {void}
 */
export const writeUnusedDisableFixture = fixtureRoot => {
  writeFileSync(
    path.join(fixtureRoot, "unused-disable.invalid.ts"),
    [
      "export const value = 1;",
      "// oxlint-disable-next-line no-explicit-any",
      "export const other = 2;",
      "",
    ].join("\n")
  );
};

/**
 * @param {readonly LintDiagnostic[]} diagnostics
 * @param {string} filePath
 * @returns {LintDiagnostic[]}
 */
const diagnosticsForPath = (diagnostics, filePath) =>
  diagnostics.filter(
    diagnostic => path.resolve(workspaceRoot, diagnostic.filename) === filePath
  );

/**
 * @param {readonly LintDiagnostic[]} diagnostics
 * @param {string} fixtureRoot
 * @returns {void}
 */
const assertTestScopeCase = (diagnostics, fixtureRoot) => {
  const testRoot = path.join(fixtureRoot, "__test__");
  const validDiagnostics = diagnosticsForPath(
    diagnostics,
    path.join(testRoot, "test-scope.valid.ts")
  );
  if (validDiagnostics.length > 0) {
    throw new Error(
      `test-scope: valid fixture produced ${JSON.stringify(
        validDiagnostics.map(diagnostic => diagnostic.code)
      )}`
    );
  }

  const invalidDiagnostics = diagnosticsForPath(
    diagnostics,
    path.join(testRoot, "test-scope.invalid.ts")
  );
  if (
    !invalidDiagnostics.some(
      diagnostic => diagnostic.code === "typescript(no-explicit-any)"
    )
  ) {
    throw new Error(
      `test-scope: the test override did not enforce typescript(no-explicit-any) (got ${JSON.stringify(
        invalidDiagnostics.map(diagnostic => diagnostic.code)
      )})`
    );
  }
};

/**
 * @param {readonly LintDiagnostic[]} diagnostics
 * @param {string} fixtureRoot
 * @returns {void}
 */
const assertUnusedDisableCase = (diagnostics, fixtureRoot) => {
  const reported = diagnosticsForPath(
    diagnostics,
    path.join(fixtureRoot, "unused-disable.invalid.ts")
  ).some(
    diagnostic =>
      diagnostic.severity === "error" &&
      typeof diagnostic.message === "string" &&
      diagnostic.message.includes("Unused oxlint-disable directive")
  );
  if (!reported) {
    throw new Error(
      "unused-disable: an unused disable directive was not reported as an error"
    );
  }
};

const warnLevelConfig = JSON.stringify(
  { rules: { "eslint/no-console": "warn" } },
  null,
  2
);
const warnLevelFixture = [
  "export const log = (): void => {",
  '  console.log("value");',
  "};",
  "",
].join("\n");

/**
 * @param {string} fixtureRoot
 * @returns {void}
 */
const assertDenyWarnings = fixtureRoot => {
  const configPath = path.join(fixtureRoot, "warn-level.oxlintrc.json");
  const sourcePath = path.join(fixtureRoot, "warn-level.probe.ts");
  writeFileSync(configPath, warnLevelConfig);
  writeFileSync(sourcePath, warnLevelFixture);

  const denied = spawnPnpmSync({
    args: [
      "--silent",
      "exec",
      "oxlint",
      "-c",
      configPath,
      "--deny-warnings",
      sourcePath,
    ],
    cwd: workspaceRoot,
    encoding: "utf8",
  });
  if (denied.status === 0) {
    throw new Error(
      "deny-warnings: a warning-level finding must fail the lint gate"
    );
  }

  const allowed = spawnPnpmSync({
    args: ["--silent", "exec", "oxlint", "-c", configPath, sourcePath],
    cwd: workspaceRoot,
    encoding: "utf8",
  });
  if (allowed.status !== 0) {
    throw new Error(
      `deny-warnings: a warning-level finding must pass without --deny-warnings\n${allowed.stdout}\n${allowed.stderr}`
    );
  }
};

/**
 * @param {readonly LintDiagnostic[]} diagnostics
 * @param {string} fixtureRoot
 * @returns {void}
 */
export const assertLintPolicyProbes = (diagnostics, fixtureRoot) => {
  assertTestScopeCase(diagnostics, fixtureRoot);
  assertUnusedDisableCase(diagnostics, fixtureRoot);
  assertDenyWarnings(fixtureRoot);
  assertStricterMaintainabilityProbes(fixtureRoot);
};

/**
 * @param {LintConfig} config
 * @param {readonly string[]} files
 * @returns {LintOverride}
 */
/**
 * @param {string} label
 * @param {(config: LintConfig) => void} mutate
 * @returns {void}
 */
const assertConfigurationRejects = (label, mutate) => {
  const config = structuredClone(readLintConfig());
  mutate(config);
  try {
    assertLintPolicyConfiguration(config);
  } catch {
    return;
  }
  throw new Error(`Lint policy accepted a weakened configuration: ${label}`);
};

/**
 * Proves the configuration contract rejects every documented weakening by
 * mutating a deep clone of the real policy and asserting a rejection.
 *
 * @returns {number}
 */
export const assertConfigurationWeakeningDetection = () => {
  for (const mutation of mutationCases) {
    assertConfigurationRejects(mutation.label, mutation.mutate);
  }
  return mutationCases.length;
};
