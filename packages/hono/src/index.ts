import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  PluginExecutionError,
  copyPluginLibFiles,
  definePlugin,
} from "@rexeus/typeweaver-gen";
import type { Plugin } from "@rexeus/typeweaver-gen";
import { Effect } from "effect";
import { generate as generateHonoRouters } from "./honoRouterGenerator.js";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));

export const honoPlugin: Plugin = definePlugin({
  name: "hono",
  depends: ["types"],
  generate: context =>
    Effect.try({
      try: () =>
        copyPluginLibFiles({
          context,
          libSourceDir: path.join(moduleDir, "lib"),
          libNamespace: "hono",
        }),
      catch: cause =>
        new PluginExecutionError({
          pluginName: "hono",
          phase: "generate",
          cause,
        }),
    }).pipe(Effect.zipRight(generateHonoRouters(context))),
});

export default honoPlugin;
