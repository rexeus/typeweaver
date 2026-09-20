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
      name: "ignores files without direct re-exports",
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
  ],
};

describe("pure-barrel", () => {
  ruleTester.run("pure-barrel", pureBarrelRule, testCases);
});
