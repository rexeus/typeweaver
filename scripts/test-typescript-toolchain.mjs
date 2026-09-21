import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnPnpmSync } from "./lib/pnpm-command.mjs";
import {
  assertStrictMatrix,
  checkJsInvalid,
  invalidProbe,
  nodeOnlySource,
  strictOptionMatrix,
  validCheckJsSource,
  validCoreSource,
  validNodeSource,
} from "./lib/typescript-toolchain-probes.mjs";

const workspaceRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const profiles = {
  base: "packages/tsconfig/base.json",
  node: "packages/tsconfig/node.json",
  checkjs: "packages/tsconfig/checkjs.json",
  root: "tsconfig.json",
};
/** @param {string} configPath @returns {{ status: number | null, output: string }} */
const runTsc = configPath => {
  const result = spawnPnpmSync({
    args: ["exec", "tsc", "-p", configPath, "--noEmit"],
    cwd: workspaceRoot,
    encoding: "utf8",
  });
  assert.equal(result.error, undefined, String(result.error));
  return { status: result.status, output: `${result.stdout}${result.stderr}` };
};
/** @param {string} configPath @returns {Record<string, unknown>} */
const effectiveOptions = configPath => {
  const result = spawnPnpmSync({
    args: ["exec", "tsc", "--showConfig", "-p", configPath],
    cwd: workspaceRoot,
    encoding: "utf8",
  });
  assert.equal(result.error, undefined, String(result.error));
  assert.equal(result.status, 0, String(result.stderr));
  return JSON.parse(result.stdout).compilerOptions;
};
/** @param {string} directory @param {string} name @param {string} profile @param {readonly string[]} include @returns {string} */
const writeConfig = (directory, name, profile, include) => {
  const configPath = path.join(directory, `${name}.json`);
  writeFileSync(
    configPath,
    JSON.stringify({
      extends: path.join(workspaceRoot, profile),
      compilerOptions: { incremental: false },
      include,
    })
  );
  return configPath;
};
/** @param {string} directory @param {string} name @param {string} source @returns {string} */
const writeSource = (directory, name, source) => {
  writeFileSync(path.join(directory, name), source);
  return name;
};
/** @param {{ status: number | null, output: string }} result @param {string} fileName @param {readonly { line: number, code: number }[]} expected @returns {void} */
const assertDiagnostics = (result, fileName, expected) => {
  assert.notEqual(
    result.status,
    0,
    `Expected ${fileName} to be rejected but tsc accepted it`
  );
  for (const { line, code } of expected)
    assert.match(
      result.output,
      new RegExp(`${fileName}\\(${line},\\d+\\): error TS${code}:`, "u")
    );
};
/** @param {{ status: number | null, output: string }} result @param {string} label @returns {void} */
const assertAccepted = (result, label) =>
  assert.equal(result.status, 0, `${label} was rejected:\n${result.output}`);
const fixtureRoot = mkdtempSync(
  path.join(workspaceRoot, "scripts", ".typescript-toolchain-run-")
);
try {
  writeFileSync(
    path.join(fixtureRoot, "package.json"),
    `${JSON.stringify({ type: "module" }, null, 2)}\n`
  );
  writeSource(
    fixtureRoot,
    "types.ts",
    "export type Widget = { readonly id: string };\n"
  );
  writeSource(fixtureRoot, "probe-invalid.ts", invalidProbe.source);
  writeSource(fixtureRoot, "probe-valid-core.ts", validCoreSource);
  writeSource(fixtureRoot, "probe-valid-node.ts", validNodeSource);
  writeSource(fixtureRoot, "probe-node-only.ts", nodeOnlySource);
  writeSource(fixtureRoot, "probe-invalid.js", checkJsInvalid.source);
  writeSource(fixtureRoot, "probe-valid.js", validCheckJsSource);
  const baseConfig = writeConfig(fixtureRoot, "base", profiles.base, [
    "probe-invalid.ts",
  ]);
  assertDiagnostics(
    runTsc(baseConfig),
    "probe-invalid.ts",
    invalidProbe.expected
  );
  assertAccepted(
    runTsc(
      writeConfig(fixtureRoot, "base-valid", profiles.base, [
        "probe-valid-core.ts",
      ])
    ),
    "base valid probe"
  );
  assertDiagnostics(
    runTsc(
      writeConfig(fixtureRoot, "base-node", profiles.base, [
        "probe-node-only.ts",
      ])
    ),
    "probe-node-only.ts",
    [{ line: 1, code: 2591 }]
  );
  assertAccepted(
    runTsc(
      writeConfig(fixtureRoot, "node-valid", profiles.node, [
        "probe-valid-core.ts",
        "probe-valid-node.ts",
      ])
    ),
    "node valid probe"
  );
  const rootConfig = writeConfig(fixtureRoot, "root", profiles.root, [
    "probe-invalid.ts",
  ]);
  assertDiagnostics(
    runTsc(rootConfig),
    "probe-invalid.ts",
    invalidProbe.expected
  );
  assertAccepted(
    runTsc(
      writeConfig(fixtureRoot, "root-valid", profiles.root, [
        "probe-valid-core.ts",
        "probe-valid-node.ts",
      ])
    ),
    "root valid probe"
  );
  const checkJsConfig = writeConfig(fixtureRoot, "checkjs", profiles.checkjs, [
    "probe-invalid.js",
  ]);
  assertDiagnostics(
    runTsc(checkJsConfig),
    "probe-invalid.js",
    checkJsInvalid.expected
  );
  assertAccepted(
    runTsc(
      writeConfig(fixtureRoot, "checkjs-valid", profiles.checkjs, [
        "probe-valid.js",
      ])
    ),
    "checkjs valid probe"
  );
  const baseOptions = effectiveOptions(baseConfig);
  assertStrictMatrix(baseOptions, "base profile");
  assert.deepEqual(
    baseOptions["types"],
    [],
    "base profile must not assume ambient types"
  );
  const rootOptions = effectiveOptions(rootConfig);
  assertStrictMatrix(rootOptions, "root config");
  assert.deepEqual(
    rootOptions["types"],
    ["node"],
    "root config must include node types"
  );
  const checkJsOptions = effectiveOptions(checkJsConfig);
  assert.equal(
    checkJsOptions["allowJs"],
    true,
    "checkjs profile must allow JavaScript"
  );
  assert.equal(
    checkJsOptions["checkJs"],
    true,
    "checkjs profile must check JavaScript"
  );
  assert.equal(checkJsOptions["noEmit"], true, "checkjs profile must not emit");
  assert.deepEqual(
    checkJsOptions["types"],
    ["node"],
    "checkjs profile must include node types"
  );
} finally {
  rmSync(fixtureRoot, { recursive: true, force: true });
}
process.stdout.write(
  `Verified ${strictOptionMatrix.length} shared compiler options and ${invalidProbe.expected.length} diagnostics across ${Object.keys(profiles).length} profiles\n`
);
