import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * @typedef {object} LintOverride
 * @property {string[]} [files]
 * @property {string[]} [excludeFiles]
 * @property {string[]} [plugins]
 * @property {Record<string, unknown>} rules
 *
 * @typedef {object} LintConfig
 * @property {string[]} [plugins]
 * @property {string[]} [jsPlugins]
 * @property {Record<string, unknown>} [categories]
 * @property {Record<string, unknown>} options
 * @property {Record<string, unknown>} [env]
 * @property {Record<string, unknown>} rules
 * @property {string[]} ignorePatterns
 * @property {LintOverride[]} overrides
 */

const workspaceRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  ".."
);

/**
 * Exact root-level policy. Every entry is asserted by value and order so a
 * rule cannot be silently weakened, duplicated, or removed.
 *
 * @type {Record<string, unknown>}
 */
export const expectedRootRules = {
  "eslint/complexity": ["error", { max: 10, variant: "classic" }],
  "eslint/max-depth": ["error", { max: 3 }],
  "eslint/max-lines": [
    "error",
    { max: 400, skipBlankLines: true, skipComments: true },
  ],
  "eslint/max-lines-per-function": [
    "error",
    { max: 60, skipBlankLines: true, skipComments: true },
  ],
  "eslint/max-nested-callbacks": ["error", { max: 3 }],
  "eslint/max-params": ["error", { max: 4, countThis: "except-void" }],
  "eslint/max-statements": ["error", { max: 30 }],
  "eslint/no-eval": "error",
  "eslint/no-implied-eval": "error",
  "eslint/no-new-func": "error",
  "unicorn/prefer-node-protocol": "error",
  "eslint/no-unused-vars": "off",
  "import/consistent-type-specifier-style": ["error", "prefer-top-level"],
  "import/max-dependencies": ["error", { max: 10, ignoreTypeImports: false }],
  "import/no-cycle": "error",
  "import/no-duplicates": "error",
  "import/no-named-default": "error",
  "import/no-namespace": "error",
  "import/no-self-import": "error",
  "import/no-unassigned-import": "error",
  "sonarjs/cognitive-complexity": ["error", 15],
  "sonarjs/expression-complexity": ["error", { max: 6 }],
  "sonarjs/no-nested-switch": "error",
};

/** Type-aware safety rules that no override may disable. @type {Record<string, unknown>} */
export const expectedTypeScriptRules = {
  "typescript/consistent-type-definitions": ["error", "type"],
  "typescript/no-explicit-any": "error",
  "typescript/no-floating-promises": "error",
  "typescript/no-misused-promises": "error",
  "typescript/no-non-null-assertion": "error",
  "typescript/no-unsafe-argument": "error",
  "typescript/no-unsafe-assignment": "error",
  "typescript/no-unsafe-call": "error",
  "typescript/no-unsafe-member-access": "error",
  "typescript/no-unsafe-return": "error",
  "typescript/switch-exhaustiveness-check": "error",
};

/** @type {string[]} */
export const expectedIgnorePatterns = [
  "**/dist/**",
  "**/node_modules/**",
  ".vscode/**",
  "**/output/**",
  "**/outputs/**",
];

/** @type {string[]} */
export const expectedTestFiles = [
  "packages/**/__test__/**/*.ts",
  "packages/**/__test__/**/*.tsx",
  "packages/**/*.test.ts",
  "packages/**/*.test.tsx",
  "packages/**/*.spec.ts",
  "packages/**/*.spec.tsx",
];

/**
 * Test containers are declaration scaffolding: a `describe` block groups cases
 * and a `test` callback runs one case, so line and callback-nesting budgets
 * measure the harness rather than the behavior under test. Cognitive,
 * expression, and cyclomatic complexity, statement, parameter, depth, import,
 * and every type-aware safety rule still apply to tests.
 *
 * @type {Record<string, unknown>}
 */
export const expectedTestStructuralRelaxations = {
  "eslint/max-lines": "off",
  "eslint/max-lines-per-function": "off",
  "eslint/max-nested-callbacks": "off",
};

/** @type {string[]} */
export const expectedTypeScriptFiles = [
  "packages/**/*.ts",
  "packages/**/*.tsx",
];

/** @type {string[]} */
export const expectedTypeScriptExcludeFiles = [
  "packages/**/__test__/**",
  "packages/**/*.test.ts",
  "packages/**/*.test.tsx",
  "packages/**/*.spec.ts",
  "packages/**/*.spec.tsx",
  "packages/**/tsdown.config.ts",
  "packages/**/examples/**",
  "packages/**/fixtures/**",
  "packages/**/test-fixtures/**",
  "packages/test-utils/src/test-server/runtimes/serve-*.ts",
];

/**
 * @param {unknown} actual
 * @param {unknown} expected
 * @param {string} label
 * @returns {void}
 */
