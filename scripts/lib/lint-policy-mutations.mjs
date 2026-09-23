import {
  expectedTestFiles,
  expectedTypedTestFiles,
  expectedTypeScriptFiles,
} from "./lint-policy-rules.mjs";

/** @typedef {import("./lint-policy-contract.mjs").LintConfig} LintConfig */

/** @param {LintConfig} config @param {readonly string[]} files @returns {import("./lint-policy-contract.mjs").LintOverride} */
const overrideFor = (config, files) => {
  const override = config.overrides.find(
    candidate => JSON.stringify(candidate.files) === JSON.stringify(files)
  );
  if (override === undefined) {
    throw new Error(`missing lint override for ${JSON.stringify(files)}`);
  }
  return override;
};

/** @type {Array<{ label: string, mutate: (config: LintConfig) => void }>} */
export const mutationCases = [
  {
    label: "type-aware analysis disabled",
    mutate: config => {
      config.options["typeAware"] = false;
    },
  },
  {
    label: "unused disable reporting relaxed",
    mutate: config => {
      config.options["reportUnusedDisableDirectives"] = "off";
    },
  },
  {
    label: "root evaluation rule downgraded",
    mutate: config => {
      config.rules["eslint/no-eval"] = "warn";
    },
  },
  {
    label: "root structural threshold loosened",
    mutate: config => {
      config.rules["eslint/max-lines"] = [
        "error",
        { max: 251, skipBlankLines: true, skipComments: true },
      ];
    },
  },
  {
    label: "classic complexity threshold loosened",
    mutate: config => {
      config.rules["eslint/complexity"] = [
        "error",
        { max: 11, variant: "classic" },
      ];
    },
  },
  {
    label: "root structural threshold disabled",
    mutate: config => {
      config.rules["eslint/max-lines"] = "off";
    },
  },
  {
    label: "test structural threshold disabled",
    mutate: config => {
      overrideFor(config, expectedTestFiles).rules["eslint/max-lines"] = "off";
    },
  },
  {
    label: "test structural threshold loosened",
    mutate: config => {
      overrideFor(config, expectedTestFiles).rules["eslint/max-lines"] = [
        "error",
        { max: 351, skipBlankLines: true, skipComments: true },
      ];
    },
  },
  {
    label: "test structural threshold downgraded",
    mutate: config => {
      overrideFor(config, expectedTestFiles).rules["eslint/max-lines"] = [
        "warn",
        { max: 350, skipBlankLines: true, skipComments: true },
      ];
    },
  },
  {
    label: "test scope narrowed to package tests",
    mutate: config => {
      overrideFor(config, expectedTestFiles).files = expectedTypedTestFiles;
    },
  },
  {
    label: "one config test classification removed",
    mutate: config => {
      overrideFor(config, expectedTestFiles).files = expectedTestFiles.filter(
        file => file !== "config/**/*.test.ts"
      );
    },
  },
  {
    label: "cognitive complexity loosened",
    mutate: config => {
      config.rules["sonarjs/cognitive-complexity"] = ["error", 13];
    },
  },
  {
    label: "type-only imports exempted",
    mutate: config => {
      config.rules["import/max-dependencies"] = [
        "error",
        { max: 10, ignoreTypeImports: true },
      ];
    },
  },
  {
    label: "pure barrel rule disabled",
    mutate: config => {
      config.rules["typeweaver/pure-barrel"] = "off";
    },
  },
  {
    label: "pure barrel rule downgraded",
    mutate: config => {
      config.rules["typeweaver/pure-barrel"] = "warn";
    },
  },
  {
    label: "generated output no longer excluded",
    mutate: config => {
      config.ignorePatterns = config.ignorePatterns.filter(
        pattern => pattern !== "packages/test-utils/src/test-project/output/**"
      );
    },
  },
  {
    label: "unanchored output directory exclusion reintroduced",
    mutate: config => {
      config.ignorePatterns.push("**/output/**");
    },
  },
  {
    label: "unsafe type assertions allowed in TypeScript source",
    mutate: config => {
      delete overrideFor(config, expectedTypeScriptFiles).rules[
        "typescript/no-unsafe-type-assertion"
      ];
    },
  },
  {
    label: "unsafe type assertions allowed in tests",
    mutate: config => {
      overrideFor(config, expectedTypedTestFiles).rules[
        "typescript/no-unsafe-type-assertion"
      ] = "warn";
    },
  },
  {
    label: "ts-ignore allowed in TypeScript source",
    mutate: config => {
      overrideFor(config, expectedTypeScriptFiles).rules[
        "typescript/ban-ts-comment"
      ] = [
        "error",
        {
          "ts-expect-error": "allow-with-description",
          "ts-ignore": false,
          "ts-nocheck": true,
          "ts-check": false,
          minimumDescriptionLength: 3,
        },
      ];
    },
  },
  {
    label: "undescribed ts-expect-error allowed in tests",
    mutate: config => {
      overrideFor(config, expectedTypedTestFiles).rules[
        "typescript/ban-ts-comment"
      ] = [
        "error",
        {
          "ts-expect-error": false,
          "ts-ignore": true,
          "ts-nocheck": true,
          "ts-check": false,
          minimumDescriptionLength: 3,
        },
      ];
    },
  },
  {
    label: "test override disables an unsafe rule",
    mutate: config => {
      overrideFor(config, expectedTypedTestFiles).rules[
        "typescript/no-unsafe-assignment"
      ] = "off";
    },
  },
  {
    label: "test override downgrades explicit any",
    mutate: config => {
      overrideFor(config, expectedTypedTestFiles).rules[
        "typescript/no-explicit-any"
      ] = "warn";
    },
  },
  {
    label: "TypeScript override drops an unsafe rule",
    mutate: config => {
      delete overrideFor(config, expectedTypeScriptFiles).rules[
        "typescript/no-unsafe-return"
      ];
    },
  },
  {
    label: "per-file size exception smuggled in",
    mutate: config => {
      config.overrides.push({
        files: ["packages/**/*.ts"],
        rules: { "eslint/max-lines": "off" },
      });
    },
  },
];
