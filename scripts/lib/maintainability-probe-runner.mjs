import { writeFileSync } from "node:fs";
import path from "node:path";
import { workspaceRoot } from "./lint-policy-contract.mjs";
import { spawnPnpmSync } from "./pnpm-command.mjs";

/** @typedef {{ code: string, filename: string }} LintDiagnostic */
/** @typedef {{ diagnostics: LintDiagnostic[] }} LintOutput */
/** @typedef {import("node:child_process").SpawnSyncReturns<string>} SpawnResult */
/** @typedef {Record<string, unknown>} ProbeConfig */
/**
 * @typedef {object} Boundary
 * @property {string} name
 * @property {string} rule
 * @property {ProbeConfig} config
 * @property {string} valid
 * @property {string} invalid
 * @property {string} directory
 */

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
const isRecord = value => typeof value === "object" && value !== null;

/**
 * @param {unknown} value
 * @returns {value is LintDiagnostic}
 */
const isLintDiagnostic = value =>
  isRecord(value) &&
  typeof value["code"] === "string" &&
  typeof value["filename"] === "string";

/**
 * @param {unknown} value
 * @returns {value is LintOutput}
 */
const isLintOutput = value =>
  isRecord(value) &&
  Array.isArray(value["diagnostics"]) &&
  value["diagnostics"].every(isLintDiagnostic);

/**
 * @param {SpawnResult} result
 * @returns {LintOutput}
 */
const parseLintOutput = result => {
  if (result.error !== undefined) throw result.error;
  try {
    const output = JSON.parse(result.stdout);
    if (!isLintOutput(output)) throw new Error("invalid lint output shape");
    return output;
  } catch (error) {
    throw new Error(
      `Isolated maintainability probe did not return JSON\n${result.stdout}\n${result.stderr}`,
      { cause: error }
    );
  }
};

/**
 * @param {string} directory
 * @param {string} name
 * @param {ProbeConfig} config
 * @returns {string}
 */
const writeConfig = (directory, name, config) => {
  const filePath = path.join(directory, `${name}.oxlintrc.json`);
  writeFileSync(filePath, `${JSON.stringify(config, null, 2)}\n`);
  return filePath;
};

/**
 * @param {string} configPath
 * @param {string} filePath
 * @returns {LintOutput & { status: number | null }}
 */
const runLint = (configPath, filePath) => {
  const result = spawnPnpmSync({
    args: [
      "--silent",
      "exec",
      "oxlint",
      "-c",
      configPath,
      "--format=json",
      filePath,
    ],
    cwd: workspaceRoot,
    encoding: "utf8",
  });
  return { ...parseLintOutput(result), status: result.status };
};

/**
 * @param {LintOutput} output
 * @param {string} filePath
 * @returns {LintDiagnostic[]}
 */
const diagnosticsFor = (output, filePath) =>
  output.diagnostics.filter(
    diagnostic => path.resolve(diagnostic.filename) === filePath
  );

/** @param {Boundary} boundary */
export const assertBoundary = ({
  name,
  rule,
  config,
  valid,
  invalid,
  directory,
}) => {
  const configPath = writeConfig(directory, name, config);
  const validPath = path.join(directory, `${name}.valid.ts`);
  const invalidPath = path.join(directory, `${name}.invalid.ts`);
  writeFileSync(validPath, `${valid}\n`);
  writeFileSync(invalidPath, `${invalid}\n`);

  const validOutput = runLint(configPath, validPath);
  const validDiagnostics = diagnosticsFor(validOutput, validPath);
  if (validDiagnostics.length > 0 || validOutput.status !== 0) {
    throw new Error(
      `${name}: boundary-valid fixture failed ${JSON.stringify(validDiagnostics)}`
    );
  }

  const invalidOutput = runLint(configPath, invalidPath);
  const invalidDiagnostics = diagnosticsFor(invalidOutput, invalidPath);
  if (
    invalidOutput.status === 0 ||
    !invalidDiagnostics.some(diagnostic => diagnostic.code === rule)
  ) {
    throw new Error(
      `${name}: boundary-invalid fixture did not produce ${rule} (got ${JSON.stringify(
        invalidDiagnostics
      )})`
    );
  }
};
