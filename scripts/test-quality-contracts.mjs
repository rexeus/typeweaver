import assert from "node:assert/strict";
import {
  cpSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { spawnPnpmSync } from "./lib/pnpm-command.mjs";

/**
 * Proves the two repository-wide quality tasks are load-bearing. Each guard
 * stages a throwaway copy of the real contract, breaks one contract, and
 * requires the task to reject the broken copy. A weakened task (disabled
 * `checkJs`, removed test, softened assertion) would make the guard fail.
 */

const workspaceRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const scriptsRoot = path.join(workspaceRoot, "scripts");
const tsdownRoot = path.join(workspaceRoot, "config", "tsdown");
const scriptsTsconfigPath = path.join(scriptsRoot, "tsconfig.json");
const createPackageBuildConfigPath = path.join(
  tsdownRoot,
  "createPackageBuildConfig.mjs"
);
const createPackageBuildConfigTestPath = path.join(
  tsdownRoot,
  "createPackageBuildConfig.test.ts"
);

/**
 * @param {readonly string[]} args
 * @returns {import("node:child_process").SpawnSyncReturns<string>}
 */
const runPnpm = args =>
  spawnPnpmSync({
    args,
    cwd: workspaceRoot,
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
  });

/**
 * @param {import("node:child_process").SpawnSyncReturns<string>} result
 * @returns {string}
 */
const describeResult = result => `${result.stdout}${result.stderr}`;

/**
 * @returns {void}
 */
const assertScriptsTypecheckContract = () => {
  const fixtureRoot = mkdtempSync(
    path.join(scriptsRoot, ".scripts-typecheck-contract-")
  );
  try {
    writeFileSync(
      path.join(fixtureRoot, "tsconfig.json"),
      readFileSync(scriptsTsconfigPath, "utf8")
    );
    writeFileSync(
      path.join(fixtureRoot, "valid-tool.mjs"),
      "export const value = 1;\n"
    );
    const accepted = runPnpm([
      "exec",
      "tsc",
      "--noEmit",
      "-p",
      path.join(fixtureRoot, "tsconfig.json"),
    ]);
    assert.equal(
      accepted.status,
      0,
      `typecheck:scripts rejected valid JSDoc tooling: ${describeResult(accepted)}`
    );

    writeFileSync(
      path.join(fixtureRoot, "broken-tool.mjs"),
      "export const broken = (input) => input;\n"
    );
    const rejected = runPnpm([
      "exec",
      "tsc",
      "--noEmit",
      "-p",
      path.join(fixtureRoot, "tsconfig.json"),
    ]);
    assert.notEqual(
      rejected.status,
      0,
      "typecheck:scripts accepted an implicit-any tooling module"
    );
    assert.match(describeResult(rejected), /TS7006/u);
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
};

/**
 * @returns {void}
 */
const assertToolingTestContract = () => {
  const fixtureRoot = mkdtempSync(
    path.join(tsdownRoot, ".tooling-test-contract-")
  );
  try {
    const sourcePath = path.join(fixtureRoot, "createPackageBuildConfig.mjs");
    const testPath = path.join(fixtureRoot, "createPackageBuildConfig.test.ts");
    cpSync(createPackageBuildConfigPath, sourcePath);
    cpSync(createPackageBuildConfigTestPath, testPath);
    const relativeFixtureRoot = path.relative(workspaceRoot, fixtureRoot);

    const accepted = runPnpm(["exec", "vitest", "--run", relativeFixtureRoot]);
    assert.equal(
      accepted.status,
      0,
      `test:tooling rejected its intact contract: ${describeResult(accepted)}`
    );

    const source = readFileSync(sourcePath, "utf8");
    const brokenSource = source.replace(
      "treeshake: true,",
      "treeshake: false,"
    );
    assert.notEqual(
      brokenSource,
      source,
      "could not break the createPackageBuildConfig contract for the guard"
    );
    writeFileSync(sourcePath, brokenSource);

    const rejected = runPnpm(["exec", "vitest", "--run", relativeFixtureRoot]);
    assert.notEqual(
      rejected.status,
      0,
      "test:tooling accepted a broken createPackageBuildConfig contract"
    );
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
};

assertScriptsTypecheckContract();
assertToolingTestContract();

process.stdout.write(
  "Quality task contracts rejected broken scripts typecheck and tsdown build-config fixtures\n"
);
