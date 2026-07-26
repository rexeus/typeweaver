import path from "node:path";
import { pathToFileURL } from "node:url";
import { PluginConfigError } from "@rexeus/typeweaver-gen";
import type {
  Plugin,
  PluginConfig,
  PluginRegistryInstance,
  TypeweaverConfig,
} from "@rexeus/typeweaver-gen";
import { Effect, Either } from "effect";
import { PluginLoadError } from "../errors/PluginLoadError.js";
import { isPluginConfigError } from "./isPluginConfigError.js";
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

type PluginFactory = (config?: PluginConfig) => unknown;

type PluginShapeIssue =
  | {
      readonly _tag: "NotRecord";
      readonly actual: string;
    }
  | {
      readonly _tag: "InvalidField";
      readonly field: keyof Plugin;
      readonly expected: string;
      readonly actual: string;
      readonly detail?: string;
    };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isPluginFactory = (value: unknown): value is PluginFactory =>
  typeof value === "function";

const isInitializeHook = (
  value: unknown
): value is NonNullable<Plugin["initialize"]> => typeof value === "function";

const isValidateHook = (
  value: unknown
): value is NonNullable<Plugin["validate"]> => typeof value === "function";

const isCollectResourcesHook = (
  value: unknown
): value is NonNullable<Plugin["collectResources"]> =>
  typeof value === "function";

const isGenerateHook = (
  value: unknown
): value is NonNullable<Plugin["generate"]> => typeof value === "function";

const isFinalizeHook = (
  value: unknown
): value is NonNullable<Plugin["finalize"]> => typeof value === "function";

const describeValue = (value: unknown): string => {
  if (value === null) {
    return "null";
  }
  if (Array.isArray(value)) {
    return "array";
  }
  if (typeof value === "string") {
    return JSON.stringify(value);
  }
  return typeof value;
};

const formatPluginShapeIssue = (
  exportName: string,
  issue: PluginShapeIssue
): string => {
  switch (issue._tag) {
    case "NotRecord":
      return `Export '${exportName}' must be a plugin record, received ${issue.actual}`;
    case "InvalidField": {
      const detail = issue.detail === undefined ? "" : ` ${issue.detail}`;
      return `Export '${exportName}' has invalid plugin field '${issue.field}'${detail}: expected ${issue.expected}, received ${issue.actual}`;
    }
  }
};

const invalidField = (
  field: keyof Plugin,
  expected: string,
  actual: unknown,
  detail?: string
): Either.Either<never, PluginShapeIssue> =>
  Either.left({
    _tag: "InvalidField",
    field,
    expected,
    actual: describeValue(actual),
    ...(detail === undefined ? {} : { detail }),
  });

const decodePluginName = (
  value: Record<string, unknown>
): Either.Either<string, PluginShapeIssue> => {
  const name = value.name;
  return typeof name === "string" && name.trim().length > 0
    ? Either.right(name)
    : invalidField("name", "a non-empty string", name);
};

const decodeDependencies = (
  value: Record<string, unknown>
): Either.Either<readonly string[] | undefined, PluginShapeIssue> => {
  if (!("depends" in value)) {
    return Either.right(undefined);
  }
  if (!Array.isArray(value.depends)) {
    return invalidField("depends", "an array of strings", value.depends);
  }

  const dependencies: string[] = [];
  for (const [index, dependency] of value.depends.entries()) {
    if (typeof dependency !== "string") {
      return invalidField(
        "depends",
        "a string",
        dependency,
        `at index ${index}`
      );
    }
    dependencies.push(dependency);
  }
  return Either.right(dependencies);
};

const decodeOptionalHook = <THook>(
  value: Record<string, unknown>,
  field: keyof Plugin,
  isHook: (candidate: unknown) => candidate is THook
): Either.Either<THook | undefined, PluginShapeIssue> => {
  if (!(field in value)) {
    return Either.right(undefined);
  }

  const candidate = value[field];
  return isHook(candidate)
    ? Either.right(candidate)
    : invalidField(field, "a function", candidate);
};

const decodePlugin = (
  value: unknown
): Either.Either<Plugin, PluginShapeIssue> => {
  if (!isRecord(value)) {
    return Either.left({
      _tag: "NotRecord",
      actual: describeValue(value),
    });
  }

  return Either.gen(function* () {
    const name = yield* decodePluginName(value);
    const depends = yield* decodeDependencies(value);
    const initialize = yield* decodeOptionalHook(
      value,
      "initialize",
      isInitializeHook
    );
    const validate = yield* decodeOptionalHook(
      value,
      "validate",
      isValidateHook
    );
    const collectResources = yield* decodeOptionalHook(
      value,
      "collectResources",
      isCollectResourcesHook
    );
    const generate = yield* decodeOptionalHook(
      value,
      "generate",
      isGenerateHook
    );
    const finalize = yield* decodeOptionalHook(
      value,
      "finalize",
      isFinalizeHook
    );

    return {
      ...value,
      name,
      ...(depends === undefined ? {} : { depends }),
      ...(initialize === undefined ? {} : { initialize }),
      ...(validate === undefined ? {} : { validate }),
      ...(collectResources === undefined ? {} : { collectResources }),
      ...(generate === undefined ? {} : { generate }),
      ...(finalize === undefined ? {} : { finalize }),
    } satisfies Plugin;
  });
};