const assertEqual = (actual, expected, label) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `${label} changed from the verified contract.\nExpected: ${JSON.stringify(
        expected
      )}\nActual: ${JSON.stringify(actual)}`
    );
  }
};

/**
 * @returns {LintConfig}
 */
export const readLintConfig = () =>
  JSON.parse(readFileSync(path.join(workspaceRoot, ".oxlintrc.json"), "utf8"));

/**
 * @param {readonly LintOverride[]} overrides
 * @param {readonly string[]} files
 * @returns {LintOverride | undefined}
 */
const findOverride = (overrides, files) =>
  overrides.find(
    override => JSON.stringify(override.files) === JSON.stringify(files)
  );

/**
 * Asserts the exact, type-aware warning-free lint policy. The contract rejects
 * any override that disables a type-aware safety rule and any override that
 * relaxes a maintainability threshold outside the single documented test
 * container profile.
 *
 * @param {LintConfig} config
 * @returns {void}
 */
const assertRootConfiguration = config => {
  assertEqual(
    config.plugins,
    ["eslint", "unicorn", "oxc", "import"],
    "Root plugin list"
  );
  assertEqual(
    config.jsPlugins,
    ["eslint-plugin-sonarjs"],
    "SonarJS JS plugin list"
  );
  assertEqual(config.categories, { correctness: "error" }, "Root categories");
  assertEqual(
    config.options,
    { typeAware: true, reportUnusedDisableDirectives: "error" },
    "Root options"
  );
  assertEqual(config.env, { builtin: true, node: true }, "Root env");
  assertEqual(config.rules, expectedRootRules, "Root rules");
  assertEqual(
    config.ignorePatterns,
    expectedIgnorePatterns,
    "Root ignorePatterns"
  );
};

/**
 * @param {readonly LintOverride[]} overrides
 * @returns {void}
 */
const assertTestOverride = overrides => {
  const testOverride = findOverride(overrides, expectedTestFiles);
  if (testOverride === undefined) {
    throw new Error("The audited test override is missing");
  }
  assertEqual(
    { ...testOverride.rules },
    { ...expectedTypeScriptRules, ...expectedTestStructuralRelaxations },
    "Test override rules"
  );
};

/**
 * @param {readonly LintOverride[]} overrides
 * @returns {void}
 */
const assertTypescriptOverride = overrides => {
  const typescriptOverride = findOverride(overrides, expectedTypeScriptFiles);
  if (typescriptOverride === undefined) {
    throw new Error("The audited TypeScript override is missing");
  }
  assertEqual(
    typescriptOverride.excludeFiles,
    expectedTypeScriptExcludeFiles,
    "TypeScript override excludeFiles"
  );
  assertEqual(
    typescriptOverride.rules,
    expectedTypeScriptRules,
    "TypeScript override rules"
  );
};

/**
 * @param {string} ruleName
 * @param {unknown} value
 * @param {ReadonlySet<string>} relaxedRules
 * @returns {boolean}
 */
const isForbiddenDisable = (ruleName, value, relaxedRules) =>
  value === "off" &&
  expectedRootRules[ruleName] !== undefined &&
  !relaxedRules.has(ruleName);

/**
 * @param {readonly LintOverride[]} overrides
 * @returns {void}
 */
const assertTypeScriptRulesActive = overrides => {
  for (const ruleName of Object.keys(expectedTypeScriptRules)) {
    for (const override of overrides) {
      if (override.rules?.[ruleName] === "off") {
        throw new Error(`${ruleName} may not be disabled by a broad override`);
      }
    }
  }
};

/**
 * @param {readonly LintOverride[]} overrides
 * @returns {void}
 */
const assertNoWeakening = overrides => {
  assertTypeScriptRulesActive(overrides);

  const relaxedMaintainabilityRules = new Set(
    Object.keys(expectedTestStructuralRelaxations)
  );
  for (const override of overrides) {
    for (const [ruleName, value] of Object.entries(override.rules ?? {})) {
      if (isForbiddenDisable(ruleName, value, relaxedMaintainabilityRules)) {
        throw new Error(
          `${ruleName} may not be disabled outside the test container profile`
        );
      }
    }
  }
};

/**
 * @param {LintConfig} [config]
 * @returns {void}
 */
export const assertLintPolicyConfiguration = (config = readLintConfig()) => {
  assertRootConfiguration(config);
  const overrides = config.overrides ?? [];
  if (overrides.length !== 2) {
    throw new Error(
      `Expected exactly two lint overrides (tests and TypeScript), found ${String(
        overrides.length
      )}`
    );
  }
  assertTestOverride(overrides);
  assertTypescriptOverride(overrides);
  assertNoWeakening(overrides);
};

export { workspaceRoot };
