import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { ruleCases } from "./maintainability-fixtures.mjs";
import { spawnPnpmSync } from "./pnpm-command.mjs";

/** @typedef {{ diagnostics: { filename: string, code: string }[] }} LintOutput */
/** @typedef {LintOutput & { status: number | null }} LintResult */

/** @param {import("node:child_process").SpawnSyncReturns<string>} result @returns {LintOutput} */
const parseLintOutput = result => {
  if (result.error !== undefined) throw result.error;
  try {
    return JSON.parse(result.stdout);
  } catch (error) {
    throw new Error(
      `pnpm lint did not return JSON\n${result.stdout}\n${result.stderr}`,
      { cause: error }
    );
  }
};
/** @param {string} workspaceRoot @returns {LintResult} */
const runLint = workspaceRoot => {
  const result = spawnPnpmSync({
    args: ["--silent", "run", "lint", "--format=json"],
    cwd: workspaceRoot,
    encoding: "utf8",
    maxBuffer: 50 * 1024 * 1024,
  });
  return { ...parseLintOutput(result), status: result.status };
};
/** @param {string} directory @param {"valid" | "invalid"} kind @returns {void} */
const writeFixtures = (directory, kind) => {
  for (const ruleCase of ruleCases)
    writeFileSync(
      path.join(directory, `${ruleCase.name}.ts`),
      `${ruleCase[kind]}\n`
    );
};
/** @param {LintResult} result @param {string} fixtureRoot @param {string} workspaceRoot @returns {{ filename: string, code: string }[]} */
const fixtureDiagnostics = (result, fixtureRoot, workspaceRoot) =>
  result.diagnostics.filter(diagnostic =>
    path
      .resolve(workspaceRoot, diagnostic.filename)
      .startsWith(`${fixtureRoot}${path.sep}`)
  );
/** @param {LintResult} result @param {string} fixtureRoot @param {string} workspaceRoot @returns {void} */
const assertValidFixtures = (result, fixtureRoot, workspaceRoot) => {
  const diagnostics = fixtureDiagnostics(result, fixtureRoot, workspaceRoot);
  if (diagnostics.length > 0)
    throw new Error(
      `Valid maintainability fixtures failed:\n${JSON.stringify(diagnostics, null, 2)}`
    );
};
/** @param {LintResult} result @param {string} fixtureRoot @param {string} workspaceRoot @returns {void} */
const assertInvalidFixtures = (result, fixtureRoot, workspaceRoot) => {
  const actual = fixtureDiagnostics(result, fixtureRoot, workspaceRoot)
    .map(diagnostic => [
      path.basename(diagnostic.filename, ".ts"),
      diagnostic.code,
    ])
    .sort();
  const expected = ruleCases
    .map(ruleCase => [ruleCase.name, ruleCase.diagnostic])
    .sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected))
    throw new Error(
      `Maintainability mutations did not produce the exact rule matrix.\nExpected: ${JSON.stringify(expected)}\nActual: ${JSON.stringify(actual)}`
    );
  if (result.status === 0)
    throw new Error("pnpm lint accepted the invalid maintainability fixtures");
};

/** @param {string} workspaceRoot @returns {void} */
export const runMaintainabilityFixtures = workspaceRoot => {
  const fixtureRoot = mkdtempSync(
    path.join(workspaceRoot, "scripts", ".maintainability-run-")
  );
  let validResult;
  try {
    writeFixtures(fixtureRoot, "valid");
    validResult = runLint(workspaceRoot);
    assertValidFixtures(validResult, fixtureRoot, workspaceRoot);
    writeFixtures(fixtureRoot, "invalid");
    assertInvalidFixtures(runLint(workspaceRoot), fixtureRoot, workspaceRoot);
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
  if (validResult === undefined)
    throw new Error("The maintainability fixture run did not produce a result");
  if (validResult.status !== 0)
    throw new Error(
      "The maintainability mutations passed, but the authored repository still fails pnpm lint"
    );
};
