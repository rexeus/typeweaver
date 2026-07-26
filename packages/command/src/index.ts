import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  copyPluginLibFiles,
  definePlugin,
  PluginExecutionError,
} from "@rexeus/typeweaver-gen";
import type { Plugin } from "@rexeus/typeweaver-gen";
import { Effect } from "effect";
import { generateCommandClient } from "./commandGenerator.js";
import { validateCommandSpec } from "./validation.js";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));

export const commandPlugin: Plugin = definePlugin({
  name: "command",
  depends: ["clients"],
  validate: normalizedSpec =>
    Effect.succeed(validateCommandSpec(normalizedSpec)),
  generate: context =>
    Effect.try({
      try: () => {
        copyPluginLibFiles({
          context,
          libSourceDir: path.join(moduleDir, "lib"),
          libNamespace: "command",
        });
        generateCommandClient(context);
      },
      catch: cause =>
        new PluginExecutionError({
          pluginName: "command",
          phase: "generate",
          cause,
        }),
    }),
});

export default commandPlugin;
