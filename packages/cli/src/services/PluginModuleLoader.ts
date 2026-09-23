import type { PluginConfigError } from "@rexeus/typeweaver-gen";
import { Context, Effect, Layer } from "effect";
import { PluginModuleNotFoundError } from "./errors/PluginModuleNotFoundError.js";
import { isPluginConfigError } from "./isPluginConfigError.js";

export type PluginModuleLoaderShape = {
  readonly load: (
    specifier: string
  ) => Effect.Effect<
    Record<string, unknown>,
    PluginModuleNotFoundError | PluginConfigError
  >;
};

const isModuleNamespace = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const pluginModuleLoaderShape: PluginModuleLoaderShape = {
  load: Effect.fn("typeweaver.PluginModuleLoader.load")(
    (
      specifier: string
    ): Effect.Effect<
      Record<string, unknown>,
      PluginModuleNotFoundError | PluginConfigError
    > =>
      Effect.tryPromise({
        try: async () => {
          const pluginModule: unknown = await import(specifier);
          if (!isModuleNamespace(pluginModule)) {
            throw new TypeError(
              `Plugin module '${specifier}' did not resolve to a module namespace`
            );
          }
          return pluginModule;
        },
        catch: cause =>
          isPluginConfigError(cause)
            ? cause
            : new PluginModuleNotFoundError({ specifier, cause }),
      })
  ),
};

/**
 * Resolves and dynamically imports plugin modules.
 *
 * The default implementation delegates to Node's `import(specifier)`; tests
 * substitute a layer that resolves specifiers to in-memory module records,
 * eliminating the need to materialize plugin source on disk.
 */
export class PluginModuleLoader extends Context.Service<
  PluginModuleLoader,
  PluginModuleLoaderShape
>()("typeweaver/PluginModuleLoader") {
  static readonly make = (service: PluginModuleLoaderShape) => service;

  static readonly Default: Layer.Layer<PluginModuleLoader> = Layer.succeed(
    PluginModuleLoader,
    pluginModuleLoaderShape
  );

  static readonly load = (specifier: string) =>
    PluginModuleLoader.use(service => service.load(specifier));
}
