import type {
  PluginRegistryApi,
  TypeweaverConfig,
  TypeweaverPlugin,
} from "@rexeus/typeweaver-gen";
import { TypesPlugin } from "@rexeus/typeweaver-types";
import { PluginLoadingFailure } from "./errors/pluginLoadingFailure.js";
import type { Logger } from "../logger.js";
import type { PluginLoadError } from "./errors/pluginLoadingFailure.js";

export type PluginResolutionStrategy = "npm" | "local";

export type PluginLoadResult = {
  readonly plugin: TypeweaverPlugin;
  readonly source: string;
};

type LoadResult<T, E> =
  | { readonly success: true; readonly value: T }
  | { readonly success: false; readonly error: E };

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

function parsePluginEntry(entry: string | readonly [string, ...unknown[]]): {
  name: string;
  pluginConfig: unknown;
} {
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
      const result = instantiatePlugin(pluginPackage);
      if (result.success) {
        return {
          success: true,
          value: {
            plugin: result.plugin,
            source: possiblePath,
          },
        };
      }
      attempts.push({
        path: possiblePath,
        error: result.error,
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

type PluginClass = new (...args: never[]) => unknown;

type InstantiateResult =
  | { readonly success: true; readonly plugin: TypeweaverPlugin }
  | { readonly success: false; readonly error: string };

type ConstructResult =
  | { readonly success: true; readonly plugin: TypeweaverPlugin }
  | { readonly success: false; readonly reason: string };

function instantiatePlugin(
  pluginModule: Record<string, unknown>
): InstantiateResult {
  const failures: string[] = [];

  for (const [key, value] of Object.entries(pluginModule)) {
    if (key === "default" || !isPluginClass(value)) {
      continue;
    }
    const result = tryConstruct(value);
    if (result.success) {
      return result;
    }
    failures.push(`${key}: ${result.reason}`);
  }

  // Fall back to default export for third-party plugin compatibility
  const defaultExport = pluginModule.default;
  if (isPluginClass(defaultExport)) {
    const result = tryConstruct(defaultExport);
    if (result.success) {
      return result;
    }
    failures.push(`default: ${result.reason}`);
  }

  return {
    success: false,
    error:
      failures.length > 0
        ? `Failed to instantiate a plugin from module exports — ${failures.join("; ")}`
        : "No plugin class export found",
  };
}

function tryConstruct(value: PluginClass): ConstructResult {
  let instance: unknown;
  try {
    instance = Reflect.construct(value, []);
  } catch (error) {
    return {
      success: false,
      reason: `constructor threw ${error instanceof Error ? error.message : String(error)}`,
    };
  }
  if (!isTypeweaverPlugin(instance)) {
    return {
      success: false,
      reason: "instance is not a typeweaver plugin (missing non-empty 'name')",
    };
  }
  return { success: true, plugin: instance };
}

// Classes expose a non-writable `prototype`; regular functions are writable,
// and arrows/methods have none. Skipping non-classes keeps factory helpers
// from being invoked during plugin discovery.
function isPluginClass(value: unknown): value is PluginClass {
  if (typeof value !== "function") {
    return false;
  }
  const descriptor = Object.getOwnPropertyDescriptor(value, "prototype");
  return descriptor !== undefined && descriptor.writable === false;
}

function isTypeweaverPlugin(value: unknown): value is TypeweaverPlugin {
  if (value === null || typeof value !== "object") {
    return false;
  }
  const candidate = value as { name?: unknown };
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
