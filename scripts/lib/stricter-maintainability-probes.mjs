import { mkdirSync } from "node:fs";
import path from "node:path";
import {
  cognitiveComplexity,
  dependencySource,
  fileLines,
  writeDependencySources,
} from "./maintainability-probe-fixtures.mjs";
import { assertBoundary } from "./maintainability-probe-runner.mjs";

const fileMaxLinesConfig = {
  plugins: ["eslint"],
  rules: {
    "eslint/no-unused-vars": "off",
    "eslint/max-lines": [
      "error",
      { max: 250, skipBlankLines: true, skipComments: false },
    ],
  },
};

const testMaxLinesConfig = {
  plugins: ["eslint"],
  rules: {
    "eslint/no-unused-vars": "off",
    "eslint/max-lines": [
      "error",
      { max: 350, skipBlankLines: true, skipComments: false },
    ],
  },
};

const cognitiveConfig = {
  jsPlugins: ["eslint-plugin-sonarjs"],
  rules: {
    "eslint/no-unused-vars": "off",
    "sonarjs/cognitive-complexity": ["error", 12],
  },
};

const dependencyConfig = {
  plugins: ["import"],
  rules: {
    "eslint/no-unused-vars": "off",
    "import/max-dependencies": ["error", { max: 10, ignoreTypeImports: false }],
  },
};

/** @param {string} fixtureRoot */
export const assertStricterMaintainabilityProbes = fixtureRoot => {
  const probeRoot = path.join(fixtureRoot, "stricter-maintainability");
  mkdirSync(probeRoot, { recursive: true });
  assertBoundary({
    name: "file-max-lines-250",
    rule: "eslint(max-lines)",
    config: fileMaxLinesConfig,
    valid: fileLines(249),
    invalid: fileLines(250),
    directory: probeRoot,
  });
  assertBoundary({
    name: "test-max-lines-350",
    rule: "eslint(max-lines)",
    config: testMaxLinesConfig,
    valid: fileLines(349),
    invalid: fileLines(350),
    directory: probeRoot,
  });
  assertBoundary({
    name: "cognitive-complexity",
    rule: "sonarjs(cognitive-complexity)",
    config: cognitiveConfig,
    valid: cognitiveComplexity(2),
    invalid: cognitiveComplexity(3),
    directory: probeRoot,
  });

  writeDependencySources(probeRoot);
  assertBoundary({
    name: "max-dependencies",
    rule: "import(max-dependencies)",
    config: dependencyConfig,
    valid: dependencySource(9),
    invalid: dependencySource(10),
    directory: probeRoot,
  });
};
