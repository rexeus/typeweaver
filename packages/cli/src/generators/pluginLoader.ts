import type {
  PluginRegistryApi,
  TypeweaverConfig,
  TypeweaverPlugin,
} from "@rexeus/typeweaver-gen";
import { TypesPlugin } from "@rexeus/typeweaver-types";
import { PluginLoadingFailure } from "./errors/PluginLoadingFailure";
import type { PluginLoadError } from "./errors/PluginLoadingFailure";

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
    let result: LoadResult<PluginLoadResult, PluginLoadError>;
    if (typeof plugin === "string") {
      result = await loadPlugin(plugin, strategies);
    } else {
      result = await loadPlugin(plugin[0], strategies);
    }

    if (result.success === false) {
      throw new PluginLoadingFailure(
        result.error.pluginName,
        result.error.attempts
      );
    }

    successful.push(result.value);
    registry.register(result.value.plugin);
  }

  reportSuccessfulLoads(successful);
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
      const PluginClass = findPluginConstructor(pluginPackage);
      if (PluginClass) {
        return {
          success: true,
          value: {
            plugin: new PluginClass(),
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

function findPluginConstructor(
  pluginModule: Record<string, unknown>
): (new () => TypeweaverPlugin) | undefined {
  for (const [key, value] of Object.entries(pluginModule)) {
    if (key !== "default" && typeof value === "function") {
      return value as new () => TypeweaverPlugin;
    }
  }

  // Fall back to default export for third-party plugin compatibility
  const defaultExport = pluginModule.default;
  if (typeof defaultExport === "function") {
    return defaultExport as new () => TypeweaverPlugin;
  }

  return undefined;
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

function reportSuccessfulLoads(successful: PluginLoadResult[]): void {
  if (successful.length > 0) {
    console.info(`Successfully loaded ${successful.length} plugin(s):`);
    for (const result of successful) {
      console.info(`  - ${result.plugin.name} (from ${result.source})`);
    }
  }
}
