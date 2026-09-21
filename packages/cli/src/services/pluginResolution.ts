import path from "node:path";
import { pathToFileURL } from "node:url";
import { PluginConfigError } from "@rexeus/typeweaver-gen";
import type { Plugin, PluginConfig } from "@rexeus/typeweaver-gen";
import { Effect, Result } from "effect";
import { PluginLoadError } from "../errors/PluginLoadError.js";
import { isPluginConfigError } from "./isPluginConfigError.js";
import { resolveCandidateToPlugin } from "./pluginShape.js";
import type { PluginModuleLoaderShape } from "./PluginModuleLoader.js";
import type { PluginCandidate, PluginLoadResult } from "./pluginShape.js";

export type PluginResolutionStrategy = "npm" | "local" | "scoped";
type CandidateFailure = string | PluginConfigError;

const formatError = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const isRelativePathSpecifier = (pluginName: string): boolean =>
  /^(?:\.{1,2}[\\/])/u.test(pluginName);

const toLocalImportSpecifier = (pluginName: string): string => {
  if (pluginName.startsWith("file:")) return pluginName;
  if (path.isAbsolute(pluginName)) return pathToFileURL(pluginName).href;
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
): PluginCandidate[] => [
  ...(Object.hasOwn(pluginModule, "default")
    ? [{ exportName: "default", value: pluginModule["default"] }]
    : []),
  ...Object.entries(pluginModule)
    .filter(([key]) => key !== "default")
    .map(([exportName, value]) => ({ exportName, value })),
];

const resolveModuleToPlugin = (
  pluginModule: Record<string, unknown>,
  pluginConfig: PluginConfig | undefined
): Result.Result<Plugin, CandidateFailure> => {
  const candidates = findPluginCandidates(pluginModule);
  if (candidates.length === 0) return Result.fail("No plugin export found");

  const errors: string[] = [];
  for (const candidate of candidates) {
    const resolved = resolveCandidateToPlugin(candidate, pluginConfig);
    if (Result.isSuccess(resolved)) return resolved;
    if (isPluginConfigError(resolved.failure)) return resolved;
    errors.push(resolved.failure);
  }
  return Result.fail(errors.join("; "));
};

export const loadConfiguredPlugin = (
  moduleLoader: PluginModuleLoaderShape,
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
        .pipe(Effect.result);
      if (Result.isFailure(importResult)) {
        if (isPluginConfigError(importResult.failure)) {
          return yield* importResult.failure;
        }
        const errorMessage = formatError(importResult.failure.cause);
        yield* Effect.logDebug(
          `Plugin '${pluginName}': '${possiblePath}' failed: ${errorMessage}`
        );
        attempts.push({ path: possiblePath, error: errorMessage });
        continue;
      }

      const resolved = resolveModuleToPlugin(
        importResult.success,
        pluginConfig
      );
      if (Result.isSuccess(resolved)) {
        return {
          plugin: resolved.success,
          source: possiblePath,
          config: pluginConfig,
        };
      }
      if (isPluginConfigError(resolved.failure)) return yield* resolved.failure;
      attempts.push({ path: possiblePath, error: resolved.failure });
    }

    return yield* new PluginLoadError({ pluginName, attempts });
  });
