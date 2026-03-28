import type { PluginRegistration, TypeweaverPlugin } from "./types";

export type PluginRegistryApi = {
  readonly register: (plugin: TypeweaverPlugin, config?: unknown) => void;
  readonly get: (name: string) => PluginRegistration | undefined;
  readonly getAll: () => PluginRegistration[];
  readonly has: (name: string) => boolean;
  readonly clear: () => void;
};

export function createPluginRegistry(): PluginRegistryApi {
  const plugins = new Map<string, PluginRegistration>();

  return {
    register: (plugin: TypeweaverPlugin, config?: unknown): void => {
      if (plugins.has(plugin.name)) {
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

      plugins.set(plugin.name, registration);
      console.info(`Registered plugin: ${plugin.name}`);
    },
    get: (name: string) => plugins.get(name),
    getAll: () => Array.from(plugins.values()),
    has: (name: string) => plugins.has(name),
    clear: () => plugins.clear(),
  };
}