const formatError = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const isRelativePathSpecifier = (pluginName: string): boolean =>
  /^(?:\.{1,2}[\\/])/u.test(pluginName);

const toLocalImportSpecifier = (pluginName: string): string => {
  if (pluginName.startsWith("file:")) {
    return pluginName;
  }
  if (path.isAbsolute(pluginName)) {
    return pathToFileURL(pluginName).href;
  }
  if (isRelativePathSpecifier(pluginName)) {
    return pathToFileURL(path.resolve(pluginName)).href;
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

  if ("default" in pluginModule) {
    candidates.push({ exportName: "default", value: pluginModule.default });
  }

  for (const [key, value] of Object.entries(pluginModule)) {
    if (key !== "default") {
      candidates.push({ exportName: key, value });
    }
  }

  return candidates;
};

/**
 * A candidate resolution either succeeds, fails with a plain message
 * (export shape mismatch, module didn't expose a Plugin, etc.), or
 * fails with a tagged `PluginConfigError` (the plugin constructor
 * validated its options and rejected them). The tagged variant
 * short-circuits the load: misconfiguration is the same across every
 * resolution strategy, and the user deserves a typed error at the CLI
 * boundary rather than a string folded into a `PluginLoadError`.
 */
type CandidateFailure = string | PluginConfigError;

const resolveCandidateToPlugin = (
  candidate: PluginCandidate,
  config: PluginConfig | undefined
): Either.Either<Plugin, CandidateFailure> => {
  if (isPluginFactory(candidate.value)) {
    try {
      return Either.mapLeft(decodePlugin(candidate.value(config)), issue =>
        formatPluginShapeIssue(candidate.exportName, issue)
      );
    } catch (error) {
      if (isPluginConfigError(error)) {
        return Either.left(error);
      }
      return Either.left(
        `Export '${candidate.exportName}' could not be instantiated: ${formatError(error)}`
      );
    }
  }

  return Either.mapLeft(decodePlugin(candidate.value), issue =>
    formatPluginShapeIssue(candidate.exportName, issue)
  );
};

const resolveModuleToPlugin = (
  pluginModule: Record<string, unknown>,
  pluginConfig: PluginConfig | undefined
): Either.Either<Plugin, CandidateFailure> => {
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
    if (isPluginConfigError(resolved.left)) {
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
  readonly registry: PluginRegistryInstance;
  readonly requiredPlugins: readonly Plugin[];
  readonly strategies: readonly PluginResolutionStrategy[];
  readonly config?: TypeweaverConfig;
};

const loadConfiguredPlugin = (
  moduleLoader: PluginModuleLoader,
  pluginName: string,
  strategies: readonly PluginResolutionStrategy[],
  pluginConfig?: PluginConfig
): Effect.Effect<PluginLoadResult, PluginLoadError | PluginConfigError> =>
  Effect.gen(function* () {
    const possiblePaths = generatePluginPaths(pluginName, strategies);
    const attempts: { path: string; error: string }[] = [];

    for (const possiblePath of possiblePaths) {
      yield* Effect.logDebug(
        `Plugin '${pluginName}': attempting to load from '${possiblePath}'`
      );
      const importResult = yield* moduleLoader
        .load(possiblePath)
        .pipe(Effect.either);

      if (Either.isLeft(importResult)) {
        if (isPluginConfigError(importResult.left)) {
          return yield* importResult.left;
        }
        const errorMessage = formatError(importResult.left.cause);
        yield* Effect.logDebug(
          `Plugin '${pluginName}': '${possiblePath}' failed: ${errorMessage}`
        );
        attempts.push({
          path: possiblePath,
          error: errorMessage,
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

      if (isPluginConfigError(resolved.left)) {
        return yield* resolved.left;
      }

      attempts.push({ path: possiblePath, error: resolved.left });
    }

    return yield* new PluginLoadError({ pluginName, attempts });
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
export class PluginLoader extends Effect.Service<PluginLoader>()(
  "typeweaver/PluginLoader",
  {
    effect: Effect.gen(function* () {
      const moduleLoader = yield* PluginModuleLoader;

      const loadAll: (
        params: LoadParams
      ) => Effect.Effect<void, PluginLoadError | PluginConfigError> = Effect.fn(
        "typeweaver.PluginLoader.loadAll"
      )(function* (params: LoadParams) {
        for (const requiredPlugin of params.requiredPlugins) {
          yield* params.registry.register(requiredPlugin);
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
          yield* params.registry.register(result.plugin, result.config);
        }

        yield* reportSuccessfulLoads(successful);
      });

      return { loadAll } as const;
    }),
    dependencies: [PluginModuleLoader.Default],
    accessors: true,
  }
) {}
