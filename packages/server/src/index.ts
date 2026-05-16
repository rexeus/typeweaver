import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  copyPluginLibFiles,
  definePlugin,
  PluginExecutionError,
} from "@rexeus/typeweaver-gen";
import type { Plugin } from "@rexeus/typeweaver-gen";
import { Effect } from "effect";
import { generate as generateRouters } from "./routerGenerator.js";

const PLUGIN_NAME = "server";
const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const libSourceDir = path.join(moduleDir, "lib");

/**
 * Typeweaver plugin that generates a lightweight, dependency-free server
 * with built-in routing and middleware support.
 *
 * Copies the runtime library files (`TypeweaverApp`, `TypeweaverRouter`,
 * `Router`, `Middleware`, etc.) and generates typed router classes for
 * each resource.
 */
export const serverPlugin: Plugin = definePlugin({
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
        generateRouters(context);
      },
      catch: cause =>
        new PluginExecutionError({
          pluginName: PLUGIN_NAME,
          phase: "generate",
          cause,
        }),
    }),
});

export default serverPlugin;
