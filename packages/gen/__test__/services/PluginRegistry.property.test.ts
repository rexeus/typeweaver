import { Cause, Effect, Exit, Logger } from "effect";
import {
  assert,
  property,
  stringMatching,
  subarray,
  tuple,
  uniqueArray,
} from "fast-check";
import { describe, expect, test } from "vitest";
import { PluginDependencyError } from "../../src/plugins/errors/index.js";
import { PluginRegistry } from "../../src/services/PluginRegistry.js";
import type { Plugin } from "../../src/plugins/Plugin.js";
import type { Arbitrary } from "fast-check";

const aPluginNamed = (name: string, depends?: readonly string[]): Plugin => ({
  name,
  ...(depends !== undefined ? { depends } : {}),
});

const silentLoggerLayer = Logger.replace(
  Logger.defaultLogger,
  Logger.make<unknown, void>(() => {})
);

const runWithRegistry = <A, E>(
  program: (
    registry: typeof PluginRegistry.Service
  ) => Effect.Effect<A, E, PluginRegistry>
): Exit.Exit<A, E> =>
  Effect.runSyncExit(
    Effect.gen(function* () {
      const registry = yield* PluginRegistry;
      return yield* program(registry);
    }).pipe(
      Effect.provide(PluginRegistry.Default),
      Effect.provide(silentLoggerLayer)
    )
  );

/**
 * Arbitrary that generates a non-empty plugin name made of lowercase
 * letters. Restricting the alphabet keeps the test names readable when
 * fast-check reports a counter-example.
 */
const pluginNameArb = stringMatching(/^[a-z]{1,8}$/).filter(
  name => name.length > 0
);

/**
 * Generates a DAG of plugins: a non-empty set of unique names, then for
 * each plugin (after the first) it picks zero or more of the previously
 * declared plugins as its dependencies. The construction guarantees the
 * absence of cycles by depending only on earlier plugins in the array.
 */
const pluginDagArb: Arbitrary<readonly Plugin[]> = uniqueArray(pluginNameArb, {
  minLength: 1,
  maxLength: 8,
}).chain(names =>
  tuple(
    ...names.map((name, index) =>
      subarray(names.slice(0, index)).map(depends =>
        aPluginNamed(name, depends.length > 0 ? depends : undefined)
      )
    )
  )
);

