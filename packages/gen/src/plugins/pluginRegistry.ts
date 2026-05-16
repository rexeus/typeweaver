import { PluginDependencyError } from "./types.js";
import type { PluginRegistration, TypeweaverPlugin } from "./types.js";

export type PluginRegistryApi = {
  readonly register: (plugin: TypeweaverPlugin, config?: unknown) => void;
  readonly get: (name: string) => PluginRegistration | undefined;
  readonly getAll: () => PluginRegistration[];
  readonly has: (name: string) => boolean;
  readonly clear: () => void;
};

export function createPluginRegistry(): PluginRegistryApi {
  const plugins = new Map<string, PluginRegistration>();
  let sortedRegistrations: PluginRegistration[] | undefined;

  const invalidateSortedRegistrations = (): void => {
    sortedRegistrations = undefined;
  };

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
      invalidateSortedRegistrations();
      console.info(`Registered plugin: ${plugin.name}`);
    },
    get: (name: string) => plugins.get(name),
    getAll: () => {
      if (sortedRegistrations === undefined) {
        sortedRegistrations = sortPluginRegistrations(
          Array.from(plugins.values())
        );
      }

      return [...sortedRegistrations];
    },
    has: (name: string) => plugins.has(name),
    clear: () => {
      plugins.clear();
      invalidateSortedRegistrations();
    },
  };
}

function sortPluginRegistrations(
  registrations: readonly PluginRegistration[]
): PluginRegistration[] {
  const registrationsByName = new Map(
    registrations.map(registration => [registration.name, registration])
  );
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const sorted: PluginRegistration[] = [];

  const alphabeticallyOrderedRegistrations = [...registrations].sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  for (const registration of alphabeticallyOrderedRegistrations) {
    visitPlugin({
      registration,
      registrationsByName,
      visiting,
      visited,
      sorted,
      dependencyPath: [],
    });
  }

  return sorted;
}

function visitPlugin(params: {
  readonly registration: PluginRegistration;
  readonly registrationsByName: ReadonlyMap<string, PluginRegistration>;
  readonly visiting: Set<string>;
  readonly visited: Set<string>;
  readonly sorted: PluginRegistration[];
  readonly dependencyPath: readonly string[];
}): void {
  const {
    registration,
    registrationsByName,
    visiting,
    visited,
    sorted,
    dependencyPath,
  } = params;

  if (visited.has(registration.name)) {
    return;
  }

  if (visiting.has(registration.name)) {
    const cyclePath = [...dependencyPath, registration.name].join(" -> ");
    throw new PluginDependencyError(
      registration.name,
      registration.name,
      `Detected plugin dependency cycle: ${cyclePath}`
    );
  }

  visiting.add(registration.name);

  const alphabeticallyOrderedDependencies = [
    ...(registration.plugin.depends ?? []),
  ].sort((a, b) => a.localeCompare(b));

  for (const dependencyName of alphabeticallyOrderedDependencies) {
    const dependency = registrationsByName.get(dependencyName);
    if (dependency === undefined) {
      throw new PluginDependencyError(registration.name, dependencyName);
    }

    visitPlugin({
      registration: dependency,
      registrationsByName,
      visiting,
      visited,
      sorted,
      dependencyPath: [...dependencyPath, registration.name],
    });
  }

  visiting.delete(registration.name);
  visited.add(registration.name);
  sorted.push(registration);
}
