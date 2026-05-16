import path from "node:path";
import { pathToFileURL } from "node:url";
import type {
  PluginConfig,
  PluginConstructor,
  TypeweaverConfig,
  TypeweaverPlugin,
} from "@rexeus/typeweaver-gen";
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

type LoadResult<T, E> =
  | { success: true; value: T }
  | { success: false; error: E };

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

    if (result.success === false) {
      throw result.error;
    }

    successful.push(result.value);
    registry.register(result.value.plugin, result.value.config);
  }

  reportSuccessfulLoads(successful);
}

async function loadPlugin(
  pluginName: string,
  strategies: readonly PluginResolutionStrategy[],
  pluginConfig?: PluginConfig
): Promise<LoadResult<PluginLoadResult, PluginLoadError>> {
  const possiblePaths = generatePluginPaths(pluginName, strategies);
  const attempts: { path: string; error: string }[] = [];

  for (const possiblePath of possiblePaths) {
    try {
      const pluginPackage = await import(possiblePath);
      const plugin = createPluginInstance(pluginPackage, pluginConfig);
      if (plugin.success) {
        return {
          success: true,
          value: {
            plugin: plugin.value,
            source: possiblePath,
            config: pluginConfig,
          },
        };
      }
      attempts.push({
        path: possiblePath,
        error: plugin.error,
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
    error: new PluginLoadError({ pluginName, attempts }),
  };
}

function createPluginInstance(
  pluginModule: Record<string, unknown>,
  pluginConfig?: PluginConfig
): LoadResult<TypeweaverPlugin, string> {
  const candidates = findPluginConstructorCandidates(pluginModule);
  if (candidates.length === 0) {
    return {
      success: false,
      error: "No plugin constructor export found",
    };
  }

  const errors: string[] = [];
  for (const candidate of candidates) {
    try {
      const plugin = new candidate.constructor(pluginConfig);
      if (isTypeweaverPlugin(plugin)) {
        return {
          success: true,
          value: plugin,
        };
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

  return {
    success: false,
    error: errors.join("; "),
  };
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
