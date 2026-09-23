import path from "node:path";

export const importTarget = [
  "export const namedTarget = 1;",
  "export type Target = number;",
  "export default function target(): number {",
  "  return namedTarget;",
  "}",
  "",
].join("\n");
export const classValidFixture =
  'import { readFileSync } from "node:fs";\nexport const value: unknown = readFileSync;\n';
export const classInvalidFixture =
  'import { readFileSync } from "fs";\nexport const value: unknown = readFileSync;\n';
const describedExpectError =
  '// @ts-expect-error a string literal is not a number\nexport const value: number = "text";\n';

/** @type {{ name: string, rule: string, valid: string, invalid: string }[]} */
export const cases = [
  [
    "no-explicit-any",
    "typescript(no-explicit-any)",
    "export const value: unknown = 1;\n",
    "export const value: any = 1;\n",
  ],
  [
    "no-floating-promises",
    "typescript(no-floating-promises)",
    "export const run = (): void => {\n  void Promise.resolve(1);\n};\n",
    "export const run = (): void => {\n  Promise.resolve(1);\n};\n",
  ],
  [
    "no-misused-promises",
    "typescript(no-misused-promises)",
    "const invoke = (callback: () => Promise<void>): void => { void callback(); };\nexport const run = (): void => { invoke(async () => {}); };\n",
    "const invoke = (callback: () => void): void => { callback(); };\nexport const run = (): void => { invoke(async () => {}); };\n",
  ],
  [
    "no-non-null-assertion",
    "typescript(no-non-null-assertion)",
    "export const length = (value: string | undefined): number => value === undefined ? 0 : value.length;\n",
    "export const length = (value: string | undefined): number => value!.length;\n",
  ],
  [
    "no-unsafe-argument",
    "typescript(no-unsafe-argument)",
    "declare const source: unknown; const accept = (input: unknown): unknown => input; export const passed = accept(source);\n",
    "declare const source: any; const accept = (input: string): string => input; export const passed = accept(source);\n",
  ],
  [
    "no-unsafe-assignment",
    "typescript(no-unsafe-assignment)",
    "declare const source: unknown; export const assigned: unknown = source;\n",
    "declare const source: any; export const assigned: string = source;\n",
  ],
  [
    "no-unsafe-call",
    "typescript(no-unsafe-call)",
    "declare const source: () => unknown; export const called: unknown = source();\n",
    "declare const source: any; export const called: unknown = source();\n",
  ],
  [
    "no-unsafe-member-access",
    "typescript(no-unsafe-member-access)",
    "declare const source: { readonly member: unknown }; export const member: unknown = source.member;\n",
    "declare const source: any; export const member: unknown = source.member;\n",
  ],
  [
    "no-unsafe-return",
    "typescript(no-unsafe-return)",
    "declare const source: unknown; export const getValue = (): unknown => source;\n",
    "declare const source: any; export const getValue = (): string => source;\n",
  ],
  [
    "switch-exhaustiveness-check",
    "typescript(switch-exhaustiveness-check)",
    'type Kind = "a" | "b"; export const describe = (kind: Kind): number => { switch (kind) { case "a": return 1; case "b": return 2; } };\n',
    'type Kind = "a" | "b"; export const describe = (kind: Kind): number => { switch (kind) { case "a": return 1; default: return 0; } };\n',
  ],
  [
    "ban-ts-ignore",
    "typescript(ban-ts-comment)",
    describedExpectError,
    '// @ts-ignore\nexport const value: number = "text";\n',
  ],
  [
    "ban-ts-nocheck",
    "typescript(ban-ts-comment)",
    describedExpectError,
    '// @ts-nocheck\nexport const value: number = "text";\n',
  ],
  [
    "ban-undescribed-ts-expect-error",
    "typescript(ban-ts-comment)",
    describedExpectError,
    '// @ts-expect-error\nexport const value: number = "text";\n',
  ],
  [
    "no-eval",
    "eslint(no-eval)",
    "export const run = (): unknown => 1;\n",
    'export const run = (): unknown => eval("1");\n',
  ],
  [
    "no-implied-eval",
    "eslint(no-implied-eval)",
    "export const run = (): void => { setTimeout(() => undefined, 0); };\n",
    'export const run = (): void => { setTimeout("1", 0); };\n',
  ],
  [
    "no-new-func",
    "eslint(no-new-func)",
    "export const run = (): unknown => 1;\n",
    'export const run = (): unknown => new Function("return 1")();\n',
  ],
  [
    "no-duplicates",
    "import(no-duplicates)",
    'import { readFileSync, writeFileSync } from "node:fs"; export const value = [readFileSync, writeFileSync];\n',
    'import { readFileSync } from "node:fs"; import { writeFileSync } from "node:fs"; export const value = [readFileSync, writeFileSync];\n',
  ],
  [
    "no-namespace",
    "import(no-namespace)",
    'import { readFileSync } from "node:fs"; export const value = readFileSync;\n',
    'import * as fs from "node:fs"; export const value = fs;\n',
  ],
  [
    "no-unassigned-import",
    "import(no-unassigned-import)",
    'import { namedTarget } from "./importTarget.js"; export const value = namedTarget;\n',
    'import "./importTarget.js"; export const value = 1;\n',
  ],
  [
    "consistent-type-specifier-style",
    "import(consistent-type-specifier-style)",
    'import { namedTarget } from "./importTarget.js"; import type { Target } from "./importTarget.js"; export const value: Target = namedTarget;\n',
    'import { type Target, namedTarget } from "./importTarget.js"; export const value: Target = namedTarget;\n',
  ],
  [
    "no-named-default",
    "import(no-named-default)",
    'import target from "./importTarget.js"; export const value = target;\n',
    'import { default as target } from "./importTarget.js"; export const value = target;\n',
  ],
  [
    "no-self-import",
    "import(no-self-import)",
    "export const value = 1;\n",
    'import { value as selfValue } from "./no-self-import.invalid.js"; export const value = 1; export const other = selfValue;\n',
  ],
  [
    "max-dependencies",
    "import(max-dependencies)",
    `${Array.from({ length: 10 }, (_, index) => `import { dependency${index} } from "./dependency${index}.js";`).join("\n")}\n`,
    `${Array.from({ length: 11 }, (_, index) => `import { dependency${index} } from "./dependency${index}.js";`).join("\n")}\n`,
  ],
  [
    "prefer-node-protocol",
    "unicorn(prefer-node-protocol)",
    classValidFixture,
    classInvalidFixture,
  ],
].map(tuple => ({
  name: String(tuple[0]),
  rule: String(tuple[1]),
  valid: String(tuple[2]),
  invalid: String(tuple[3]),
}));

