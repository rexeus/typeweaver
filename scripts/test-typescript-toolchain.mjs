/**
 * Executable contract for the shared TypeScript compiler profiles.
 *
 * Writes throwaway projects that extend each exported profile and asserts the
 * effective compiler options plus the exact diagnostic codes emitted for valid
 * and invalid probes. Positive probes prove the profiles accept correct code;
 * negative probes prove every adopted strict option is still active and that
 * consumer configs inherit it.
 */
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { spawnPnpmSync } from "./lib/pnpm-command.mjs";

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

/**
 * @param {string} configPath
 * @returns {{ readonly status: number | null, readonly output: string }}
 */
const runTsc = configPath => {
  const result = spawnPnpmSync({
    args: ["exec", "tsc", "-p", configPath, "--noEmit"],
    cwd: workspaceRoot,
    encoding: "utf8",
  });
  assert.equal(result.error, undefined, String(result.error));
  return {
    status: result.status,
    output: `${result.stdout}${result.stderr}`,
  };
};

/**
 * @param {string} configPath
 * @returns {Record<string, unknown>}
 */
const effectiveOptions = configPath => {
  const result = spawnPnpmSync({
    args: ["exec", "tsc", "--showConfig", "-p", configPath],
    cwd: workspaceRoot,
    encoding: "utf8",
  });
  assert.equal(result.error, undefined, String(result.error));
  assert.equal(result.status, 0, String(result.stderr));
  const parsed = JSON.parse(String(result.stdout));
  return parsed.compilerOptions;
};

/**
 * @param {string} directory
 * @param {string} name
 * @param {string} profile
 * @param {readonly string[]} include
 * @returns {string}
 */
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

/**
 * @param {string} directory
 * @param {string} name
 * @param {string} source
 * @returns {string}
 */
const writeSource = (directory, name, source) => {
  const sourcePath = path.join(directory, name);
  writeFileSync(sourcePath, source);
  return name;
};

/**
 * @param {readonly (readonly [string, readonly number[]])[]} lines
 * @returns {{ readonly source: string, readonly expected: readonly { readonly line: number, readonly code: number }[] }}
 */
const buildProbe = lines => {
  /** @type {{ line: number, code: number }[]} */
  const expected = [];
  lines.forEach(([, codes], index) => {
    for (const code of codes) {
      expected.push({ line: index + 1, code });
    }
  });
  return {
    source: `${lines.map(line => line[0]).join("\n")}\n`,
    expected,
  };
};

/**
 * @param {{ readonly status: number | null, readonly output: string }} result
 * @param {string} fileName
 * @param {readonly { readonly line: number, readonly code: number }[]} expected
 */
const assertDiagnostics = (result, fileName, expected) => {
  assert.notEqual(
    result.status,
    0,
    `Expected ${fileName} to be rejected but tsc accepted it`
  );
  for (const { line, code } of expected) {
    const pattern = new RegExp(
      `${fileName}\\(${line},\\d+\\): error TS${code}:`,
      "u"
    );
    assert.match(
      result.output,
      pattern,
      `Expected TS${code} at ${fileName}:${line}\n${result.output}`
    );
  }
};

/**
 * @param {{ readonly status: number | null, readonly output: string }} result
 * @param {string} label
 */
const assertAccepted = (result, label) => {
  assert.equal(result.status, 0, `${label} was rejected:\n${result.output}`);
};

const invalidProbe = buildProbe([
  ["export const implicit = (input) => input;", [7006]],
  ["export const nullable: number = undefined;", [2322]],
  ["export const indexed: number = [1][2];", [2322]],
  ["export const optional: { value?: number } = { value: undefined };", [2375]],
  ["export const partial = (yes: boolean) => { if (yes) return 1; };", [7030]],
  ["const unused = 1;", [6133]],
  ["export const unusedParameter = (input: number) => 1;", [6133]],
  ["export class Base { value = 1; }", []],
  ["export class Child extends Base { value = 2; }", [4114]],
  [
    "export const lookup = (items: Record<string, number>) => items.missing;",
    [4111],
  ],
  ["export enum RuntimeEnum { First }", []],
  [
    "export const unreachable = (): number => { return 1; throw new Error(); };",
    [7027],
  ],
  [
    "export const fallthrough = (value: number): number => { switch(value) { case 1: value++; case 2: return value; default: return 0; } };",
    [7029],
  ],
  [
    "export const unknownCatch = (): string => { try { throw new Error(); } catch (error) { return error.message; } };",
    [18046],
  ],
  ["export const implicitThis = function () { return this.value; };", [2683]],
  ["export class NeedsInit { value: number; }", [2564]],
  ["export type NarrowFn = (value: string) => void;", []],
  ["export type BroadFn = (value: string | number) => void;", []],
  ["export const narrow: NarrowFn = (value: string) => { void value; };", []],
  ["export const broad: BroadFn = narrow;", [2322]],
  ["export const callOn = (): number => {", []],
  ["  const fn = (value: number): number => value;", []],
  ['  return fn.call(undefined, "text");', [2345]],
  ["};", []],
  ['import { Widget } from "./types.js";', [1484]],
  ["export type OnlyType = Widget;", []],
  ['import "./missing-side-effect.js";', [2882]],
]);

