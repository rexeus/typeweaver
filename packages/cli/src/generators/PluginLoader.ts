import type {
  TypeWeaverPlugin,
  TypeWeaverConfig,
  PluginRegistry,
} from "@rexeus/typeweaver-gen";
import TypesPlugin from "@rexeus/typeweaver-types";
import {
  PluginLoadingFailure,
  type PluginLoadError,
} from "./errors/PluginLoadingFailure";

export type PluginResolutionStrategy = "npm" | "local" | "scoped";

export type PluginLoadResult = {
  plugin: TypeWeaverPlugin;
  source: string;
};

type LoadResult<T, E> =
  | { success: true; value: T }
  | { success: false; error: E };

/**
 * Handles plugin discovery and loading for TypeWeaver
 */
export class PluginLoader {
  public constructor(
    private readonly registry: PluginRegistry,
    private readonly requiredPlugins: [TypesPlugin],
    private readonly strategies: PluginResolutionStrategy[] = ["npm", "local"]
  ) {
    //
  }

  /**
   * Load all plugins from configuration
   */
  public async loadPlugins(config?: TypeWeaverConfig): Promise<void> {
    for (const requiredPlugin of this.requiredPlugins) {
      this.registry.register(requiredPlugin);
    }

    if (!config?.plugins) {
      return;
    }

    const successful: PluginLoadResult[] = [];

    for (const plugin of config.plugins) {
      let result: LoadResult<PluginLoadResult, PluginLoadError>;
      if (typeof plugin === "string") {
        result = await this.loadPlugin(plugin);
      } else {
        result = await this.loadPlugin(plugin[0]);
      }

      if (result.success === false) {
        throw new PluginLoadingFailure(
          result.error.pluginName,
          result.error.attempts
        );
      }

      successful.push(result.value);
      this.registry.register(result.value.plugin);
    }

    this.reportSuccessfulLoads(successful);
  }

  /**
   * Load a plugin from a string identifier
   */
  private async loadPlugin(
    pluginName: string
  ): Promise<LoadResult<PluginLoadResult, PluginLoadError>> {
    const possiblePaths = this.generatePluginPaths(pluginName);
    const attempts: Array<{ path: string; error: string }> = [];

    for (const possiblePath of possiblePaths) {
      try {
        const pluginPackage = await import(possiblePath);
        if (pluginPackage.default) {
          return {
            success: true,
            value: {
              plugin: new pluginPackage.default(),
              source: possiblePath,
            },
          };
        }
        attempts.push({
          path: possiblePath,
          error: "No default export found",
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

  /**
   * Generate possible plugin paths based on configured strategies
   */
  private generatePluginPaths(pluginName: string): string[] {
    const paths: string[] = [];

    for (const strategy of this.strategies) {
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

  /**
   * Report successful plugin loads
   */
  private reportSuccessfulLoads(successful: PluginLoadResult[]): void {
    if (successful.length > 0) {
      console.info(`Successfully loaded ${successful.length} plugin(s):`);
      for (const result of successful) {
        console.info(`  - ${result.plugin.name} (from ${result.source})`);
      }
    }
  }
}
