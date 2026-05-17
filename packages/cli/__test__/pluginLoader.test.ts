import { PluginRegistry } from "@rexeus/typeweaver-gen";
import type {
  Plugin,
  PluginConfig,
  TypeweaverConfig,
} from "@rexeus/typeweaver-gen";
import { Cause, Effect, Exit, Layer, ManagedRuntime, Ref } from "effect";
import { afterEach, describe, expect, test } from "vitest";
import { PluginLoadError } from "../src/generators/errors/PluginLoadError.js";
import { PluginLoader, PluginModuleLoader } from "../src/services/index.js";
import { TestAssertionError } from "./errors/index.js";
import {
  createPluginFixtureWorkspace,
  importPathForFile,
  inMemoryPluginModuleLoader,
  withCapturedLogs,
} from "./helpers/index.js";

type CapturedLog = {
  readonly level: string;
  readonly message: string;
};

type RegisteredPlugin = {
  readonly name: string;
  readonly plugin: Plugin;
  readonly config?: unknown;
};

type SuccessfulLoadSummaryEntry = {
  readonly pluginName: string;
  readonly source: string;
};

const requiredTypesPlugin = (): Plugin => ({
  name: "types",
});

const configWithPlugin = (
  plugin: string | [string, PluginConfig]
): TypeweaverConfig => ({
  input: "./spec.ts",
  output: "./generated",
  plugins: [plugin],
});

const configWithoutPlugins = (): TypeweaverConfig => ({
  input: "./spec.ts",
  output: "./generated",
});

const aNamedPluginModule = (name: string): Record<string, unknown> => ({
  [`${name}Plugin`]: { name },
});

const aConfigurablePluginModule = (
  exportName: string,
  name: string
): Record<string, unknown> => ({
  [exportName]: (config: unknown) => ({ name, config }),
});

const createRecordingPluginRegistryLayer = (
  registeredPlugins: RegisteredPlugin[]
): Layer.Layer<PluginRegistry> =>
  Layer.scoped(
    PluginRegistry,
    Effect.gen(function* () {
      const ref = yield* Ref.make(new Set<string>());

      const register = (
        plugin: Plugin,
        config?: unknown
      ): Effect.Effect<void> =>
        Effect.gen(function* () {
          const known = yield* Ref.get(ref);
          if (known.has(plugin.name)) {
            return;
          }
          yield* Ref.update(ref, set => {
            const next = new Set(set);
            next.add(plugin.name);
            return next;
          });
          registeredPlugins.push({
            name: plugin.name,
            plugin,
            config,
          });
        });

      return {
        register,
        getAll: Effect.succeed([] as never),
        clear: Effect.sync(() => {
          registeredPlugins.length = 0;
        }),
      } as unknown as PluginRegistry;
    })
  );

type RunParams = {
  readonly registeredPlugins: RegisteredPlugin[];
  readonly requiredPlugins: readonly Plugin[];
  readonly strategies: readonly ("npm" | "local" | "scoped")[];
  readonly config?: TypeweaverConfig;
  readonly modules?: ReadonlyMap<string, Record<string, unknown>>;
  readonly useRealModuleLoader?: boolean;
};

type RunResult = {
  readonly logs: readonly CapturedLog[];
};

const runLoadPlugins = async (params: RunParams): Promise<RunResult> => {
  const recordingRegistry = createRecordingPluginRegistryLayer(
    params.registeredPlugins
  );
  const moduleLoaderLayer = params.useRealModuleLoader
    ? PluginModuleLoader.Default
    : inMemoryPluginModuleLoader(params.modules ?? new Map());
  const layer = Layer.provide(
    PluginLoader.DefaultWithoutDependencies,
    Layer.mergeAll(recordingRegistry, moduleLoaderLayer)
  );
  const runtime = ManagedRuntime.make(layer);
  try {
    const exit = await runtime.runPromiseExit(
      withCapturedLogs(
        PluginLoader.loadAll({
          requiredPlugins: params.requiredPlugins,
          strategies: params.strategies,
          config: params.config,
        })
      )
    );
    if (Exit.isFailure(exit)) {
      const failureOption = Cause.failureOption(exit.cause);
      if (failureOption._tag === "Some") {
        throw failureOption.value;
      }
      throw new Error(Cause.pretty(exit.cause));
    }
    return { logs: exit.value.logs };
  } finally {
    await runtime.dispose();
  }
};

