import { Cause, Effect, Exit, Layer, Logger } from "effect";
import { describe, expect, test } from "vitest";
import { PluginDependencyError } from "../../src/plugins/errors/index.js";
import { PluginRegistry } from "../../src/services/PluginRegistry.js";
import type { Plugin } from "../../src/plugins/Plugin.js";

type CapturedLog = {
  readonly level: string;
  readonly message: string;
};

const capturingLoggerLayer = (sink: CapturedLog[]): Layer.Layer<never> =>
  Logger.replace(
    Logger.defaultLogger,
    Logger.make<unknown, void>(({ message, logLevel }) => {
      const text = Array.isArray(message)
        ? message.map(String).join(" ")
        : String(message);
      sink.push({ level: logLevel.label, message: text });
    })
  );

const aPluginNamed = (name: string, depends?: readonly string[]): Plugin => ({
  name,
  ...(depends !== undefined ? { depends } : {}),
});

const silentLoggerLayer = Logger.replace(
  Logger.defaultLogger,
  Logger.make<unknown, void>(() => {})
);

const runRegistry = <A, E>(
  program: (registry: {
    readonly register: (typeof PluginRegistry)["register"];
    readonly getAll: (typeof PluginRegistry)["getAll"];
    readonly clear: (typeof PluginRegistry)["clear"];
  }) => Effect.Effect<A, E, PluginRegistry>
): A =>
  Effect.runSync(
    Effect.gen(function* () {
      const registry = yield* PluginRegistry;
      return yield* program(registry);
    }).pipe(
      Effect.provide(PluginRegistry.Default),
      Effect.provide(silentLoggerLayer)
    )
  );

const runRegistryExpectingFailure = <E>(
  program: (registry: {
    readonly register: (typeof PluginRegistry)["register"];
    readonly getAll: (typeof PluginRegistry)["getAll"];
    readonly clear: (typeof PluginRegistry)["clear"];
  }) => Effect.Effect<unknown, E, PluginRegistry>
): E => {
  const exit = Effect.runSyncExit(
    Effect.gen(function* () {
      const registry = yield* PluginRegistry;
      return yield* program(registry);
    }).pipe(
      Effect.provide(PluginRegistry.Default),
      Effect.provide(silentLoggerLayer)
    )
  );

  if (Exit.isSuccess(exit)) {
    throw new Error(
      `Expected a failure but got success: ${String(exit.value)}`
    );
  }

  const failure = Cause.failureOption(exit.cause);
  if (failure._tag !== "Some") {
    throw new Error(
      `Expected typed failure but got: ${Cause.pretty(exit.cause)}`
    );
  }
  return failure.value;
};

