import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  copyPluginLibFiles,
  definePlugin,
  PluginExecutionError,
} from "@rexeus/typeweaver-gen";
import type { Plugin } from "@rexeus/typeweaver-gen";
import { Effect } from "effect";
import { generate as generateClients } from "./clientGenerator.js";

const PLUGIN_NAME = "clients";
const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const libSourceDir = path.join(moduleDir, "lib");

export const clientsPlugin: Plugin = definePlugin({
  name: PLUGIN_NAME,
  depends: ["types"],
  generate: context =>
    Effect.try({
      try: () => {
        copyPluginLibFiles({
          context,
          libSourceDir,
          libNamespace: PLUGIN_NAME,
        });
        generateClients(context);
      },
      catch: cause =>
        new PluginExecutionError({
          pluginName: PLUGIN_NAME,
          phase: "generate",
          cause,
        }),
    }),
});

export default clientsPlugin;
