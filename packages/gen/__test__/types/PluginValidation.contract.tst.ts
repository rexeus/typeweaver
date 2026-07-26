import { Effect } from "effect";
import { expectTypeOf } from "vitest";
import type {
  Issue,
  IssueCode,
  JsonPointer,
  Plugin,
  PluginValidationContext,
  Severity,
} from "../../src/index.js";

type WriteCapableValidationKey = Extract<
  keyof PluginValidationContext,
  | "outputDir"
  | "writeFile"
  | "writeFileEffect"
  | "renderTemplate"
  | "renderTemplateEffect"
  | "addGeneratedFile"
  | "addGeneratedFileEffect"
>;

const issue = {
  code: "TW-PLUGIN-CONTRACT-001",
  severity: "warning",
  message: "The contract loses information in this projection.",
  path: "/resources/0/operations/0",
  source: {
    file: "spec/index.ts",
    line: 12,
    column: 5,
  },
  hint: "Declare the projection explicitly.",
  fixable: false,
} as const satisfies Issue;

const validationPlugin = {
  name: "contract",
  validate: (_normalizedSpec, context) => {
    expectTypeOf(context).toEqualTypeOf<PluginValidationContext>();
    return Effect.succeed([issue]);
  },
} satisfies Plugin;

const legacyPlugin = {
  name: "legacy",
} satisfies Plugin;

expectTypeOf<Issue["severity"]>().toEqualTypeOf<Severity>();
expectTypeOf<Issue["code"]>().toEqualTypeOf<IssueCode>();
expectTypeOf<Issue["path"]>().toEqualTypeOf<JsonPointer>();
expectTypeOf<WriteCapableValidationKey>().toEqualTypeOf<never>();
expectTypeOf(validationPlugin.validate).toBeFunction();
expectTypeOf(legacyPlugin).toMatchTypeOf<Plugin>();
