import type { PluginConfigError } from "@rexeus/typeweaver-gen";
import { Effect } from "effect";
import { PluginModuleNotFoundError } from "./errors/PluginModuleNotFoundError.js";
import { isPluginConfigError } from "./isPluginConfigError.js";

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
      load: Effect.fn("typeweaver.PluginModuleLoader.load")(
        (
          specifier: string
        ): Effect.Effect<
          Record<string, unknown>,
          PluginModuleNotFoundError | PluginConfigError
        > =>
          Effect.tryPromise({
            try: () => import(specifier),
            catch: cause =>
              isPluginConfigError(cause)
                ? cause
                : new PluginModuleNotFoundError({ specifier, cause }),
          })
      ),
    },
    accessors: true,
  }
) {}
