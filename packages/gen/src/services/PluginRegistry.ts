import { Effect, Ref } from "effect";
import { PluginDependencyError } from "../plugins/errors/index.js";
import type { Plugin } from "../plugins/Plugin.js";
import type { PluginConfig } from "../plugins/contextTypes.js";

export type PluginRegistration = {
  readonly name: string;
  readonly plugin: Plugin;
  readonly config?: PluginConfig;
};

const sortPluginRegistrations = (
  registrations: readonly PluginRegistration[]
): PluginRegistration[] => {
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
};

const visitPlugin = (params: {
  readonly registration: PluginRegistration;
  readonly registrationsByName: ReadonlyMap<string, PluginRegistration>;
  readonly visiting: Set<string>;
  readonly visited: Set<string>;
  readonly sorted: PluginRegistration[];
  readonly dependencyPath: readonly string[];
}): void => {
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
    throw new PluginDependencyError({
      pluginName: registration.name,
      missingDependency: registration.name,
      cyclePath: `Detected plugin dependency cycle: ${cyclePath}`,
    });
  }

  visiting.add(registration.name);

  const alphabeticallyOrderedDependencies = [
    ...(registration.plugin.depends ?? []),
  ].sort((a, b) => a.localeCompare(b));

  for (const dependencyName of alphabeticallyOrderedDependencies) {
    const dependency = registrationsByName.get(dependencyName);
    if (dependency === undefined) {
      throw new PluginDependencyError({
        pluginName: registration.name,
        missingDependency: dependencyName,
      });
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
};

/**
 * Effect-native registry of V2 plugins. Backed by a `Ref<Map>` so that the
 * service can be shared across an entire generation run while remaining
 * resettable between runs.
 *
 * Alphabetical visit order and dependency toposort are intentionally
 * stable: generated output depends on the order in which plugins execute,
 * so any change to ordering would shift byte-identical output.
 */
export class PluginRegistry extends Effect.Service<PluginRegistry>()(
  "typeweaver/PluginRegistry",
  {
    effect: Effect.gen(function* () {
      const ref = yield* Ref.make(new Map<string, PluginRegistration>());

      const register = (
        plugin: Plugin,
        config?: PluginConfig
      ): Effect.Effect<void> =>
        Ref.update(ref, plugins => {
          if (plugins.has(plugin.name)) {
            console.info(
              `Skipping duplicate registration of required plugin: ${plugin.name}`
            );
            return plugins;
          }

          const next = new Map(plugins);
          next.set(plugin.name, { name: plugin.name, plugin, config });
          console.info(`Registered plugin: ${plugin.name}`);
          return next;
        });

      const getAll: Effect.Effect<
        readonly PluginRegistration[],
        PluginDependencyError
      > = Effect.gen(function* () {
        const plugins = yield* Ref.get(ref);
        const registrations = Array.from(plugins.values());

        return yield* Effect.try({
          try: () => sortPluginRegistrations(registrations),
          catch: error => {
            if (error instanceof PluginDependencyError) {
              return error;
            }
            throw error;
          },
        });
      });

      const clear: Effect.Effect<void> = Ref.set(
        ref,
        new Map<string, PluginRegistration>()
      );

      return { register, getAll, clear } as const;
    }),
    accessors: true,
  }
) {}
