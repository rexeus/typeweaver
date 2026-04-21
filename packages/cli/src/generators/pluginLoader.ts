import type {
  PluginRegistryApi,
  TypeweaverConfig,
  TypeweaverPlugin,
} from "@rexeus/typeweaver-gen";
import { TypesPlugin } from "@rexeus/typeweaver-types";
import { PluginLoadingFailure } from "./errors/pluginLoadingFailure.js";
import type { Logger } from "../logger.js";
import type { PluginLoadError } from "./errors/pluginLoadingFailure.js";

export type PluginResolutionStrategy = "npm" | "local" | "scoped";

export type PluginLoadResult = {
  plugin: TypeweaverPlugin;
  source: string;
};

type LoadResult<T, E> =
  | { success: true; value: T }
  | { success: false; error: E };

export async function loadPlugins(
  registry: PluginRegistryApi,
  requiredPlugins: [TypesPlugin],
  strategies: PluginResolutionStrategy[],
  logger: Logger,
  config?: TypeweaverConfig
): Promise<void> {
  for (const requiredPlugin of requiredPlugins) {
    registry.register(requiredPlugin);
  }

  if (!config?.plugins) {
    return;
  }

  const successful: PluginLoadResult[] = [];

  for (const entry of config.plugins) {
    const { name, pluginConfig } = parsePluginEntry(entry);
    const result = await loadPlugin(name, strategies);

    if (result.success === false) {
      throw new PluginLoadingFailure(
        result.error.pluginName,
        result.error.attempts
      );
    }

    successful.push(result.value);
    registry.register(result.value.plugin, pluginConfig);
  }

  reportSuccessfulLoads(successful, logger);
}

function parsePluginEntry(
  entry: string | readonly [string, ...unknown[]]
): { name: string; pluginConfig: unknown } {
  if (typeof entry === "string") {
    return { name: entry, pluginConfig: undefined };
  }
  return { name: entry[0], pluginConfig: entry[1] };
}

async function loadPlugin(
  pluginName: string,
  strategies: PluginResolutionStrategy[]
): Promise<LoadResult<PluginLoadResult, PluginLoadError>> {
  const possiblePaths = generatePluginPaths(pluginName, strategies);
  const attempts: { path: string; error: string }[] = [];

  for (const possiblePath of possiblePaths) {
    try {
      const pluginPackage = await import(possiblePath);
      const plugin = instantiatePlugin(pluginPackage);
      if (plugin) {
        return {
          success: true,
          value: {
            plugin,
            source: possiblePath,
          },
        };
      }
      attempts.push({
        path: possiblePath,
        error: "No plugin class export found",
      });
    } catch (error) {
      attempts.push({
        path: possiblePath,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return {
    success: false,
    error: {
      pluginName,
      attempts,
    },
  };
}

function instantiatePlugin(
  pluginModule: Record<string, unknown>
): TypeweaverPlugin | undefined {
  for (const [key, value] of Object.entries(pluginModule)) {
    if (key === "default" || typeof value !== "function") {
      continue;
    }
    const plugin = tryConstruct(value);
    if (plugin) {
      return plugin;
    }
  }

  // Fall back to default export for third-party plugin compatibility
  const defaultExport = pluginModule.default;
  if (typeof defaultExport === "function") {
    return tryConstruct(defaultExport);
  }

  return undefined;
}

function tryConstruct(value: Function): TypeweaverPlugin | undefined {
  let instance: unknown;
  try {
    instance = Reflect.construct(value, []);
  } catch {
    return undefined;
  }
  return isTypeweaverPlugin(instance) ? instance : undefined;
}

function isTypeweaverPlugin(value: unknown): value is TypeweaverPlugin {
  if (value === null || typeof value !== "object") {
    return false;
  }
  const candidate = value as { name?: unknown; generate?: unknown };
  return typeof candidate.name === "string" && candidate.name.length > 0;
}

function generatePluginPaths(
  pluginName: string,
  strategies: PluginResolutionStrategy[]
): string[] {
  const paths: string[] = [];

  for (const strategy of strategies) {
    switch (strategy) {
      case "npm":
        paths.push(`@rexeus/typeweaver-${pluginName}`);
        paths.push(`@rexeus/${pluginName}`);
        break;
      case "local":
        paths.push(pluginName);
        break;
    }
  }

  return paths;
}

function reportSuccessfulLoads(
  successful: PluginLoadResult[],
  logger: Logger
): void {
  if (successful.length > 0) {
    logger.info(`Successfully loaded ${successful.length} plugin(s):`);
    for (const result of successful) {
      logger.info(`  - ${result.plugin.name} (from ${result.source})`);
    }
  }
}
