import {
  expectedIgnorePatterns,
  expectedRootRules,
  expectedTestFiles,
  expectedTestStructuralRelaxations,
  expectedTypedTestFiles,
  expectedTypeScriptExcludeFiles,
  expectedTypeScriptFiles,
  expectedTypeScriptRules,
} from "./lint-policy-rules.mjs";

/** @typedef {import("./lint-policy-contract.mjs").LintConfig} LintConfig */
/** @typedef {import("./lint-policy-contract.mjs").LintOverride} LintOverride */

/** @param {unknown} actual @param {unknown} expected @param {string} label @returns {void} */
const assertEqual = (actual, expected, label) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `${label} changed from the verified contract.\nExpected: ${JSON.stringify(expected)}\nActual: ${JSON.stringify(actual)}`
    );
  }
};

/** @param {readonly LintOverride[]} overrides @param {readonly string[]} files @returns {LintOverride | undefined} */
const findOverride = (overrides, files) =>
  overrides.find(
    override => JSON.stringify(override.files) === JSON.stringify(files)
  );

/** @param {LintConfig} config @returns {void} */
const assertRootConfiguration = config => {
  assertEqual(
    config.plugins,
    ["eslint", "unicorn", "oxc", "import"],
    "Root plugin list"
  );
  assertEqual(
    config.jsPlugins,
    ["eslint-plugin-sonarjs", "./config/oxlint/pureBarrelRule.mjs"],
    "JavaScript plugin list"
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

/** @param {readonly LintOverride[]} overrides @returns {void} */
const assertTestOverride = overrides => {
  const testOverride = findOverride(overrides, expectedTestFiles);
  if (testOverride === undefined)
    throw new Error("The audited test override is missing");
  assertEqual(
    testOverride.plugins,
    ["eslint", "unicorn", "oxc", "import"],
    "Test override plugin list"
  );
  assertEqual(
    { ...testOverride.rules },
    expectedTestStructuralRelaxations,
    "Test override rules"
  );
};

/** @param {readonly LintOverride[]} overrides @returns {void} */
const assertTypedTestOverride = overrides => {
  const typedTestOverride = findOverride(overrides, expectedTypedTestFiles);
  if (typedTestOverride === undefined)
    throw new Error("The audited typed test override is missing");
  assertEqual(
    typedTestOverride.plugins,
    ["eslint", "typescript", "unicorn", "oxc", "import"],
    "Typed test override plugin list"
  );
  assertEqual(
    typedTestOverride.rules,
    expectedTypeScriptRules,
    "Typed test override rules"
  );
};

/** @param {readonly LintOverride[]} overrides @returns {void} */
const assertTypescriptOverride = overrides => {
  const typescriptOverride = findOverride(overrides, expectedTypeScriptFiles);
  if (typescriptOverride === undefined)
    throw new Error("The audited TypeScript override is missing");
  assertEqual(
    typescriptOverride.plugins,
    ["eslint", "typescript", "unicorn", "oxc", "import"],
    "TypeScript override plugin list"
  );
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

/** @param {readonly LintOverride[]} overrides @returns {void} */
const assertNoWeakening = overrides => {
  const relaxedRules = new Set(Object.keys(expectedTestStructuralRelaxations));
  for (const ruleName of Object.keys(expectedTypeScriptRules)) {
    if (overrides.some(override => override.rules?.[ruleName] === "off")) {
      throw new Error(`${ruleName} may not be disabled by a broad override`);
    }
  }
  for (const override of overrides) {
    for (const [ruleName, value] of Object.entries(override.rules ?? {})) {
      if (
        value === "off" &&
        expectedRootRules[ruleName] !== undefined &&
        !relaxedRules.has(ruleName)
      ) {
        throw new Error(
          `${ruleName} may not be disabled outside the test container profile`
        );
      }
    }
  }
};

/** @param {import("./lint-policy-contract.mjs").LintConfig} config @returns {void} */
export const assertLintPolicyConfiguration = config => {
  assertRootConfiguration(config);
  const overrides = config.overrides ?? [];
  if (overrides.length !== 3) {
    throw new Error(
      `Expected exactly three lint overrides (tests, typed tests, and TypeScript), found ${String(overrides.length)}`
    );
  }
  assertTestOverride(overrides);
  assertTypedTestOverride(overrides);
  assertTypescriptOverride(overrides);
  assertNoWeakening(overrides);
};
