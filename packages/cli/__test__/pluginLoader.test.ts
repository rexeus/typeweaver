import { PluginConfigError } from "@rexeus/typeweaver-gen";
import type {
  Plugin,
  PluginConfig,
  PluginRegistryInstance,
  TypeweaverConfig,
} from "@rexeus/typeweaver-gen";
import {
  Cause,
  Data,
  Effect,
  Exit,
  Layer,
  ManagedRuntime,
  Option,
  Ref,
} from "effect";
import { afterEach, describe, expect, test } from "vitest";
import { PluginLoadError } from "../src/errors/PluginLoadError.js";
import { PluginLoader, PluginModuleLoader } from "../src/services/index.js";
import { isPluginConfigError } from "../src/services/isPluginConfigError.js";
import { TestAssertionError } from "./errors/index.js";
import {
  aModuleImportFailure,
  aNamedPluginModule,
  createPluginFixtureWorkspace,
  importPathForFile,
  inMemoryPluginModuleLoader,
  withCapturedLogs,
} from "./helpers/index.js";
import type { TaggedPluginConfigError } from "../src/services/isPluginConfigError.js";
import type { ModuleFixture } from "./helpers/index.js";

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

type CapturedPluginConfigError = TaggedPluginConfigError & {
  readonly message?: string;
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

const aConfigurablePluginModule = (
  exportName: string,
  name: string
): Record<string, unknown> => ({
  [exportName]: (config: unknown) => ({ name, config }),
});

const aForeignPluginConfigError = (options: {
  readonly pluginName: string;
  readonly reason: string;
}): CapturedPluginConfigError => {
  class ForeignPluginConfigError extends Data.TaggedError("PluginConfigError")<{
    readonly pluginName: string;
    readonly reason: string;
  }> {
    public override get message(): string {
      return `Plugin '${this.pluginName}' is misconfigured: ${this.reason}`;
    }
  }

  return new ForeignPluginConfigError(options);
};

const anIncompletePluginConfigTag = (
  pluginName: string
): { readonly _tag: "PluginConfigError"; readonly pluginName: string } => ({
  _tag: "PluginConfigError",
  pluginName,
});

const createRecordingPluginRegistry = (
  registeredPlugins: RegisteredPlugin[]
): Effect.Effect<PluginRegistryInstance> =>
  Effect.gen(function* () {
    const ref = yield* Ref.make(new Set<string>());

    const register = (plugin: Plugin, config?: unknown): Effect.Effect<void> =>
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
      validate: () => Effect.succeed([]),
    } satisfies PluginRegistryInstance;
  });

type RunParams = {
  readonly registeredPlugins: RegisteredPlugin[];
  readonly requiredPlugins: readonly Plugin[];
  readonly strategies: readonly ("npm" | "local" | "scoped")[];
  readonly config?: TypeweaverConfig;
  readonly modules?: ReadonlyMap<string, ModuleFixture>;
  readonly useRealModuleLoader?: boolean;
};

type RunResult = {
  readonly logs: readonly CapturedLog[];
};

const runLoadPluginsExit = async (params: RunParams) => {
  const moduleLoaderLayer = params.useRealModuleLoader
    ? PluginModuleLoader.Default
    : inMemoryPluginModuleLoader(params.modules ?? new Map());
  const layer = Layer.provide(
    PluginLoader.DefaultWithoutDependencies,
    moduleLoaderLayer
  );
  const runtime = ManagedRuntime.make(layer);
  try {
    return await runtime.runPromiseExit(
      withCapturedLogs(
        Effect.gen(function* () {
          const registry = yield* createRecordingPluginRegistry(
            params.registeredPlugins
          );
          yield* PluginLoader.loadAll({
            registry,
            requiredPlugins: params.requiredPlugins,
            strategies: params.strategies,
            config: params.config,
          });
        })
      )
    );
  } finally {
    await runtime.dispose();
  }
};

const runLoadPlugins = async (params: RunParams): Promise<RunResult> => {
  const exit = await runLoadPluginsExit(params);

  if (Exit.isFailure(exit)) {
    const failureOption = Cause.failureOption(exit.cause);
    if (Option.isSome(failureOption)) {
      throw failureOption.value;
    }
    throw new Error(Cause.pretty(exit.cause));
  }

  return { logs: exit.value.logs };
};

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

