import { definePlugin, PluginExecutionError } from "@rexeus/typeweaver-gen";
import type { Plugin } from "@rexeus/typeweaver-gen";
import { Effect } from "effect";

export const helloPlugin: Plugin = definePlugin({
  name: "hello",
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
