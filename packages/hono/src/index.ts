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
import { validateHonoSpec } from "./validation.js";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const PLUGIN_NAME = "hono";

const requireSupportedHonoPaths = (
  normalizedSpec: Parameters<typeof validateHonoSpec>[0]
) => {
  const issue = validateHonoSpec(normalizedSpec)[0];
  if (issue === undefined) return Effect.void;

  return Effect.fail(
    new PluginExecutionError({
      pluginName: PLUGIN_NAME,
      phase: "generate",
      cause: new Error(
        [
          `[${issue.code}] ${issue.message}`,
          issue.path === undefined ? undefined : `at ${issue.path}`,
          issue.hint,
        ]
          .filter(part => part !== undefined && part !== "")
          .join(" — ")
      ),
    })
  );
};

export const honoPlugin: Plugin = definePlugin({
  name: PLUGIN_NAME,
  depends: ["types"],
  validate: normalizedSpec => Effect.succeed(validateHonoSpec(normalizedSpec)),
  generate: context =>
    requireSupportedHonoPaths(context.normalizedSpec).pipe(
      Effect.zipRight(
        Effect.try({
          try: () =>
            copyPluginLibFiles({
              context,
              libSourceDir: path.join(moduleDir, "lib"),
              libNamespace: "hono",
            }),
          catch: cause =>
            new PluginExecutionError({
              pluginName: PLUGIN_NAME,
              phase: "generate",
              cause,
            }),
        })
      ),
      Effect.zipRight(generateHonoRouters(context))
    ),
});

export default honoPlugin;