/** @param {readonly { name: string, rule: string }[]} lintCases @param {readonly { code: string, filename: string }[]} diagnostics @param {string} fixtureRoot @param {string} workspaceRoot @returns {void} */
export const assertCases = (
  lintCases,
  diagnostics,
  fixtureRoot,
  workspaceRoot
) => {
  const failures = [];
  for (const testCase of lintCases) {
    for (const [suffix, shouldBeClean] of [
      ["valid", true],
      ["invalid", false],
    ]) {
      const filePath = path.join(fixtureRoot, `${testCase.name}.${suffix}.ts`);
      const found = diagnostics.filter(
        diagnostic =>
          path.resolve(workspaceRoot, diagnostic.filename) === filePath
      );
      if (shouldBeClean && found.length > 0)
        failures.push(
          `${testCase.name}: valid fixture produced ${JSON.stringify(found.map(diagnostic => diagnostic.code))}`
        );
      if (
        !shouldBeClean &&
        !found.some(diagnostic => diagnostic.code === testCase.rule)
      )
        failures.push(
          `${testCase.name}: invalid fixture did not produce ${testCase.rule} (got ${JSON.stringify(found.map(diagnostic => diagnostic.code))})`
        );
    }
  }
  if (failures.length > 0)
    throw new Error(`Lint policy failures:\n${failures.join("\n")}`);
};

/** @param {readonly { code: string, filename: string }[]} diagnostics @param {string} fixtureRoot @param {string} workspaceRoot @returns {void} */
export const assertCycleCase = (diagnostics, fixtureRoot, workspaceRoot) => {
  const filePath = path.join(fixtureRoot, "no-cycle.part-a.ts");
  const found = diagnostics.filter(
    diagnostic => path.resolve(workspaceRoot, diagnostic.filename) === filePath
  );
  if (!found.some(diagnostic => diagnostic.code === "import(no-cycle)"))
    throw new Error(
      `no-cycle: invalid fixture did not produce import(no-cycle) (got ${JSON.stringify(found.map(diagnostic => diagnostic.code))})`
    );
};
