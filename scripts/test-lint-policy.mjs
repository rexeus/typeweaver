import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { assertLintPolicyConfiguration } from "./lib/lint-policy-contract.mjs";
import {
  assertConfigurationWeakeningDetection,
  assertLintPolicyProbes,
  writeDependencyFixtures,
  writeTestScopeFixtures,
  writeUnusedDisableFixture,
} from "./lib/lint-policy-probes.mjs";
import {
  assertCases,
  assertCycleCase,
  cases,
  classInvalidFixture,
  classValidFixture,
  importTarget,
} from "./lib/lint-policy-test-cases.mjs";
import { spawnPnpmSync } from "./lib/pnpm-command.mjs";

const workspaceRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
assertLintPolicyConfiguration();

/** @param {import("node:child_process").SpawnSyncReturns<string>} result @returns {{ diagnostics: { code: string, filename: string, message: string, severity: string }[] }} */
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
const runRootLint = () =>
  parseLintOutput(
    spawnPnpmSync({
      args: ["--silent", "run", "lint", "--format=json"],
      cwd: workspaceRoot,
      encoding: "utf8",
      maxBuffer: 50 * 1024 * 1024,
    })
  ).diagnostics;
const fixtureRoot = mkdtempSync(
  path.join(workspaceRoot, "packages", "test-utils", ".lint-policy-run-")
);
try {
  mkdirSync(fixtureRoot, { recursive: true });
  writeFileSync(
    path.join(fixtureRoot, "package.json"),
    JSON.stringify({ type: "module" }, null, 2)
  );
  writeFileSync(
    path.join(fixtureRoot, "tsconfig.json"),
    JSON.stringify(
      {
        extends: "@rexeus/typeweaver-tsconfig/node.json",
        include: ["**/*.ts"],
      },
      null,
      2
    )
  );
  writeFileSync(path.join(fixtureRoot, "importTarget.ts"), importTarget);
  writeDependencyFixtures(fixtureRoot);
  for (const testCase of cases) {
    writeFileSync(
      path.join(fixtureRoot, `${testCase.name}.valid.ts`),
      testCase.valid
    );
    writeFileSync(
      path.join(fixtureRoot, `${testCase.name}.invalid.ts`),
      testCase.invalid
    );
  }
  writeFileSync(
    path.join(fixtureRoot, "prefer-node-protocol.valid.ts"),
    classValidFixture
  );
  writeFileSync(
    path.join(fixtureRoot, "prefer-node-protocol.invalid.ts"),
    classInvalidFixture
  );
  writeFileSync(
    path.join(fixtureRoot, "no-cycle.part-a.ts"),
    'import { partB } from "./no-cycle.part-b.js";\nexport const partA = partB;\n'
  );
  writeFileSync(
    path.join(fixtureRoot, "no-cycle.part-b.ts"),
    'import { partA } from "./no-cycle.part-a.js";\nexport const partB = partA;\n'
  );
  writeTestScopeFixtures(fixtureRoot);
  writeUnusedDisableFixture(fixtureRoot);
  const diagnostics = runRootLint();
  assertCases(cases, diagnostics, fixtureRoot, workspaceRoot);
  assertCycleCase(diagnostics, fixtureRoot, workspaceRoot);
  assertLintPolicyProbes(diagnostics, fixtureRoot);
} finally {
  rmSync(fixtureRoot, { recursive: true, force: true });
}
const weakeningChecks = assertConfigurationWeakeningDetection();
process.stdout.write(
  `Verified ${cases.length + 1} lint rules, test-scope and unused-disable enforcement, deny-warnings, and ${weakeningChecks} configuration-weakening rejections\n`
);
