import { RuleTester } from "oxlint/plugins-dev";
import { describe, it } from "vitest";
import { pureBarrelRule } from "./pureBarrelRule.mjs";

RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester({
  languageOptions: { parserOptions: { lang: "ts" } },
});

const testCases = {
  valid: [
    {
      name: "ignores files without re-exports",
      code: "export const implementation = 1;",
    },
    {
      name: "accepts a named direct re-export",
      code: 'export { value } from "./value.js";',
    },
    {
      name: "accepts a type-only direct re-export",
      code: 'export type { Value } from "./value.js";',
    },
    {
      name: "accepts a star direct re-export",
      code: 'export * from "./value.js";',
    },
    {
      name: "accepts imports beside direct re-exports",
      code: [
        'import value from "./value.js";',
        'export { value } from "./value.js";',
      ].join("\n"),
    },
    {
      name: "accepts export wiring beside direct re-exports",
      code: [
        'import { value } from "./value.js";',
        "export { value as renamed };",
        'export { other } from "./other.js";',
      ].join("\n"),
    },
    {
      name: "accepts type declarations beside direct re-exports",
      code: [
        "export type Value = string;",
        "export interface Contract { value: Value }",
        'export * from "./value.js";',
      ].join("\n"),
    },
    {
      name: "accepts a default export of an imported identifier",
      code: [
        'import value from "./value.js";',
        'export * from "./other.js";',
        "export default value;",
      ].join("\n"),
    },
    {
      name: "accepts direct re-exports from any filename",
      filename: "not-a-barrel.ts",
      code: 'export { value } from "./value.js";',
    },
    {
      name: "accepts a namespace direct re-export",
      code: 'export * as values from "./value.js";',
    },
    {
      name: "accepts a default direct re-export",
      code: 'export { default } from "./value.js";',
    },
    {
      name: "accepts a local barrel that exports imported bindings",
      code: [
        'import { value } from "./value.js";',
        'import type { Value } from "./value.js";',
        "export { value };",
        "export type { Value };",
      ].join("\n"),
    },
    {
      name: "ignores a module that exports only its own declarations",
      code: [
        'import { dependency } from "./dependency.js";',
        "const local = dependency + 1;",
        "type Local = typeof local;",
        "export { local };",
        "export type { Local };",
      ].join("\n"),
    },
  ],
  invalid: [
    {
      name: "rejects a runtime variable beside a direct re-export",
      code: [
        'export { value } from "./value.js";',
        "export const local = 1;",
      ].join("\n"),
      errors: [{ messageId: "mixedImplementation" }],
    },
    {
      name: "rejects a runtime function beside a direct re-export",
      code: ['export * from "./value.js";', "export function local() {}"].join(
        "\n"
      ),
      errors: [{ messageId: "mixedImplementation" }],
    },
    {
      name: "rejects a runtime class beside a direct re-export",
      code: [
        'export { value } from "./value.js";',
        "export class Local {}",
      ].join("\n"),
      errors: [{ messageId: "mixedImplementation" }],
    },
    {
      name: "rejects a runtime enum beside a direct re-export",
      code: ['export * from "./value.js";', "export enum Local { Value }"].join(
        "\n"
      ),
      errors: [{ messageId: "mixedImplementation" }],
    },
    {
      name: "rejects a runtime expression beside a direct re-export",
      code: [
        'export { value } from "./value.js";',
        'console.log("implementation");',
      ].join("\n"),
      errors: [{ messageId: "mixedImplementation" }],
    },
    {
      name: "rejects a runtime variable beside a namespace direct re-export",
      code: [
        'export * as values from "./value.js";',
        "export const local = 1;",
      ].join("\n"),
      errors: [{ messageId: "mixedImplementation" }],
    },
    {
      name: "rejects a runtime function beside a default direct re-export",
      code: [
        'export { default } from "./value.js";',
        "export function local() {}",
      ].join("\n"),
      errors: [{ messageId: "mixedImplementation" }],
    },
    {
      name: "rejects a runtime variable beside an imported value export",
      code: [
        'import { value } from "./value.js";',
        "export { value };",
        "export const local = 1;",
      ].join("\n"),
      errors: [{ messageId: "mixedImplementation" }],
    },
    {
      name: "rejects a runtime function beside an imported type export",
      code: [
        'import type { Value } from "./value.js";',
        "export type { Value };",
        "export function local(): void {}",
      ].join("\n"),
      errors: [{ messageId: "mixedImplementation" }],
    },
    {
      name: "rejects a local export mixing imported and local bindings",
      code: [
        'import { value } from "./value.js";',
        "const local = 1;",
        "export { local, value };",
      ].join("\n"),
      errors: [
        { messageId: "mixedImplementation" },
        { messageId: "mixedImplementation" },
      ],
    },
  ],
};

describe("pure-barrel", () => {
  ruleTester.run("pure-barrel", pureBarrelRule, testCases);
});