describe("PluginRegistry", () => {
  test("returns an empty registration list when no plugins are registered", () => {
    const registrations = runRegistry(registry => registry.getAll);

    expect(registrations).toEqual([]);
  });

  test("stores registered plugins with their config under the plugin name", () => {
    const typesPlugin = aPluginNamed("types");

    const registrations = runRegistry(registry =>
      Effect.gen(function* () {
        yield* registry.register(typesPlugin, { emitDeclarations: true });
        return yield* registry.getAll;
      })
    );

    expect(registrations).toHaveLength(1);
    expect(registrations[0]).toMatchObject({
      name: "types",
      plugin: typesPlugin,
      config: { emitDeclarations: true },
    });
  });

  test("returns independent plugins in alphabetical order regardless of registration order", () => {
    const registrations = runRegistry(registry =>
      Effect.gen(function* () {
        yield* registry.register(aPluginNamed("types"));
        yield* registry.register(aPluginNamed("clients"));
        return yield* registry.getAll;
      })
    );

    expect(registrations.map(registration => registration.name)).toEqual([
      "clients",
      "types",
    ]);
  });

  test("orders plugin dependencies before their dependents", () => {
    const registrations = runRegistry(registry =>
      Effect.gen(function* () {
        yield* registry.register(aPluginNamed("clients", ["types"]));
        yield* registry.register(
          aPluginNamed("analytics", ["clients", "hono"])
        );
        yield* registry.register(aPluginNamed("types"));
        yield* registry.register(aPluginNamed("hono", ["types"]));
        return yield* registry.getAll;
      })
    );

    expect(registrations.map(registration => registration.name)).toEqual([
      "types",
      "clients",
      "hono",
      "analytics",
    ]);
  });

  test("reports the plugin and dependency names when a dependency is missing", () => {
    const failure = runRegistryExpectingFailure(registry =>
      Effect.gen(function* () {
        yield* registry.register(aPluginNamed("clients", ["types"]));
        return yield* registry.getAll;
      })
    );

    expect(failure).toBeInstanceOf(PluginDependencyError);
    expect((failure as PluginDependencyError).message).toContain(
      "Plugin 'clients' depends on 'types' which is not loaded"
    );
  });

  test("reports the dependency path when plugin dependencies contain a cycle", () => {
    const failure = runRegistryExpectingFailure(registry =>
      Effect.gen(function* () {
        yield* registry.register(aPluginNamed("types", ["clients"]));
        yield* registry.register(aPluginNamed("clients", ["analytics"]));
        yield* registry.register(aPluginNamed("analytics", ["types"]));
        return yield* registry.getAll;
      })
    );

    expect(failure).toBeInstanceOf(PluginDependencyError);
    expect((failure as PluginDependencyError).message).toContain(
      "Detected plugin dependency cycle: analytics -> types -> clients -> analytics"
    );
    expect(
      (failure as PluginDependencyError).missingDependency
    ).toBeUndefined();
  });

  test("reports a self-dependency as a dependency cycle", () => {
    const failure = runRegistryExpectingFailure(registry =>
      Effect.gen(function* () {
        yield* registry.register(aPluginNamed("types", ["types"]));
        return yield* registry.getAll;
      })
    );

    expect(failure).toBeInstanceOf(PluginDependencyError);
    expect((failure as PluginDependencyError).message).toContain(
      "Detected plugin dependency cycle: types -> types"
    );
    expect(
      (failure as PluginDependencyError).missingDependency
    ).toBeUndefined();
  });

  test("does not duplicate sorted registrations for duplicate dependency names", () => {
    const registrations = runRegistry(registry =>
      Effect.gen(function* () {
        yield* registry.register(aPluginNamed("clients", ["types", "types"]));
        yield* registry.register(aPluginNamed("types"));
        return yield* registry.getAll;
      })
    );

    expect(registrations.map(registration => registration.name)).toEqual([
      "types",
      "clients",
    ]);
  });

  test("returns a fresh ordered array for each read", () => {
    const reads = runRegistry(registry =>
      Effect.gen(function* () {
        yield* registry.register(aPluginNamed("clients", ["types"]));
        yield* registry.register(aPluginNamed("types"));
        const firstRead = yield* registry.getAll;
        const secondRead = yield* registry.getAll;
        return { firstRead, secondRead };
      })
    );

    expect(reads.secondRead).not.toBe(reads.firstRead);
    expect(reads.secondRead).toEqual(reads.firstRead);
  });

  test("reflects plugins registered after an earlier read", () => {
    const registrations = runRegistry(registry =>
      Effect.gen(function* () {
        yield* registry.register(aPluginNamed("clients", ["types"]));
        yield* registry.register(aPluginNamed("types"));
        yield* registry.getAll;
        yield* registry.register(aPluginNamed("analytics", ["clients"]));
        return yield* registry.getAll;
      })
    );

    expect(registrations.map(registration => registration.name)).toEqual([
      "types",
      "clients",
      "analytics",
    ]);
  });

  test("invalidates a successful read when a later registration has a missing dependency", () => {
    const failure = runRegistryExpectingFailure(registry =>
      Effect.gen(function* () {
        yield* registry.register(aPluginNamed("types"));
        const firstRead = yield* registry.getAll;
        if (firstRead.map(r => r.name).join() !== "types") {
          throw new Error("preconditional read failed");
        }
        yield* registry.register(aPluginNamed("clients", ["hono"]));
        return yield* registry.getAll;
      })
    );

    expect(failure).toBeInstanceOf(PluginDependencyError);
    expect((failure as PluginDependencyError).message).toContain(
      "Plugin 'clients' depends on 'hono' which is not loaded"
    );
  });

  test("clear removes registrations and previous ordering", () => {
    const registrations = runRegistry(registry =>
      Effect.gen(function* () {
        yield* registry.register(aPluginNamed("clients", ["types"]));
        yield* registry.register(aPluginNamed("types"));
        yield* registry.getAll;
        yield* registry.clear;
        yield* registry.register(aPluginNamed("analytics"));
        return yield* registry.getAll;
      })
    );

    expect(registrations.map(registration => registration.name)).toEqual([
      "analytics",
    ]);
  });

  describe("characterization: duplicate plugin names", () => {
    test("keeps the first registration when a duplicate name is registered (characterization)", () => {
      const originalPlugin = aPluginNamed("types");
      const duplicatePlugin = aPluginNamed("types", ["clients"]);

      const registrations = runRegistry(registry =>
        Effect.gen(function* () {
          yield* registry.register(originalPlugin, { source: "original" });
          yield* registry.register(duplicatePlugin, { source: "duplicate" });
          return yield* registry.getAll;
        })
      );

      expect(registrations).toHaveLength(1);
      expect(registrations[0]).toMatchObject({
        name: "types",
        plugin: originalPlugin,
        config: { source: "original" },
      });
    });
  });

  test("emits a warning log when a duplicate registration is rejected", () => {
    const logs: CapturedLog[] = [];

    Effect.runSync(
      Effect.gen(function* () {
        const registry = yield* PluginRegistry;
        yield* registry.register(aPluginNamed("types"), { source: "original" });
        yield* registry.register(aPluginNamed("types"), {
          source: "duplicate",
        });
      }).pipe(
        Effect.provide(PluginRegistry.Default),
        Effect.provide(capturingLoggerLayer(logs))
      )
    );

    const warnings = logs.filter(entry => entry.level === "WARN");
    expect(warnings).toHaveLength(1);
    expect(warnings[0]?.message).toContain(
      "Plugin 'types' is already registered; keeping the first registration"
    );
  });

  test("registers exactly one entry under concurrent duplicate registrations and keeps the first config", () => {
    const plugins: { readonly plugin: Plugin; readonly config: unknown }[] =
      Array.from({ length: 50 }, (_, idx) => ({
        plugin: aPluginNamed("types"),
        config: { idx },
      }));

    const registrations = Effect.runSync(
      Effect.gen(function* () {
        const registry = yield* PluginRegistry;
        yield* Effect.all(
          plugins.map(entry => registry.register(entry.plugin, entry.config)),
          { concurrency: "unbounded" }
        );
        return yield* registry.getAll;
      }).pipe(
        Effect.provide(PluginRegistry.Default),
        Effect.provide(silentLoggerLayer)
      )
    );

    expect(registrations).toHaveLength(1);
    const winning = registrations[0];
    expect(winning?.name).toBe("types");

    const winningSource = plugins.find(
      entry => entry.plugin === winning?.plugin
    );
    expect(winningSource).toBeDefined();
    expect(winning?.config).toBe(winningSource?.config);
  });
});