const validCoreSource = [
  "export const total = (values: readonly number[]): number =>",
  "  values.reduce((sum, value) => sum + value, 0);",
  "export const optional: { readonly value?: number | undefined } = {",
  "  value: undefined,",
  "};",
  "export class Base { readonly value: number = 1; }",
  "export class Child extends Base { override readonly value: number = 2; }",
  'import type { Widget } from "./types.js";',
  "export type OnlyType = Widget;",
  "export const fallthrough = (value: number): number => {",
  "  switch (value) {",
  "    case 1:",
  "      return 1;",
  "    default:",
  "      return 0;",
  "  }",
  "};",
  "",
].join("\n");

const validNodeSource = [
  'import path from "node:path";',
  "export const pid: number = process.pid;",
  'export const buffer: Buffer = Buffer.from("x");',
  'export const joined: string = path.join("a", "b");',
  "",
].join("\n");

const nodeOnlySource = ["export const pid: number = process.pid;", ""].join(
  "\n"
);

const checkJsInvalid = buildProbe([
  ['/** @type {number} */ export const value = "text";', [2322]],
  ["", []],
  [
    "/** @type {{ readonly value?: number }} */ export const optional = { value: undefined };",
    [2375],
  ],
]);

const validCheckJsSource = [
  "/** @type {number} */ export const value = 1;",
  "/** @type {string} */ export const text = String(value);",
  "",
].join("\n");

const strictOptionMatrix = [
  "strict",
  "alwaysStrict",
  "strictBindCallApply",
  "strictFunctionTypes",
  "strictNullChecks",
  "strictPropertyInitialization",
  "noImplicitAny",
  "noImplicitThis",
  "noImplicitOverride",
  "noImplicitReturns",
  "noUncheckedIndexedAccess",
  "exactOptionalPropertyTypes",
  "noPropertyAccessFromIndexSignature",
  "noUncheckedSideEffectImports",
  "useUnknownInCatchVariables",
  "noFallthroughCasesInSwitch",
  "noUnusedLocals",
  "noUnusedParameters",
  "verbatimModuleSyntax",
  "isolatedModules",
];

/**
 * @param {Record<string, unknown>} options
 * @param {string} label
 */
const assertStrictMatrix = (options, label) => {
  for (const name of strictOptionMatrix) {
    assert.equal(options[name], true, `${label} must enable ${name}`);
  }
  assert.equal(
    options["allowUnreachableCode"],
    false,
    `${label} allowUnreachableCode`
  );
  assert.equal(
    String(options["module"]).toLowerCase(),
    "nodenext",
    `${label} module`
  );
  assert.equal(
    String(options["moduleResolution"]).toLowerCase(),
    "nodenext",
    `${label} moduleResolution`
  );
  assert.equal(
    String(options["moduleDetection"]).toLowerCase(),
    "force",
    `${label} moduleDetection`
  );
  assert.equal(
    String(options["target"]).toLowerCase(),
    "esnext",
    `${label} target`
  );
};

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

  // The base profile is environment-neutral: strict rules are active, but Node
  // globals are not available until a runtime profile adds them.
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
  const baseNodeConfig = writeConfig(fixtureRoot, "base-node", profiles.base, [
    "probe-node-only.ts",
  ]);
  assertDiagnostics(runTsc(baseNodeConfig), "probe-node-only.ts", [
    { line: 1, code: 2591 },
  ]);

  // The Node runtime profile adds the Node type library.
  assertAccepted(
    runTsc(
      writeConfig(fixtureRoot, "node-valid", profiles.node, [
        "probe-valid-core.ts",
        "probe-valid-node.ts",
      ])
    ),
    "node valid probe"
  );

  // The root config inherits the Node profile, so the full strict matrix stays
  // active for every workspace consumer.
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

  // The checked-JavaScript profile typechecks .js tooling under the same
  // strict rules and accepts valid JSDoc-annotated code.
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

  // Resolved options prove inheritance even if a compiler default changes.
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
