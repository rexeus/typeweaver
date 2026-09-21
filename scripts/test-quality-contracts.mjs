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
  "createPackageBuildConfig.basic.test.ts"
);
const createPackageBuildConfigLifecycleTestPath = path.join(
  tsdownRoot,
  "createPackageBuildConfig.lifecycle.test.ts"
);
const createPackageBuildConfigSupportPath = path.join(
  tsdownRoot,
  "createPackageBuildConfig.test-support.ts"
);

/** @param {{ version: number, total: number, exceptions: { rules: Record<string, number> }[] }} allowlist */
const assertEffectAllowlistTotal = allowlist => {
  assert.equal(allowlist.version, 2);
  assert.equal(
    allowlist.total,
    allowlist.exceptions.reduce(
      (total, entry) =>
        total +
        Object.values(entry.rules).reduce((sum, count) => sum + count, 0),
      0
    )
  );
};

/**
 * @returns {void}
 */
const assertEffectDiagnosticsContract = () => {
  const rootPackage = JSON.parse(
    readFileSync(path.join(workspaceRoot, "package.json"), "utf8")
  );
  const baseline = JSON.parse(
    readFileSync(
      path.join(workspaceRoot, "config/effect-baseline.json"),
      "utf8"
    )
  );
  const allowlist = JSON.parse(
    readFileSync(
      path.join(workspaceRoot, "config/effect-diagnostics-allowlist.json"),
      "utf8"
    )
  );
  const diagnosticsScript = readFileSync(
    path.join(scriptsRoot, "run-effect-diagnostics.mjs"),
    "utf8"
  );
  const diagnosticsLibrary = readFileSync(
    path.join(scriptsRoot, "lib/effect-diagnostics.mjs"),
    "utf8"
  );
  const diagnosticsProjectsLibrary = readFileSync(
    path.join(scriptsRoot, "lib/effect-diagnostics-projects.mjs"),
    "utf8"
  );
  const diagnosticsSources = `${diagnosticsLibrary}${diagnosticsProjectsLibrary}`;
  const oxlintConfig = readFileSync(
    path.join(workspaceRoot, ".oxlintrc.json"),
    "utf8"
  );
  const architectureScript = readFileSync(
    path.join(scriptsRoot, "verify-architecture-contracts.mjs"),
    "utf8"
  );
  assert.equal(
    rootPackage.devDependencies?.["@effect/tsgo"],
    baseline.tsgoVersion
  );
  assert.match(diagnosticsScript, /Effect tsgo/gu);
  assert.match(diagnosticsSources, /recommended\.json/gu);
  assert.match(diagnosticsSources, /--strict/gu);
  assert.match(diagnosticsSources, /shell: false/gu);
  assert.match(diagnosticsSources, /JSON\.stringify/gu);
  assert.match(diagnosticsSources, /discoverEffectProjects/gu);
  assert.match(diagnosticsSources, /assertEffectProjectScope/gu);
  assert.match(diagnosticsSources, /assertEffectDirectiveAllowlist/gu);
  assert.match(diagnosticsSources, /isExcludedEffectPath/gu);
  assertEffectAllowlistTotal(allowlist);
  assert.doesNotMatch(oxlintConfig, /effecttsgo|tsgolint.*preset/giu);
  assert.doesNotMatch(
    `${JSON.stringify(rootPackage)}${diagnosticsScript}${diagnosticsSources}`,
    new RegExp(`@effect/${"language"}-${"service"}`, "u")
  );
  assert.match(architectureScript, /effect:diagnostics/gu);
};

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
    const basicTestPath = path.join(
      fixtureRoot,
      "createPackageBuildConfig.basic.test.ts"
    );
    const lifecycleTestPath = path.join(
      fixtureRoot,
      "createPackageBuildConfig.lifecycle.test.ts"
    );
    cpSync(createPackageBuildConfigPath, sourcePath);
    cpSync(createPackageBuildConfigTestPath, basicTestPath);
    cpSync(createPackageBuildConfigLifecycleTestPath, lifecycleTestPath);
    cpSync(
      createPackageBuildConfigSupportPath,
      path.join(fixtureRoot, "createPackageBuildConfig.test-support.ts")
    );
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

assertEffectDiagnosticsContract();
assertScriptsTypecheckContract();
assertToolingTestContract();

process.stdout.write(
  "Quality task contracts rejected broken scripts typecheck and tsdown build-config fixtures\n"
);
