import { Effect, Either, Ref } from "effect";
import { PluginDependencyError } from "../plugins/errors/index.js";
import type { PluginConfig } from "../plugins/contextTypes.js";
import type { Plugin } from "../plugins/Plugin.js";

export type PluginRegistration = {
  readonly name: string;
  readonly plugin: Plugin;
  readonly config?: PluginConfig;
};

/**
 * Per-call view of the plugin registry. Each call to
 * `PluginRegistry.createInstance` closes over its own `Ref<Map>` so concurrent
 * `Generator.generate` invocations cannot observe one another's registrations.
 */
export type PluginRegistryInstance = {
  readonly register: (
    plugin: Plugin,
    config?: PluginConfig
  ) => Effect.Effect<void>;
  readonly getAll: Effect.Effect<
    readonly PluginRegistration[],
    PluginDependencyError
  >;
};

/**
 * Pure toposort over the registration set. Returns `Either` instead of
 * throwing: the failure is part of the function's contract, and `Either`
 * is yieldable so `getAll` lifts it straight into the Effect error channel
 * without a throw/catch round-trip.
 */
const sortPluginRegistrations = (
  registrations: readonly PluginRegistration[]
): Either.Either<PluginRegistration[], PluginDependencyError> => {
  const registrationsByName = new Map(
    registrations.map(registration => [registration.name, registration])
  );
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const sorted: PluginRegistration[] = [];

  const alphabeticallyOrderedRegistrations = [...registrations].sort((a, b) =>
    a.name < b.name ? -1 : a.name > b.name ? 1 : 0
  );

  for (const registration of alphabeticallyOrderedRegistrations) {
    const failure = visitPlugin({
      registration,
      registrationsByName,
      visiting,
      visited,
      sorted,
      dependencyPath: [],
    });
    if (failure !== undefined) {
      return Either.left(failure);
    }
  }

  return Either.right(sorted);
};

const visitPlugin = (params: {
  readonly registration: PluginRegistration;
  readonly registrationsByName: ReadonlyMap<string, PluginRegistration>;
  readonly visiting: Set<string>;
  readonly visited: Set<string>;
  readonly sorted: PluginRegistration[];
  readonly dependencyPath: readonly string[];
}): PluginDependencyError | undefined => {
  const {
    registration,
    registrationsByName,
    visiting,
    visited,
    sorted,
    dependencyPath,
  } = params;

  if (visited.has(registration.name)) {
    return undefined;
  }

  if (visiting.has(registration.name)) {
    const cyclePath = [...dependencyPath, registration.name].join(" -> ");
    return new PluginDependencyError({
      pluginName: registration.name,
      cyclePath: `Detected plugin dependency cycle: ${cyclePath}`,
    });
  }

  visiting.add(registration.name);

  const alphabeticallyOrderedDependencies = [
    ...(registration.plugin.depends ?? []),
  ].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

  for (const dependencyName of alphabeticallyOrderedDependencies) {
    const dependency = registrationsByName.get(dependencyName);
    if (dependency === undefined) {
      return new PluginDependencyError({
        pluginName: registration.name,
        missingDependency: dependencyName,
      });
    }

    const failure = visitPlugin({
      registration: dependency,
      registrationsByName,
      visiting,
      visited,
      sorted,
      dependencyPath: [...dependencyPath, registration.name],
    });
    if (failure !== undefined) {
      return failure;
    }
  }

  visiting.delete(registration.name);
  visited.add(registration.name);
  sorted.push(registration);
  return undefined;
};

/**
 * Creates a fresh registry instance backed by an isolated `Ref<Map>`. Each
 * `Generator.generate` call yields its own instance so two concurrent runs
 * cannot leak registrations into one another.
 */
const createInstance = (): Effect.Effect<PluginRegistryInstance> =>
  Effect.gen(function* () {
    const ref = yield* Ref.make(new Map<string, PluginRegistration>());

    const register = (
      plugin: Plugin,
      config?: PluginConfig
    ): Effect.Effect<void> =>
      Effect.gen(function* () {
        // `Ref.modify` runs the transition atomically, closing the
        // check-then-update race two concurrent fibers would otherwise
        // hit on the same plugin name. The first registration wins; the
        // outcome tag drives the post-modification log.
        const outcome = yield* Ref.modify(ref, current => {
          if (current.has(plugin.name)) {
            return ["duplicate" as const, current];
          }
          const next = new Map(current);
          next.set(plugin.name, { name: plugin.name, plugin, config });
          return ["registered" as const, next];
        });

        if (outcome === "duplicate") {
          yield* Effect.logWarning(
            `Plugin '${plugin.name}' is already registered; keeping the first registration`
          );
          return;
        }

        yield* Effect.logInfo(`Registered plugin: ${plugin.name}`);
      });

    const getAll: Effect.Effect<
      readonly PluginRegistration[],
      PluginDependencyError
    > = Effect.gen(function* () {
      const plugins = yield* Ref.get(ref);
      return yield* sortPluginRegistrations(Array.from(plugins.values()));
    });

    return { register, getAll } as const;
  });

/**
 * Effect-native factory of V2 plugin registries. The service exposes a
 * single `createInstance` effect that constructs a fresh
 * `PluginRegistryInstance` backed by its own `Ref<Map>`. `Generator.generate`
 * yields a new instance per call so concurrent generations have fully
 * isolated registrations.
 *
 * Alphabetical visit order and dependency toposort are intentionally
 * stable: generated output depends on the order in which plugins execute,
 * so any change to ordering would shift byte-identical output.
 */
export class PluginRegistry extends Effect.Service<PluginRegistry>()(
  "typeweaver/PluginRegistry",
  {
    succeed: { createInstance },
    accessors: true,
  }
) {}
