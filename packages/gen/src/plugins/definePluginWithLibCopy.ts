import { Effect } from "effect";
import { copyPluginLibFiles } from "./copyPluginLibFiles.js";
import { definePlugin } from "./Plugin.js";
import type { Plugin } from "./Plugin.js";
import { PluginExecutionError } from "./errors/PluginExecutionError.js";
import type { GeneratorContext } from "./contextTypes.js";

/**
 * Build a plugin whose `generate` phase copies a `lib/` directory into the
 * generated output and then runs one or more sync emitter functions. Failures
 * in the emitter functions are converted to `PluginExecutionError` tagged with
 * `phase: "generate"`.
 *
 * Eliminates the byte-equivalent boilerplate in the five default plugin
 * entrypoints (types, clients, server, hono, aws-cdk).
 *
 * Typical usage:
 * ```ts
 * const moduleDir = path.dirname(fileURLToPath(import.meta.url));
 * export const typesPlugin = definePluginWithLibCopy({
 *   name: "types",
 *   libSourceDir: path.join(moduleDir, "lib"),
 *   generators: [generateRequests, generateRequestValidators],
 * });
 * ```
 */
export const definePluginWithLibCopy = (params: {
  readonly name: string;
  readonly depends?: readonly string[];
  readonly libSourceDir: string;
  readonly generators: ReadonlyArray<(context: GeneratorContext) => void>;
}): Plugin =>
  definePlugin({
    name: params.name,
    ...(params.depends === undefined ? {} : { depends: params.depends }),
    generate: (context) =>
      Effect.try({
        try: () => {
          copyPluginLibFiles({
            context,
            libSourceDir: params.libSourceDir,
            libNamespace: params.name,
          });
          for (const run of params.generators) {
            run(context);
          }
        },
        catch: (cause) =>
          new PluginExecutionError({
            pluginName: params.name,
            phase: "generate",
            cause,
          }),
      }),
  });
