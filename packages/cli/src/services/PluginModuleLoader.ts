import { Effect } from "effect";
import { PluginModuleNotFoundError } from "./errors/PluginModuleNotFoundError.js";

/**
 * Resolves and dynamically imports plugin modules.
 *
 * The default implementation delegates to Node's `import(specifier)`; tests
 * substitute a layer that resolves specifiers to in-memory module records,
 * eliminating the need to materialize plugin source on disk.
 */
export class PluginModuleLoader extends Effect.Service<PluginModuleLoader>()(
  "typeweaver/PluginModuleLoader",
  {
    succeed: {
      load: (
        specifier: string
      ): Effect.Effect<Record<string, unknown>, PluginModuleNotFoundError> =>
        Effect.tryPromise({
          try: async () => (await import(specifier)) as Record<string, unknown>,
          catch: cause => new PluginModuleNotFoundError({ specifier, cause }),
        }),
    },
    accessors: true,
  }
) {}
