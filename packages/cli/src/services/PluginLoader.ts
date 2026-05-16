import path from "node:path";
import { pathToFileURL } from "node:url";
import { PluginRegistry } from "@rexeus/typeweaver-gen";
import type {
  Plugin,
  PluginConfig,
  TypeweaverConfig,
} from "@rexeus/typeweaver-gen";
import { Effect, Either } from "effect";
import { PluginLoadError } from "../generators/errors/PluginLoadError.js";
import { PluginModuleLoader } from "./PluginModuleLoader.js";

export type PluginResolutionStrategy = "npm" | "local" | "scoped";

type PluginCandidate = {
  readonly exportName: string;
  readonly value: unknown;
};

type PluginLoadResult = {
  readonly plugin: Plugin;
  readonly source: string;
  readonly config?: PluginConfig;
};

const isPlugin = (value: unknown): value is Plugin =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as { readonly name?: unknown }).name === "string" &&
  (value as { readonly name: string }).name.length > 0;

const formatError = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const toLocalImportSpecifier = (pluginName: string): string => {
  if (pluginName.startsWith("file:")) {
    return pluginName;
  }
  if (path.isAbsolute(pluginName)) {
    return pathToFileURL(pluginName).href;
  }
  return pluginName;
};

const generatePluginPaths = (
  pluginName: string,
  strategies: readonly PluginResolutionStrategy[]
): string[] => {
  const paths: string[] = [];
  for (const strategy of strategies) {
    switch (strategy) {
      case "npm":
        paths.push(`@rexeus/typeweaver-${pluginName}`);
        paths.push(`@rexeus/${pluginName}`);
        break;
      case "local":
        paths.push(toLocalImportSpecifier(pluginName));
        break;
      case "scoped":
        paths.push(pluginName);
        break;
    }
  }
  return paths;
};

const findPluginCandidates = (
  pluginModule: Record<string, unknown>
): PluginCandidate[] => {
  const candidates: PluginCandidate[] = [];

  for (const [key, value] of Object.entries(pluginModule)) {
    if (key !== "default") {
      candidates.push({ exportName: key, value });
    }
  }

  if ("default" in pluginModule) {
    candidates.push({ exportName: "default", value: pluginModule.default });
  }

  return candidates;
};

const resolveCandidateToPlugin = (
  candidate: PluginCandidate,
  config: PluginConfig | undefined
): Either.Either<Plugin, string> => {
  if (typeof candidate.value === "function") {
    try {
      const result = (candidate.value as (cfg?: PluginConfig) => unknown)(
        config
      );
      if (isPlugin(result)) {
        return Either.right(result);
      }
      return Either.left(
        `Export '${candidate.exportName}' did not produce a valid plugin with a string name`
      );
    } catch (error) {
      return Either.left(
        `Export '${candidate.exportName}' could not be instantiated: ${formatError(error)}`
      );
    }
  }

  if (isPlugin(candidate.value)) {
    return Either.right(candidate.value);
  }

  return Either.left(
    `Export '${candidate.exportName}' did not produce a valid plugin with a string name`
  );
};

const resolveModuleToPlugin = (
  pluginModule: Record<string, unknown>,
  pluginConfig: PluginConfig | undefined
): Either.Either<Plugin, string> => {
  const candidates = findPluginCandidates(pluginModule);
  if (candidates.length === 0) {
    return Either.left("No plugin export found");
  }

  const errors: string[] = [];
  for (const candidate of candidates) {
    const resolved = resolveCandidateToPlugin(candidate, pluginConfig);
    if (Either.isRight(resolved)) {
      return resolved;
    }
    errors.push(resolved.left);
  }

  return Either.left(errors.join("; "));
};

const reportSuccessfulLoads = (
  successful: readonly PluginLoadResult[]
): Effect.Effect<void> =>
  Effect.gen(function* () {
    if (successful.length === 0) {
      return;
    }
    yield* Effect.logInfo(
      `Successfully loaded ${successful.length} plugin(s):`
    );
    for (const result of successful) {
      yield* Effect.logInfo(
        `  - ${result.plugin.name} (from ${result.source})`
      );
    }
  });

type LoadParams = {
  readonly requiredPlugins: readonly Plugin[];
  readonly strategies: readonly PluginResolutionStrategy[];
  readonly config?: TypeweaverConfig;
};

const loadConfiguredPlugin = (
  moduleLoader: PluginModuleLoader,
  pluginName: string,
  strategies: readonly PluginResolutionStrategy[],
  pluginConfig?: PluginConfig
): Effect.Effect<PluginLoadResult, PluginLoadError> =>
  Effect.gen(function* () {
    const possiblePaths = generatePluginPaths(pluginName, strategies);
    const attempts: { path: string; error: string }[] = [];

    for (const possiblePath of possiblePaths) {
      const importResult = yield* moduleLoader
        .load(possiblePath)
        .pipe(Effect.either);

      if (Either.isLeft(importResult)) {
        attempts.push({
          path: possiblePath,
          error: formatError(importResult.left.cause),
        });
        continue;
      }

      const resolved = resolveModuleToPlugin(importResult.right, pluginConfig);
      if (Either.isRight(resolved)) {
        return {
          plugin: resolved.right,
          source: possiblePath,
          config: pluginConfig,
        };
      }

      attempts.push({ path: possiblePath, error: resolved.left });
    }

    return yield* Effect.fail(new PluginLoadError({ pluginName, attempts }));
  });

/**
 * Effect-native plugin loader. Registers each required plugin first, then
 * resolves each configured plugin against the requested strategies and
 * registers it with its constructor options.
 *
 * Plugins are V2 records (`Plugin`) or factory functions returning records.
 * The runtime treats both uniformly via `PluginRegistry`.
 */
export class PluginLoader extends Effect.Service<PluginLoader>()(
  "typeweaver/PluginLoader",
  {
    effect: Effect.gen(function* () {
      const registry = yield* PluginRegistry;
      const moduleLoader = yield* PluginModuleLoader;

      const loadAll = (
        params: LoadParams
      ): Effect.Effect<void, PluginLoadError> =>
        Effect.gen(function* () {
          for (const requiredPlugin of params.requiredPlugins) {
            yield* registry.register(requiredPlugin);
          }

          if (params.config?.plugins === undefined) {
            return;
          }

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
            yield* registry.register(result.plugin, result.config);
          }

          yield* reportSuccessfulLoads(successful);
        });

      return { loadAll } as const;
    }),
    dependencies: [PluginRegistry.Default, PluginModuleLoader.Default],
    accessors: true,
  }
) {}
