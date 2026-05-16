import { Effect, Layer } from "effect";
import {
  PluginModuleLoader,
  PluginModuleNotFoundError,
} from "../../src/services/PluginModuleLoader.js";

/**
 * Builds a test layer for `PluginModuleLoader` that resolves specifiers
 * against an in-memory module map. Specifiers absent from the map fail
 * with `PluginModuleNotFoundError`, matching the production behavior of
 * a failed dynamic `import()`.
 *
 * Tests prefer this over writing `.mjs` fixtures to disk because module
 * resolution mechanics are irrelevant to the consumer's branching — what
 * matters is which exports are observed and how the loader reports
 * failure.
 */
export const inMemoryPluginModuleLoader = (
  modules: ReadonlyMap<string, Record<string, unknown>>
): Layer.Layer<PluginModuleLoader> =>
  Layer.succeed(PluginModuleLoader, {
    load: specifier => {
      const moduleRecord = modules.get(specifier);
      if (moduleRecord === undefined) {
        return Effect.fail(
          new PluginModuleNotFoundError({
            specifier,
            cause: new Error(
              `Cannot find module '${specifier}' imported from in-memory map`
            ),
          })
        );
      }
      return Effect.succeed(moduleRecord);
    },
  } as PluginModuleLoader["Type"]);
