import { definePlugin, PluginExecutionError } from "@rexeus/typeweaver-gen";
import type { Issue, Plugin } from "@rexeus/typeweaver-gen";
import { Effect } from "effect";

const emptyContractIssue: Issue = {
  code: "TW-PLUGIN-HELLO-001",
  severity: "warning",
  message: "The hello plugin has no resources to inspect.",
  path: "/resources",
  hint: "Declare at least one resource before running the plugin.",
  fixable: false,
};

export const helloPlugin: Plugin = definePlugin({
  name: "hello",
  validate: normalizedSpec =>
    Effect.succeed(
      normalizedSpec.resources.length === 0 ? [emptyContractIssue] : []
    ),
  generate: context =>
    Effect.try({
      try: () => {
        context.writeFile("hello.txt", "hello from a typeweaver plugin\n");
      },
      catch: cause =>
        new PluginExecutionError({
          pluginName: "hello",
          phase: "generate",
          cause,
        }),
    }),
});

export default helloPlugin;
