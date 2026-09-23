import { PluginConfigError } from "@rexeus/typeweaver-gen";
import type {
  Plugin,
  PluginRegistryInstance,
  TypeweaverConfig,
} from "@rexeus/typeweaver-gen";
import { Effect } from "effect";
import { PluginLoadError } from "../errors/PluginLoadError.js";
import { PluginModuleLoader } from "./PluginModuleLoader.js";
import { loadConfiguredPlugin } from "./pluginResolution.js";
import type { PluginResolutionStrategy } from "./pluginResolution.js";
import type { PluginLoadResult } from "./pluginShape.js";

export type LoadParams = {
  readonly registry: PluginRegistryInstance;
  readonly requiredPlugins: readonly Plugin[];
  readonly strategies: readonly PluginResolutionStrategy[];
  readonly config?: Pick<TypeweaverConfig, "plugins"> | undefined;
};

export type PluginLoaderShape = {
  readonly loadAll: (
    params: LoadParams
  ) => Effect.Effect<void, PluginLoadError | PluginConfigError>;
};

const reportSuccessfulLoads = (
  successful: readonly PluginLoadResult[]
): Effect.Effect<void> =>
  Effect.gen(function* () {
    if (successful.length === 0) return;
    yield* Effect.logInfo(
      `Successfully loaded ${successful.length} plugin(s):`
    );
    for (const result of successful) {
      yield* Effect.logInfo(
        `  - ${result.plugin.name} (from ${result.source})`
      );
    }
  });

/**
 * Effect-native plugin loader. Registers each required plugin first, then
 * resolves each configured plugin against the requested strategies and
 * registers it with its constructor options.
 *
 * The registry is supplied by the caller (one fresh instance per
 * `Generator.generate` call) so concurrent generations see fully isolated
 * registrations. Plugins are V2 records (`Plugin`) or factory functions
 * returning records; the runtime treats both uniformly.
 */
export const makePluginLoader: Effect.Effect<
  PluginLoaderShape,
  never,
  PluginModuleLoader
> = Effect.gen(function* () {
  const moduleLoader = yield* PluginModuleLoader;

  const loadAll: PluginLoaderShape["loadAll"] = Effect.fn(
    "typeweaver.PluginLoader.loadAll"
  )(function* (params: LoadParams) {
    for (const requiredPlugin of params.requiredPlugins) {
      yield* params.registry.register(requiredPlugin);
    }
    if (params.config?.plugins === undefined) return;

    const successful: PluginLoadResult[] = [];
    for (const pluginEntry of params.config.plugins) {
      const pluginName =
        typeof pluginEntry === "string" ? pluginEntry : pluginEntry[0];
      const pluginConfig =
        typeof pluginEntry === "string" ? undefined : pluginEntry[1];
      const result = yield* loadConfiguredPlugin(
        moduleLoader,
        pluginName,
        params.strategies,
        pluginConfig
      );
      successful.push(result);
      yield* params.registry.register(result.plugin, result.config);
    }
    yield* reportSuccessfulLoads(successful);
  });

  return { loadAll } as const;
});
