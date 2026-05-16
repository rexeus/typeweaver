import path from "node:path";
import { pathToFileURL } from "node:url";
import type {
  PluginConfig,
  PluginConstructor,
  TypeweaverConfig,
  TypeweaverPlugin,
} from "@rexeus/typeweaver-gen";
import { Either } from "effect";
import { PluginLoadError } from "./errors/PluginLoadError.js";

export type PluginResolutionStrategy = "npm" | "local" | "scoped";

export type PluginRegistrar = {
  readonly register: (plugin: TypeweaverPlugin, config?: unknown) => void;
};

export type PluginLoadResult = {
  readonly plugin: TypeweaverPlugin;
  readonly source: string;
  readonly config?: PluginConfig;
};

type PluginCandidate = {
  readonly exportName: string;
  readonly constructor: PluginConstructor;
};

export async function loadPlugins(
  registry: PluginRegistrar,
  requiredPlugins: readonly TypeweaverPlugin[],
  strategies: readonly PluginResolutionStrategy[],
  config?: TypeweaverConfig
): Promise<void> {
  for (const requiredPlugin of requiredPlugins) {
    registry.register(requiredPlugin);
  }

  if (!config?.plugins) {
    return;
  }

  const successful: PluginLoadResult[] = [];

  for (const plugin of config.plugins) {
    const pluginName = typeof plugin === "string" ? plugin : plugin[0];
    const pluginConfig = typeof plugin === "string" ? undefined : plugin[1];
    const result = await loadPlugin(pluginName, strategies, pluginConfig);

    if (Either.isLeft(result)) {
      throw result.left;
    }

    successful.push(result.right);
    registry.register(result.right.plugin, result.right.config);
  }

  reportSuccessfulLoads(successful);
}

async function loadPlugin(
  pluginName: string,
  strategies: readonly PluginResolutionStrategy[],
  pluginConfig?: PluginConfig
): Promise<Either.Either<PluginLoadResult, PluginLoadError>> {
  const possiblePaths = generatePluginPaths(pluginName, strategies);
  const attempts: { path: string; error: string }[] = [];

  for (const possiblePath of possiblePaths) {
    try {
      const pluginPackage = await import(possiblePath);
      const plugin = createPluginInstance(pluginPackage, pluginConfig);
      if (Either.isRight(plugin)) {
        return Either.right({
          plugin: plugin.right,
          source: possiblePath,
          config: pluginConfig,
        });
      }
      attempts.push({
        path: possiblePath,
        error: plugin.left,
      });
    } catch (error) {
      attempts.push({
        path: possiblePath,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return Either.left(new PluginLoadError({ pluginName, attempts }));
}

function createPluginInstance(
  pluginModule: Record<string, unknown>,
  pluginConfig?: PluginConfig
): Either.Either<TypeweaverPlugin, string> {
  const candidates = findPluginConstructorCandidates(pluginModule);
  if (candidates.length === 0) {
    return Either.left("No plugin constructor export found");
  }

  const errors: string[] = [];
  for (const candidate of candidates) {
    try {
      const plugin = new candidate.constructor(pluginConfig);
      if (isTypeweaverPlugin(plugin)) {
        return Either.right(plugin);
      }

      errors.push(
        `Export '${candidate.exportName}' did not produce a valid plugin with a string name`
      );
    } catch (error) {
      errors.push(
        `Export '${candidate.exportName}' could not be instantiated: ${formatError(error)}`
      );
    }
  }

  return Either.left(errors.join("; "));
}

function findPluginConstructorCandidates(
  pluginModule: Record<string, unknown>
): PluginCandidate[] {
  const candidates: PluginCandidate[] = [];

  for (const [key, value] of Object.entries(pluginModule)) {
    if (key !== "default" && typeof value === "function") {
      candidates.push({
        exportName: key,
        constructor: value as PluginConstructor,
      });
    }
  }

  // Fall back to default export for third-party plugin compatibility
  const defaultExport = pluginModule.default;
  if (typeof defaultExport === "function") {
    candidates.push({
      exportName: "default",
      constructor: defaultExport as PluginConstructor,
    });
  }

  return candidates;
}

function isTypeweaverPlugin(value: unknown): value is TypeweaverPlugin {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { readonly name?: unknown }).name === "string" &&
    (value as { readonly name: string }).name.length > 0
  );
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function generatePluginPaths(
  pluginName: string,
  strategies: readonly PluginResolutionStrategy[]
): string[] {
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
}

function toLocalImportSpecifier(pluginName: string): string {
  if (pluginName.startsWith("file:")) {
    return pluginName;
  }

  if (path.isAbsolute(pluginName)) {
    return pathToFileURL(pluginName).href;
  }

  return pluginName;
}

function reportSuccessfulLoads(successful: PluginLoadResult[]): void {
  if (successful.length > 0) {
    console.info(`Successfully loaded ${successful.length} plugin(s):`);
    for (const result of successful) {
      console.info(`  - ${result.plugin.name} (from ${result.source})`);
    }
  }
}