const captureTaggedPluginConfigError = async (
  load: Promise<RunResult>
): Promise<CapturedPluginConfigError> => {
  const failure = await load.then(
    () => undefined,
    error => error
  );

  if (!isPluginConfigError(failure)) {
    throw new TestAssertionError(
      `Expected plugin loading to fail with PluginConfigError, received: ${failure instanceof Error ? failure.message : String(failure)}`
    );
  }

  return failure;
};

const messages = (logs: readonly CapturedLog[]): readonly string[] =>
  logs.map(log => log.message);

const expectNoSuccessfulLoadSummary = (logs: readonly CapturedLog[]): void => {
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

describe("pluginLoader required plugin registration", () => {
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
});

describe("pluginLoader configured plugin reporting", () => {
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
});

describe("pluginLoader module resolution", () => {
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
});

describe("pluginLoader factory options and export fallback", () => {
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

  test("prefers a valid default export over other valid named exports", async () => {
    const registeredPlugins: RegisteredPlugin[] = [];

    await runLoadPlugins({
      registeredPlugins,
      requiredPlugins: [requiredTypesPlugin()],
      strategies: ["local"],
      modules: new Map([
        [
          "mixed-plugin",
          {
            namedPlugin: { name: "unexpected-named-plugin" },
            default: { name: "expected-default-plugin" },
          },
        ],
      ]),
      config: configWithPlugin("mixed-plugin"),
    });

    expect(registeredPlugins.map(plugin => plugin.name)).toEqual([
      "types",
      "expected-default-plugin",
    ]);
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
});

describe("pluginLoader resolution failures", () => {
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
});

describe("pluginLoader factory failures", () => {
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
});

describe("pluginLoader configuration failures", () => {
  test("surfaces plugin configuration failures from factories without wrapping them as load failures", async () => {
    const failure = await captureTaggedPluginConfigError(
      runLoadPlugins({
        registeredPlugins: [],
        requiredPlugins: [requiredTypesPlugin()],
        strategies: ["local"],
        modules: new Map([
          [
            "misconfigured-plugin",
            {
              misconfiguredPlugin: () => {
                throw new PluginConfigError({
                  pluginName: "misconfigured-plugin",
                  reason: "outputPath must end with .json",
                });
              },
            },
          ],
        ]),
        config: configWithPlugin("misconfigured-plugin"),
      })
    );

    expect(failure.pluginName).toBe("misconfigured-plugin");
    expect(failure.reason).toBe("outputPath must end with .json");
    expect(failure.message).toBe(
      "Plugin 'misconfigured-plugin' is misconfigured: outputPath must end with .json"
    );
  });

  test("stops inspecting fallback exports after a plugin factory rejects its configuration", async () => {
    let fallbackExportInvoked = false;

    const failure = await captureTaggedPluginConfigError(
      runLoadPlugins({
        registeredPlugins: [],
        requiredPlugins: [requiredTypesPlugin()],
        strategies: ["local"],
        modules: new Map([
          [
            "misconfigured-plugin",
            {
              misconfiguredPlugin: () => {
                throw new PluginConfigError({
                  pluginName: "misconfigured-plugin",
                  reason: "outputPath must end with .json",
                });
              },
              fallbackPlugin: () => {
                fallbackExportInvoked = true;
                return { name: "misconfigured-plugin" };
              },
            },
          ],
        ]),
        config: configWithPlugin("misconfigured-plugin"),
      })
    );

    expect(failure.pluginName).toBe("misconfigured-plugin");
    expect(failure.reason).toBe("outputPath must end with .json");
    expect(fallbackExportInvoked).toBe(false);
  });
});

describe("pluginLoader cross-realm configuration failures", () => {
  test("continues to fallback exports when a factory throws an incomplete configuration tag", async () => {
    let fallbackExportInvoked = false;
    const registeredPlugins: RegisteredPlugin[] = [];

    await runLoadPlugins({
      registeredPlugins,
      requiredPlugins: [requiredTypesPlugin()],
      strategies: ["local"],
      modules: new Map([
        [
          "misconfigured-plugin",
          {
            misconfiguredPlugin: () => {
              throw anIncompletePluginConfigTag("misconfigured-plugin");
            },
            fallbackPlugin: () => {
              fallbackExportInvoked = true;
              return { name: "misconfigured-plugin" };
            },
          },
        ],
      ]),
      config: configWithPlugin("misconfigured-plugin"),
    });

    expect(registeredPlugins.map(plugin => plugin.name)).toEqual([
      "types",
      "misconfigured-plugin",
    ]);
    expect(fallbackExportInvoked).toBe(true);
  });

  test("preserves configuration failures thrown from another package realm", async () => {
    /*
     * Simulates a plugin loaded against a *different copy* of
     * `@rexeus/typeweaver-gen` than the CLI — e.g., a peer-dep mismatch
     * or a hoisting failure in the consumer's node_modules. The class
     * identity differs from the imported `PluginConfigError`, but the
     * `_tag` is stable. The loader must recognise this by tag, not by
     * `instanceof`. Without this test, a regression from the tag-based
     * detector back to `instanceof` would go unnoticed.
     */
    const foreignPluginConfigError = aForeignPluginConfigError({
      pluginName: "misconfigured-plugin",
      reason: "outputPath must end with .json",
    });

    const failure = await captureTaggedPluginConfigError(
      runLoadPlugins({
        registeredPlugins: [],
        requiredPlugins: [requiredTypesPlugin()],
        strategies: ["local"],
        modules: new Map([
          [
            "misconfigured-plugin",
            {
              misconfiguredPlugin: () => {
                throw foreignPluginConfigError;
              },
            },
          ],
        ]),
        config: configWithPlugin("misconfigured-plugin"),
      })
    );

    expect(failure._tag).toBe("PluginConfigError");
    expect(failure.pluginName).toBe("misconfigured-plugin");
    expect(failure.reason).toBe("outputPath must end with .json");
  });
});

describe("pluginLoader resolution strategy short-circuiting", () => {
  test("stops trying npm fallbacks after a local plugin rejects its configuration", async () => {
    let fallbackAttempted = false;

    const failure = await captureTaggedPluginConfigError(
      runLoadPlugins({
        registeredPlugins: [],
        requiredPlugins: [requiredTypesPlugin()],
        strategies: ["local", "npm"],
        modules: new Map<string, Record<string, unknown>>([
          [
            "misconfigured-plugin",
            {
              misconfiguredPlugin: () => {
                throw new PluginConfigError({
                  pluginName: "misconfigured-plugin",
                  reason: "outputPath must end with .json",
                });
              },
            },
          ],
          [
            "@rexeus/misconfigured-plugin",
            {
              misconfiguredPlugin: () => {
                fallbackAttempted = true;
                return { name: "misconfigured-plugin" };
              },
            },
          ],
        ]),
        config: configWithPlugin("misconfigured-plugin"),
      })
    );

    expect(failure.pluginName).toBe("misconfigured-plugin");
    expect(fallbackAttempted).toBe(false);
  });

  test("stops trying later resolution strategies when module evaluation rejects plugin configuration", async () => {
    let fallbackAttempted = false;
    const foreignPluginConfigError = aForeignPluginConfigError({
      pluginName: "misconfigured-plugin",
      reason: "outputPath must end with .json",
    });

    const failure = await captureTaggedPluginConfigError(
      runLoadPlugins({
        registeredPlugins: [],
        requiredPlugins: [requiredTypesPlugin()],
        strategies: ["local", "npm"],
        modules: new Map<string, ModuleFixture>([
          [
            "misconfigured-plugin",
            aModuleImportFailure(foreignPluginConfigError),
          ],
          [
            "@rexeus/misconfigured-plugin",
            {
              misconfiguredPlugin: () => {
                fallbackAttempted = true;
                return { name: "misconfigured-plugin" };
              },
            },
          ],
        ]),
        config: configWithPlugin("misconfigured-plugin"),
      })
    );

    expect(failure.pluginName).toBe("misconfigured-plugin");
    expect(failure.reason).toBe("outputPath must end with .json");
    expect(fallbackAttempted).toBe(false);
  });
});

describe("pluginLoader invalid plugin exports", () => {
  test("continues to npm fallback when module evaluation throws an incomplete configuration tag", async () => {
    let fallbackAttempted = false;
    const registeredPlugins: RegisteredPlugin[] = [];

    await runLoadPlugins({
      registeredPlugins,
      requiredPlugins: [requiredTypesPlugin()],
      strategies: ["local", "npm"],
      modules: new Map<string, ModuleFixture>([
        [
          "misconfigured-plugin",
          aModuleImportFailure(
            anIncompletePluginConfigTag("misconfigured-plugin")
          ),
        ],
        [
          "@rexeus/typeweaver-misconfigured-plugin",
          {
            misconfiguredPlugin: () => {
              fallbackAttempted = true;
              return { name: "misconfigured-plugin" };
            },
          },
        ],
      ]),
      config: configWithPlugin("misconfigured-plugin"),
    });

    expect(registeredPlugins.map(plugin => plugin.name)).toEqual([
      "types",
      "misconfigured-plugin",
    ]);
    expect(fallbackAttempted).toBe(true);
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
          "Export 'namelessPlugin' has invalid plugin field 'name': expected a non-empty string, received undefined",
      },
    ]);
    expect(registeredPlugins.map(plugin => plugin.name)).toEqual(["types"]);
  });
});

