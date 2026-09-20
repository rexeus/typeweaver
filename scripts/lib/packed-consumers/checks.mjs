import assert from "node:assert/strict";
import path from "node:path";
import { run, runNode, runNodeExpectFailure, writeJson } from "./runtime.mjs";

/** @typedef {{ code: string, outcome: string, message: string }} DoctorCheck */
/** @typedef {{ checks: DoctorCheck[] }} DoctorReport */

/**
 * @param {string} fixtureRoot
 * @returns {void}
 */
export const assertDoctorInFixture = fixtureRoot => {
  const output = run({
    args: [
      "exec",
      "typeweaver",
      "doctor",
      "--input",
      "spec/index.ts",
      "--output",
      "generated",
      "--json",
    ],
    cwd: fixtureRoot,
  });
  /** @type {DoctorReport} */
  const report = JSON.parse(output);
  const checks = new Map(report.checks.map(check => [check.code, check]));
  assert.equal(
    checks.get("TW-DOCTOR-008")?.outcome,
    "pass",
    "the CLI's bundled Effect runtime check did not pass"
  );
  const workspaceCheck = checks.get("TW-DOCTOR-011");
  assert(
    workspaceCheck !== undefined,
    "the CLI doctor report omitted TW-DOCTOR-011"
  );
  assert.equal(workspaceCheck.outcome, "pass");
  assert.match(workspaceCheck.message, /exact native Effect 4\.0\.0-rc\.116/u);
};

/**
 * @param {string} fixtureRoot
 * @returns {void}
 */
export const assertPhantomImportsUnavailable = fixtureRoot => {
  for (const packageName of [
    "@rexeus/typeweaver-gen",
    "@rexeus/typeweaver-effect",
  ]) {
    const output = runNodeExpectFailure({
      args: [
        "--input-type=module",
        "--eval",
        `await import(${JSON.stringify(packageName)});`,
      ],
      cwd: fixtureRoot,
    });
    assert.match(output, /ERR_MODULE_NOT_FOUND|Cannot find package/u);
  }
};

/**
 * @param {{ fixtureRoot: string, outputRoot: string }} options
 * @returns {void}
 */
export const typecheckAndRunApp = ({ fixtureRoot, outputRoot }) => {
  const tsconfigPath = path.join(fixtureRoot, "app.tsconfig.json");
  const appDist = path.join(fixtureRoot, "app-dist");
  writeJson(tsconfigPath, {
    compilerOptions: {
      allowJs: true,
      checkJs: false,
      module: "NodeNext",
      moduleResolution: "NodeNext",
      outDir: appDist,
      rootDir: fixtureRoot,
      skipLibCheck: false,
      strict: true,
      target: "ES2024",
      types: ["node"],
    },
    include: [
      path.join(fixtureRoot, "app.ts"),
      path.join(outputRoot, "**/*.ts"),
      path.join(outputRoot, "**/*.mts"),
      path.join(outputRoot, "**/*.js"),
    ],
  });
  run({ args: ["exec", "tsc", "--project", tsconfigPath], cwd: fixtureRoot });
  assert.equal(
    runNode({ args: [path.join(appDist, "app.js")], cwd: fixtureRoot }),
    "effect-app-ok\n"
  );
};