describe("PluginRegistry (properties)", () => {
  test("toposort places every dependency before its dependents", () => {
    assert(
      property(pluginDagArb, plugins => {
        const exit = runWithRegistry(registry =>
          Effect.gen(function* () {
            for (const plugin of plugins) {
              yield* registry.register(plugin);
            }
            return yield* registry.getAll;
          })
        );

        if (Exit.isFailure(exit)) {
          throw new Error(`Expected success, got: ${Cause.pretty(exit.cause)}`);
        }

        const order = exit.value.map(registration => registration.name);
        for (const plugin of plugins) {
          const index = order.indexOf(plugin.name);
          for (const dep of plugin.depends ?? []) {
            expect(order.indexOf(dep)).toBeLessThan(index);
          }
        }
      })
    );
  });

  test("plugins with no shared dependencies appear in alphabetical order regardless of registration order", () => {
    assert(
      property(
        uniqueArray(pluginNameArb, { minLength: 1, maxLength: 8 }),
        names => {
          const shuffled = [...names].reverse();
          const exit = runWithRegistry(registry =>
            Effect.gen(function* () {
              for (const name of shuffled) {
                yield* registry.register(aPluginNamed(name));
              }
              return yield* registry.getAll;
            })
          );

          if (Exit.isFailure(exit)) {
            throw new Error(
              `Expected success, got: ${Cause.pretty(exit.cause)}`
            );
          }

          const observed = exit.value.map(registration => registration.name);
          const alphabetical = [...names].sort((a, b) => a.localeCompare(b));
          expect(observed).toEqual(alphabetical);
        }
      )
    );
  });

  test("registering the same plugin name twice keeps the first registration", () => {
    assert(
      property(pluginNameArb, name => {
        const original = aPluginNamed(name);
        const duplicate = aPluginNamed(name);

        const exit = runWithRegistry(registry =>
          Effect.gen(function* () {
            yield* registry.register(original, { tag: "first" });
            yield* registry.register(duplicate, { tag: "second" });
            return yield* registry.getAll;
          })
        );

        if (Exit.isFailure(exit)) {
          throw new Error(`Expected success, got: ${Cause.pretty(exit.cause)}`);
        }

        expect(exit.value).toHaveLength(1);
        expect(exit.value[0]).toMatchObject({
          name,
          plugin: original,
          config: { tag: "first" },
        });
      })
    );
  });

  test("self-dependency fails with PluginDependencyError regardless of where it is registered", () => {
    assert(
      property(
        uniqueArray(pluginNameArb, { minLength: 1, maxLength: 6 }),
        pluginNameArb,
        (siblingNames, selfDependentName) => {
          const allNames = [...siblingNames, selfDependentName];
          const uniqueNames = Array.from(new Set(allNames));
          if (uniqueNames.length < 2) {
            return;
          }

          const siblings = uniqueNames
            .filter(name => name !== selfDependentName)
            .map(name => aPluginNamed(name));
          const selfDependent = aPluginNamed(selfDependentName, [
            selfDependentName,
          ]);

          // Interleave: self-dependent plugin first, last, and middle
          const orderings: readonly (readonly Plugin[])[] = [
            [selfDependent, ...siblings],
            [...siblings, selfDependent],
            [
              ...siblings.slice(0, Math.floor(siblings.length / 2)),
              selfDependent,
              ...siblings.slice(Math.floor(siblings.length / 2)),
            ],
          ];

          for (const plugins of orderings) {
            const exit = runWithRegistry(registry =>
              Effect.gen(function* () {
                for (const plugin of plugins) {
                  yield* registry.register(plugin);
                }
                return yield* registry.getAll;
              })
            );

            if (Exit.isSuccess(exit)) {
              throw new Error(
                `Expected cycle detection, got order: ${exit.value.map(r => r.name).join(",")}`
              );
            }

            const failure = Cause.failureOption(exit.cause);
            expect(failure._tag).toBe("Some");
            if (failure._tag === "Some") {
              expect(failure.value).toBeInstanceOf(PluginDependencyError);
            }
          }
        }
      )
    );
  });

  test("toposort of a diamond DAG places the shared dependency first regardless of registration order", () => {
    // Fixed diamond: a -> b, c; b -> d; c -> d.
    // Expected toposort with alphabetical tie-break: d, b, c, a.
    const diamond: readonly Plugin[] = [
      aPluginNamed("a", ["b", "c"]),
      aPluginNamed("b", ["d"]),
      aPluginNamed("c", ["d"]),
      aPluginNamed("d"),
    ];

    assert(
      property(subarray(["a", "b", "c", "d"]), () => {
        // Re-register the same plugin set in two extreme orders (forward and
        // reversed) and assert the toposort output is invariant.
        const forward = [...diamond];
        const reversed = [...diamond].reverse();

        const runOrdering = (plugins: readonly Plugin[]): readonly string[] => {
          const exit = runWithRegistry(registry =>
            Effect.gen(function* () {
              for (const plugin of plugins) {
                yield* registry.register(plugin);
              }
              return yield* registry.getAll;
            })
          );
          if (Exit.isFailure(exit)) {
            throw new Error(
              `Expected success, got: ${Cause.pretty(exit.cause)}`
            );
          }
          return exit.value.map(registration => registration.name);
        };

        const expected = ["d", "b", "c", "a"];
        expect(runOrdering(forward)).toEqual(expected);
        expect(runOrdering(reversed)).toEqual(expected);
      })
    );
  });

  test("registries with a dependency cycle fail with PluginDependencyError", () => {
    assert(
      property(
        uniqueArray(pluginNameArb, { minLength: 2, maxLength: 6 }),
        names => {
          // Build a strict cycle: a -> b -> c -> ... -> a
          const plugins = names.map((name, index) => {
            const next = names[(index + 1) % names.length] ?? name;
            return aPluginNamed(name, [next]);
          });

          const exit = runWithRegistry(registry =>
            Effect.gen(function* () {
              for (const plugin of plugins) {
                yield* registry.register(plugin);
              }
              return yield* registry.getAll;
            })
          );

          if (Exit.isSuccess(exit)) {
            throw new Error(
              `Expected cycle detection, got order: ${exit.value.map(r => r.name).join(",")}`
            );
          }

          const failure = Cause.failureOption(exit.cause);
          expect(failure._tag).toBe("Some");
          if (failure._tag === "Some") {
            expect(failure.value).toBeInstanceOf(PluginDependencyError);
          }
        }
      )
    );
  });

  test("an empty registry produces an empty getAll result", () => {
    const exit = runWithRegistry(registry => registry.getAll);

    if (Exit.isFailure(exit)) {
      throw new Error(`Expected success, got: ${Cause.pretty(exit.cause)}`);
    }
    expect(exit.value).toEqual([]);
  });

  test("registration order does not affect the toposort output for any DAG", () => {
    assert(
      property(pluginDagArb, plugins => {
        const reversed = [...plugins].reverse();

        const runOrdering = (
          orderedPlugins: readonly Plugin[]
        ): readonly string[] => {
          const exit = runWithRegistry(registry =>
            Effect.gen(function* () {
              for (const plugin of orderedPlugins) {
                yield* registry.register(plugin);
              }
              return yield* registry.getAll;
            })
          );

          if (Exit.isFailure(exit)) {
            throw new Error(
              `Expected success, got: ${Cause.pretty(exit.cause)}`
            );
          }
          return exit.value.map(registration => registration.name);
        };

        expect(runOrdering(plugins)).toEqual(runOrdering(reversed));
      })
    );
  });
});