describe("pluginLoader", () => {
  const fixtures = createPluginFixtureWorkspace();
  const writePluginModule = fixtures.writePluginModule;

  afterEach(() => {
    fixtures.cleanup();
  });

  const createThrowingModuleSource = (options: {
    readonly errorName: string;
    readonly message: string;
    readonly indent?: string;
  }): string[] => {
    const indent = options.indent ?? "";

    return [
      `${indent}class ${options.errorName} extends Error {`,
      `${indent}  name = "${options.errorName}";`,
      `${indent}}`,
      `${indent}throw new ${options.errorName}(${JSON.stringify(options.message)});`,
    ];
  };

  const capturePluginLoadError = async (
    load: Promise<RunResult>
  ): Promise<PluginLoadError> => {
    const failure = await load.then(
      () => undefined,
      error => error
    );

    if (!(failure instanceof PluginLoadError)) {
      throw new TestAssertionError(
        `Expected plugin loading to fail with PluginLoadError, received: ${failure instanceof Error ? failure.message : String(failure)}`
      );
    }

    return failure;
  };

  const messages = (logs: readonly CapturedLog[]): readonly string[] =>
    logs.map(log => log.message);

  const expectNoSuccessfulLoadSummary = (
    logs: readonly CapturedLog[]
  ): void => {
    expect(messages(logs)).not.toEqual(
      expect.arrayContaining([expect.stringMatching(/Successfully loaded/)])
    );
  };

  const expectSuccessfulLoadSummary = (
    logs: readonly CapturedLog[],
    expected: {
      readonly count: number;
      readonly pluginName: string;
      readonly source: string;
    }
  ): void => {
    expectSuccessfulLoadSummaryEntries(logs, {
      count: expected.count,
      entries: [{ pluginName: expected.pluginName, source: expected.source }],
    });
  };

  const expectSuccessfulLoadSummaryEntries = (
    logs: readonly CapturedLog[],
    expected: {
      readonly count: number;
      readonly entries: readonly SuccessfulLoadSummaryEntry[];
    }
  ): void => {
    const observed = messages(logs);

    expect(observed).toContain(
      `Successfully loaded ${expected.count} plugin(s):`
    );
    for (const entry of expected.entries) {
      expect(observed).toContain(
        `  - ${entry.pluginName} (from ${entry.source})`
      );
    }
  };

  test("registers required plugins when config is absent", async () => {
    const registeredPlugins: RegisteredPlugin[] = [];

    const { logs } = await runLoadPlugins({
      registeredPlugins,
      requiredPlugins: [requiredTypesPlugin()],
      strategies: ["local"],
    });

    expect(registeredPlugins.map(plugin => plugin.name)).toEqual(["types"]);
    expectNoSuccessfulLoadSummary(logs);
  });

  test("registers required plugins when plugins are omitted", async () => {
    const registeredPlugins: RegisteredPlugin[] = [];

    const { logs } = await runLoadPlugins({
      registeredPlugins,
      requiredPlugins: [requiredTypesPlugin()],
      strategies: ["local"],
      config: configWithoutPlugins(),
    });

    expect(registeredPlugins.map(plugin => plugin.name)).toEqual(["types"]);
    expectNoSuccessfulLoadSummary(logs);
  });

  test("registers required plugins before configured plugins", async () => {
    const registeredPlugins: RegisteredPlugin[] = [];

    await runLoadPlugins({
      registeredPlugins,
      requiredPlugins: [requiredTypesPlugin()],
      strategies: ["local"],
      modules: new Map([["local-plugin", aNamedPluginModule("local-plugin")]]),
      config: {
        input: "./spec.ts",
        output: "./generated",
        plugins: ["local-plugin"],
      },
    });

    expect(registeredPlugins.map(plugin => plugin.name)).toEqual([
      "types",
      "local-plugin",
    ]);
  });

  test("loads a named plugin record from an in-memory specifier", async () => {
    const registeredPlugins: RegisteredPlugin[] = [];

    await runLoadPlugins({
      registeredPlugins,
      requiredPlugins: [requiredTypesPlugin()],
      strategies: ["local"],
      modules: new Map([["named-plugin", aNamedPluginModule("named-plugin")]]),
      config: configWithPlugin("named-plugin"),
    });

    expect(registeredPlugins.map(plugin => plugin.name)).toEqual([
      "types",
      "named-plugin",
    ]);
  });

  test("reports configured plugin count, name, and source", async () => {
    const { logs } = await runLoadPlugins({
      registeredPlugins: [],
      requiredPlugins: [requiredTypesPlugin()],
      strategies: ["local"],
      modules: new Map([
        ["reported-plugin", aNamedPluginModule("reported-plugin")],
      ]),
      config: configWithPlugin("reported-plugin"),
    });

    expectSuccessfulLoadSummary(logs, {
      count: 1,
      pluginName: "reported-plugin",
      source: "reported-plugin",
    });
  });

  test("reports multiple configured plugins in config order", async () => {
    const registeredPlugins: RegisteredPlugin[] = [];

    const { logs } = await runLoadPlugins({
      registeredPlugins,
      requiredPlugins: [requiredTypesPlugin()],
      strategies: ["local"],
      modules: new Map([
        ["first-plugin", aNamedPluginModule("first-plugin")],
        ["second-plugin", aNamedPluginModule("second-plugin")],
      ]),
      config: {
        input: "./spec.ts",
        output: "./generated",
        plugins: ["first-plugin", "second-plugin"],
      },
    });

    expect(registeredPlugins.map(plugin => plugin.name)).toEqual([
      "types",
      "first-plugin",
      "second-plugin",
    ]);
    expectSuccessfulLoadSummaryEntries(logs, {
      count: 2,
      entries: [
        { pluginName: "first-plugin", source: "first-plugin" },
        { pluginName: "second-plugin", source: "second-plugin" },
      ],
    });
  });

  test("loads a named plugin class exported from a file URL", async () => {
    // Real-fs scenario: this test exercises the absolute-path -> file URL
    // conversion in `toLocalImportSpecifier`, which is module-resolution
    // mechanics — the in-memory loader would bypass exactly what we want
    // to verify here.
    const pluginPath = writePluginModule([
      'export const fileUrlPlugin = { name: "file-url-plugin" };',
    ]);
    const pluginUrl = importPathForFile(pluginPath);
    const registeredPlugins: RegisteredPlugin[] = [];

    const { logs } = await runLoadPlugins({
      registeredPlugins,
      requiredPlugins: [requiredTypesPlugin()],
      strategies: ["local"],
      config: configWithPlugin(pluginUrl),
      useRealModuleLoader: true,
    });

    expect(registeredPlugins.map(plugin => plugin.name)).toEqual([
      "types",
      "file-url-plugin",
    ]);
    expectSuccessfulLoadSummary(logs, {
      count: 1,
      pluginName: "file-url-plugin",
      source: pluginUrl,
    });
  });

  test("falls through failed npm attempts to load a local plugin", async () => {
    const registeredPlugins: RegisteredPlugin[] = [];

    const { logs } = await runLoadPlugins({
      registeredPlugins,
      requiredPlugins: [requiredTypesPlugin()],
      strategies: ["npm", "local"],
      modules: new Map([
        ["local-fallback-plugin", aNamedPluginModule("local-fallback-plugin")],
      ]),
      config: configWithPlugin("local-fallback-plugin"),
    });

    expect(registeredPlugins.map(plugin => plugin.name)).toEqual([
      "types",
      "local-fallback-plugin",
    ]);
    expectSuccessfulLoadSummary(logs, {
      count: 1,
      pluginName: "local-fallback-plugin",
      source: "local-fallback-plugin",
    });
  });

  test("falls back to a default plugin record export", async () => {
    const registeredPlugins: RegisteredPlugin[] = [];

    await runLoadPlugins({
      registeredPlugins,
      requiredPlugins: [requiredTypesPlugin()],
      strategies: ["local"],
      modules: new Map([
        ["default-plugin", { default: { name: "default-plugin" } }],
      ]),
      config: configWithPlugin("default-plugin"),
    });

    expect(registeredPlugins.map(plugin => plugin.name)).toEqual([
      "types",
      "default-plugin",
    ]);
  });

  test("passes tuple plugin options to a plugin factory", async () => {
    const options = { marker: "from tuple" };
    const registeredPlugins: RegisteredPlugin[] = [];

    await runLoadPlugins({
      registeredPlugins,
      requiredPlugins: [requiredTypesPlugin()],
      strategies: ["local"],
      modules: new Map([
        [
          "configurable-plugin",
          aConfigurablePluginModule(
            "configurablePlugin",
            "configurable-plugin"
          ),
        ],
      ]),
      config: configWithPlugin(["configurable-plugin", options]),
    });

    expect(registeredPlugins[1]?.plugin).toMatchObject({ config: options });
  });

  test("passes tuple plugin options to the registry registration", async () => {
    const options = { marker: "from tuple" };
    const registeredPlugins: RegisteredPlugin[] = [];

    await runLoadPlugins({
      registeredPlugins,
      requiredPlugins: [requiredTypesPlugin()],
      strategies: ["local"],
      modules: new Map([
        [
          "configurable-plugin",
          aConfigurablePluginModule(
            "configurablePlugin",
            "configurable-plugin"
          ),
        ],
      ]),
      config: configWithPlugin(["configurable-plugin", options]),
    });

    expect(registeredPlugins[1]?.config).toEqual(options);
  });

  test("skips non-plugin exports and registers the first valid plugin shape", async () => {
    const registeredPlugins: RegisteredPlugin[] = [];

    await runLoadPlugins({
      registeredPlugins,
      requiredPlugins: [requiredTypesPlugin()],
      strategies: ["local"],
      modules: new Map([
        [
          "mixed-plugin",
          {
            helper: { helper: true },
            validPlugin: { name: "valid-plugin" },
          },
        ],
      ]),
      config: configWithPlugin("mixed-plugin"),
    });

    expect(registeredPlugins.map(plugin => plugin.name)).toEqual([
      "types",
      "valid-plugin",
    ]);
  });

  test("reports attempted paths and errors when a plugin cannot be resolved", async () => {
    const failure = await capturePluginLoadError(
      runLoadPlugins({
        registeredPlugins: [],
        requiredPlugins: [requiredTypesPlugin()],
        strategies: ["local"],
        config: configWithPlugin("missing-plugin"),
      })
    );

    expect(failure.pluginName).toBe("missing-plugin");
    expect(failure.attempts).toEqual([
      {
        path: "missing-plugin",
        error: expect.stringMatching(/\S/),
      },
    ]);
  });

  test("wraps PluginModuleNotFoundError into the attempts[].error message", async () => {
    const failure = await capturePluginLoadError(
      runLoadPlugins({
        registeredPlugins: [],
        requiredPlugins: [requiredTypesPlugin()],
        strategies: ["local"],
        modules: new Map(),
        config: configWithPlugin("missing"),
      })
    );

    expect(failure.pluginName).toBe("missing");
    expect(failure.attempts).toHaveLength(1);
    expect(failure.attempts[0]).toEqual({
      path: "missing",
      error: "Cannot find module 'missing' imported from in-memory map",
    });
  });

  test("reports npm package attempts when a package plugin is missing", async () => {
    // Real-fs scenario: exercises the npm-strategy path resolution
    // (`@rexeus/typeweaver-X` + `@rexeus/X`) against Node's actual import
    // failure — the in-memory loader would mask the real attempts.
    const failure = await capturePluginLoadError(
      runLoadPlugins({
        registeredPlugins: [],
        requiredPlugins: [requiredTypesPlugin()],
        strategies: ["npm"],
        config: configWithPlugin("missing-plugin"),
        useRealModuleLoader: true,
      })
    );

    expect(failure.pluginName).toBe("missing-plugin");
    expect(failure.attempts).toEqual([
      {
        path: "@rexeus/typeweaver-missing-plugin",
        error: expect.stringMatching(/\S/),
      },
      {
        path: "@rexeus/missing-plugin",
        error: expect.stringMatching(/\S/),
      },
    ]);
  });

  test("captures module evaluation failures in plugin loading attempts", async () => {
    // Real-fs scenario: a thrown error during module evaluation is what
    // Node's import() raises — testing that the loader carries it through
    // requires a real module evaluation, not an in-memory map.
    const pluginPath = writePluginModule(
      createThrowingModuleSource({
        errorName: "PluginEvaluationError",
        message: "evaluation failed",
      })
    );

    const failure = await capturePluginLoadError(
      runLoadPlugins({
        registeredPlugins: [],
        requiredPlugins: [requiredTypesPlugin()],
        strategies: ["local"],
        config: configWithPlugin(pluginPath),
        useRealModuleLoader: true,
      })
    );

    expect(failure.pluginName).toBe(pluginPath);
    expect(failure.attempts).toEqual([
      {
        path: importPathForFile(pluginPath),
        error: "evaluation failed",
      },
    ]);
  });

  test("reports no plugin export found when a module has no exports", async () => {
    const failure = await capturePluginLoadError(
      runLoadPlugins({
        registeredPlugins: [],
        requiredPlugins: [requiredTypesPlugin()],
        strategies: ["local"],
        modules: new Map([["empty-plugin", {}]]),
        config: configWithPlugin("empty-plugin"),
      })
    );

    expect(failure.attempts).toEqual([
      {
        path: "empty-plugin",
        error: "No plugin export found",
      },
    ]);
  });

  test("captures factory failures in plugin loading attempts", async () => {
    const failure = await capturePluginLoadError(
      runLoadPlugins({
        registeredPlugins: [],
        requiredPlugins: [requiredTypesPlugin()],
        strategies: ["local"],
        modules: new Map([
          [
            "broken-plugin",
            {
              brokenPlugin: () => {
                throw new Error("factory failed");
              },
            },
          ],
        ]),
        config: configWithPlugin("broken-plugin"),
      })
    );

    expect(failure.attempts).toEqual([
      {
        path: "broken-plugin",
        error:
          "Export 'brokenPlugin' could not be instantiated: factory failed",
      },
    ]);
  });

  test("rejects exports without a plugin name", async () => {
    const registeredPlugins: RegisteredPlugin[] = [];

    const failure = await capturePluginLoadError(
      runLoadPlugins({
        registeredPlugins,
        requiredPlugins: [requiredTypesPlugin()],
        strategies: ["local"],
        modules: new Map([
          [
            "nameless-plugin",
            {
              namelessPlugin: { generate: () => undefined },
            },
          ],
        ]),
        config: configWithPlugin("nameless-plugin"),
      })
    );

    expect(failure.attempts).toEqual([
      {
        path: "nameless-plugin",
        error:
          "Export 'namelessPlugin' did not produce a valid plugin with a string name",
      },
    ]);
    expect(registeredPlugins.map(plugin => plugin.name)).toEqual(["types"]);
  });

  test("reports a scoped package attempt when the scoped strategy cannot load it", async () => {
    const failure = await capturePluginLoadError(
      runLoadPlugins({
        registeredPlugins: [],
        requiredPlugins: [requiredTypesPlugin()],
        strategies: ["scoped"],
        config: configWithPlugin("@example/missing-plugin"),
      })
    );

    expect(failure.pluginName).toBe("@example/missing-plugin");
    expect(failure.attempts).toEqual([
      {
        path: "@example/missing-plugin",
        error: expect.stringMatching(/\S/),
      },
    ]);
  });
});
