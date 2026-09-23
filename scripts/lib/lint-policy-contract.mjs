import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { assertLintPolicyConfiguration as assertConfig } from "./lint-policy-assertions.mjs";

/**
 * @typedef {object} LintOverride
 * @property {string[]} [files]
 * @property {string[]} [excludeFiles]
 * @property {string[]} [plugins]
 * @property {Record<string, unknown>} rules
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

/** @returns {LintConfig} */
export const readLintConfig = () =>
  JSON.parse(readFileSync(path.join(workspaceRoot, ".oxlintrc.json"), "utf8"));

/** @param {LintConfig} [config] @returns {void} */
export const assertLintPolicyConfiguration = (config = readLintConfig()) =>
  assertConfig(config);

export { workspaceRoot };