describe("pluginLoader plugin shape validation", () => {
  test.each(
    [
      { field: "name", invalidValue: undefined, omitField: true },
      { field: "name", invalidValue: "", omitField: false },
      { field: "name", invalidValue: "   ", omitField: false },
      { field: "name", invalidValue: 42, omitField: false },
      { field: "depends", invalidValue: "valid-dependency", omitField: false },
      {
        field: "depends",
        invalidValue: ["valid-dependency", 42],
        omitField: false,
      },
      { field: "initialize", invalidValue: 42, omitField: false },
      { field: "validate", invalidValue: 42, omitField: false },
      { field: "collectResources", invalidValue: 42, omitField: false },
      { field: "generate", invalidValue: 42, omitField: false },
      { field: "finalize", invalidValue: 42, omitField: false },
    ].flatMap(invalidField => [
      { ...invalidField, exportKind: "record" },
      { ...invalidField, exportKind: "factory result" },
    ])
  )(
    "rejects invalid $field on a plugin $exportKind before registration",
    async ({ exportKind, field, invalidValue, omitField = false }) => {
      let factoryInvocations = 0;
      let lifecycleInvocations = 0;
      const lifecycleTripwire = () => {
        lifecycleInvocations += 1;
        return Effect.die("invalid plugin lifecycle must never run");
      };
      const invalidPlugin: Record<string, unknown> = {
        name: "invalid-plugin",
        initialize: lifecycleTripwire,
        validate: lifecycleTripwire,
        collectResources: lifecycleTripwire,
        generate: lifecycleTripwire,
        finalize: lifecycleTripwire,
      };
      if (omitField) {
        delete invalidPlugin[field];
      } else {
        invalidPlugin[field] = invalidValue;
      }
      const exportedValue =
        exportKind === "record"
          ? invalidPlugin
          : () => {
              factoryInvocations += 1;
              return invalidPlugin;
            };
      const registeredPlugins: RegisteredPlugin[] = [];

      const exit = await runLoadPluginsExit({
        registeredPlugins,
        requiredPlugins: [],
        strategies: ["local"],
        modules: new Map([["invalid-plugin", { default: exportedValue }]]),
        config: configWithPlugin("invalid-plugin"),
      });

      expect(Exit.isFailure(exit)).toBe(true);
      if (Exit.isFailure(exit)) {
        expect(Cause.defects(exit.cause)).toHaveLength(0);
        const failure = Cause.failureOption(exit.cause);
        expect(Option.isSome(failure)).toBe(true);
        if (Option.isSome(failure)) {
          expect(failure.value).toBeInstanceOf(PluginLoadError);
        }
        if (
          Option.isSome(failure) &&
          failure.value instanceof PluginLoadError
        ) {
          expect(failure.value.attempts).toEqual([
            {
              path: "invalid-plugin",
              error: expect.stringContaining(`field '${field}'`),
            },
          ]);
        }
      }
      expect(registeredPlugins).toEqual([]);
      expect(lifecycleInvocations).toBe(0);
      expect(factoryInvocations).toBe(exportKind === "record" ? 0 : 1);
    }
  );
});

describe("pluginLoader real-module validation", () => {
  test("rejects an invalid default export from a real module before registration", async () => {
    const pluginPath = writePluginModule([
      'export default { name: "invalid-plugin", generate: 42 };',
    ]);
    const registeredPlugins: RegisteredPlugin[] = [];

    const exit = await runLoadPluginsExit({
      registeredPlugins,
      requiredPlugins: [],
      strategies: ["local"],
      config: configWithPlugin(pluginPath),
      useRealModuleLoader: true,
    });

    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      expect(Cause.defects(exit.cause)).toHaveLength(0);
      const failure = Cause.failureOption(exit.cause);
      expect(Option.isSome(failure)).toBe(true);
      if (Option.isSome(failure)) {
        expect(failure.value).toBeInstanceOf(PluginLoadError);
      }
      if (Option.isSome(failure) && failure.value instanceof PluginLoadError) {
        expect(failure.value.attempts).toEqual([
          {
            path: importPathForFile(pluginPath),
            error: expect.stringContaining("field 'generate'"),
          },
        ]);
      }
    }
    expect(registeredPlugins).toEqual([]);
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
