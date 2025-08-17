import type { PluginRegistration, TypeweaverPlugin } from "./types";

/**
 * Registry for managing typeweaver plugins
 */
export class PluginRegistry {
  private plugins: Map<string, PluginRegistration>;

  public constructor() {
    this.plugins = new Map();
  }

  /**
   * Register a plugin
   */
  public register(plugin: TypeweaverPlugin, config?: unknown): void {
    if (this.plugins.has(plugin.name)) {
      console.info(
        `Skipping duplicate registration of required plugin: ${plugin.name}`
      );
      return;
    }

    const registration: PluginRegistration = {
      name: plugin.name,
      plugin,
      config: config as Record<string, unknown>,
    };

    this.plugins.set(plugin.name, registration);
    console.info(`Registered plugin: ${plugin.name}`);
  }

  /**
   * Get a registered plugin
   */
  public get(name: string): PluginRegistration | undefined {
    return this.plugins.get(name);
  }

  /**
   * Get all registered plugins
   */
  public getAll(): PluginRegistration[] {
    return Array.from(this.plugins.values());
  }

  /**
   * Check if a plugin is registered
   */
  public has(name: string): boolean {
    return this.plugins.has(name);
  }

  /**
   * Clear all registered plugins (except required ones)
   */
  public clear(): void {
    this.plugins.clear();
  }
}
