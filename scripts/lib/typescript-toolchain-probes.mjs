import assert from "node:assert/strict";

export const invalidProbe = {
  source: [
    "export const implicit = (input) => input;",
    "export const nullable: number = undefined;",
    "export const indexed: number = [1][2];",
    "export const optional: { value?: number } = { value: undefined };",
    "export const partial = (yes: boolean) => { if (yes) return 1; };",
    "const unused = 1;",
    "export const unusedParameter = (input: number) => 1;",
    "export class Base { value = 1; }",
    "export class Child extends Base { value = 2; }",
    "export const lookup = (items: Record<string, number>) => items.missing;",
    "export enum RuntimeEnum { First }",
    "export const unreachable = (): number => { return 1; throw new Error(); };",
    "export const fallthrough = (value: number): number => { switch(value) { case 1: value++; case 2: return value; default: return 0; } };",
    "export const unknownCatch = (): string => { try { throw new Error(); } catch (error) { return error.message; } };",
    "export const implicitThis = function () { return this.value; };",
    "export class NeedsInit { value: number; }",
    "export type NarrowFn = (value: string) => void;",
    "export type BroadFn = (value: string | number) => void;",
    "export const narrow: NarrowFn = (value: string) => { void value; };",
    "export const broad: BroadFn = narrow;",
    "export const callOn = (): number => {",
    "  const fn = (value: number): number => value;",
    '  return fn.call(undefined, "text");',
    "};",
    'import { Widget } from "./types.js";',
    "export type OnlyType = Widget;",
    'import "./missing-side-effect.js";',
    "",
  ].join("\n"),
  expected: [
    { line: 1, code: 7006 },
    { line: 2, code: 2322 },
    { line: 3, code: 2322 },
    { line: 4, code: 2375 },
    { line: 5, code: 7030 },
    { line: 6, code: 6133 },
    { line: 7, code: 6133 },
    { line: 9, code: 4114 },
    { line: 10, code: 4111 },
    { line: 12, code: 7027 },
    { line: 13, code: 7029 },
    { line: 14, code: 18046 },
    { line: 15, code: 2683 },
    { line: 16, code: 2564 },
    { line: 20, code: 2322 },
    { line: 23, code: 2345 },
    { line: 25, code: 1484 },
    { line: 27, code: 2882 },
  ],
};
export const validCoreSource = `export const total = (values: readonly number[]): number => values.reduce((sum, value) => sum + value, 0);\nexport const optional: { readonly value?: number | undefined } = { value: undefined };\nexport class Base { readonly value: number = 1; }\nexport class Child extends Base { override readonly value: number = 2; }\nimport type { Widget } from "./types.js";\nexport type OnlyType = Widget;\nexport const fallthrough = (value: number): number => { switch (value) { case 1: return 1; default: return 0; } };\n`;
export const validNodeSource =
  'import path from "node:path";\nexport const pid: number = process.pid;\nexport const buffer: Buffer = Buffer.from("x");\nexport const joined: string = path.join("a", "b");\n';
export const nodeOnlySource = "export const pid: number = process.pid;\n";
export const checkJsInvalid = {
  source:
    '/** @type {number} */ export const value = "text";\n\n/** @type {{ readonly value?: number }} */ export const optional = { value: undefined };\n',
  expected: [
    { line: 1, code: 2322 },
    { line: 3, code: 2375 },
  ],
};
export const validCheckJsSource =
  "/** @type {number} */ export const value = 1;\n/** @type {string} */ export const text = String(value);\n";
export const strictOptionMatrix = [
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

/** @param {Record<string, unknown>} options @param {string} label @returns {void} */
export const assertStrictMatrix = (options, label) => {
  for (const name of strictOptionMatrix)
    assert.equal(options[name], true, `${label} must enable ${name}`);
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
