import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { PluginRegistry } from "@rexeus/typeweaver-gen";
import type {
  Plugin,
  PluginConfig,
  TypeweaverConfig,
} from "@rexeus/typeweaver-gen";
import { Cause, Effect, Exit, Layer, ManagedRuntime, Ref } from "effect";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { PluginLoadError } from "../src/generators/errors/PluginLoadError.js";
import { PluginLoader } from "../src/services/PluginLoader.js";
import { TestAssertionError } from "./errors/index.js";

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

const importPathForFile = (filePath: string): string =>
  pathToFileURL(filePath).href;

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

const runLoadPlugins = async (params: {
  readonly registeredPlugins: RegisteredPlugin[];
  readonly requiredPlugins: readonly Plugin[];
  readonly strategies: readonly ("npm" | "local" | "scoped")[];
  readonly config?: TypeweaverConfig;
}): Promise<void> => {
  const recordingRegistry = createRecordingPluginRegistryLayer(
    params.registeredPlugins
  );
  const layer = Layer.provide(
    PluginLoader.DefaultWithoutDependencies,
    recordingRegistry
  );
  const runtime = ManagedRuntime.make(layer);
  try {
    const exit = await runtime.runPromiseExit(
      PluginLoader.loadAll({
        requiredPlugins: params.requiredPlugins,
        strategies: params.strategies,
        config: params.config,
      })
    );
    if (Exit.isFailure(exit)) {
      const failureOption = Cause.failureOption(exit.cause);
      if (failureOption._tag === "Some") {
        throw failureOption.value;
      }
      throw new Error(Cause.pretty(exit.cause));
    }
  } finally {
    await runtime.dispose();
  }
};

describe("pluginLoader", () => {
  const tempDirs: string[] = [];

  beforeEach(() => {
    vi.spyOn(console, "info").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();

    for (const tempDir of tempDirs) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }

    tempDirs.length = 0;
  });

  const createTempDir = (): string => {
    const tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "typeweaver-plugin-")
    );
    tempDirs.push(tempDir);

    return tempDir;
  };

  const writePluginModule = (source: readonly string[]): string => {
    const pluginPath = path.join(createTempDir(), "plugin.mjs");

    fs.writeFileSync(pluginPath, [...source, ""].join("\n"));

    return pluginPath;
  };

  const writeConfigurablePluginModule = (): string =>
    writePluginModule([
      'export const configurablePlugin = config => ({',
      '  name: "configurable-plugin",',
      "  config,",
      "});",
    ]);

  const capturePluginLoadError = async (
    load: Promise<void>
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

  const expectNoSuccessfulLoadSummary = (): void => {
    expect(vi.mocked(console.info)).not.toHaveBeenCalledWith(
      expect.stringMatching(/Successfully loaded/)
    );
  };

  const expectSuccessfulLoadSummary = ({
    count,
    pluginName,
    source,
  }: {
    readonly count: number;
    readonly pluginName: string;
    readonly source: string;
  }): void => {
    expectSuccessfulLoadSummaryEntries({
      count,
      entries: [{ pluginName, source }],
    });
  };

  const expectSuccessfulLoadSummaryEntries = ({
    count,
    entries,
  }: {
    readonly count: number;
    readonly entries: readonly SuccessfulLoadSummaryEntry[];
  }): void => {
    const info = vi.mocked(console.info);

    expect(info).toHaveBeenCalledWith(
      `Successfully loaded ${count} plugin(s):`
    );
    for (const entry of entries) {
      expect(info).toHaveBeenCalledWith(
        `  - ${entry.pluginName} (from ${entry.source})`
      );
    }
  };

  test("registers required plugins when config is absent", async () => {
    const registeredPlugins: RegisteredPlugin[] = [];

    await runLoadPlugins({
      registeredPlugins,
      requiredPlugins: [requiredTypesPlugin()],
      strategies: ["local"],
    });

    expect(registeredPlugins.map(plugin => plugin.name)).toEqual(["types"]);
    expectNoSuccessfulLoadSummary();
  });

  test("registers required plugins when plugins are omitted", async () => {
    const registeredPlugins: RegisteredPlugin[] = [];

    await runLoadPlugins({
      registeredPlugins,
      requiredPlugins: [requiredTypesPlugin()],
      strategies: ["local"],
      config: configWithoutPlugins(),
    });

    expect(registeredPlugins.map(plugin => plugin.name)).toEqual(["types"]);
    expectNoSuccessfulLoadSummary();
  });

  test("registers required plugins before configured plugins", async () => {
    const pluginPath = writePluginModule([
      'export const localPlugin = { name: "local-plugin" };',
    ]);
    const registeredPlugins: RegisteredPlugin[] = [];

    await runLoadPlugins({
      registeredPlugins,
      requiredPlugins: [requiredTypesPlugin()],
      strategies: ["local"],
      config: {
        input: "./spec.ts",
        output: "./generated",
        plugins: [pluginPath],
      },
    });

    expect(registeredPlugins.map(plugin => plugin.name)).toEqual([
      "types",
      "local-plugin",
    ]);
  });

  test("loads a named plugin record exported from an absolute local file path", async () => {
    const pluginPath = writePluginModule([
      'export const namedPlugin = { name: "named-plugin" };',
    ]);
    const registeredPlugins: RegisteredPlugin[] = [];

    await runLoadPlugins({
      registeredPlugins,
      requiredPlugins: [requiredTypesPlugin()],
      strategies: ["local"],
      config: configWithPlugin(pluginPath),
    });

    expect(registeredPlugins.map(plugin => plugin.name)).toEqual([
      "types",
      "named-plugin",
    ]);
  });

  test("reports configured plugin count, name, and source", async () => {
    const pluginPath = writePluginModule([
      'export const reportedPlugin = { name: "reported-plugin" };',
    ]);

    await runLoadPlugins({
      registeredPlugins: [],
      requiredPlugins: [requiredTypesPlugin()],
      strategies: ["local"],
      config: configWithPlugin(pluginPath),
    });

    expectSuccessfulLoadSummary({
      count: 1,
      pluginName: "reported-plugin",
      source: importPathForFile(pluginPath),
    });
  });

  test("reports multiple configured plugins in config order", async () => {
    const firstPath = writePluginModule([
      'export const firstPlugin = { name: "first-plugin" };',
    ]);
    const secondPath = writePluginModule([
      'export const secondPlugin = { name: "second-plugin" };',
    ]);
    const registeredPlugins: RegisteredPlugin[] = [];

    await runLoadPlugins({
      registeredPlugins,
      requiredPlugins: [requiredTypesPlugin()],
      strategies: ["local"],
      config: {
        input: "./spec.ts",
        output: "./generated",
        plugins: [firstPath, secondPath],
      },
    });

    expect(registeredPlugins.map(plugin => plugin.name)).toEqual([
      "types",
      "first-plugin",
      "second-plugin",
    ]);
    expectSuccessfulLoadSummaryEntries({
      count: 2,
      entries: [
        {
          pluginName: "first-plugin",
          source: importPathForFile(firstPath),
        },
        {
          pluginName: "second-plugin",
          source: importPathForFile(secondPath),
        },
      ],
    });
  });

  test("loads a named plugin record exported from a file URL", async () => {
    const pluginPath = writePluginModule([
      'export const fileUrlPlugin = { name: "file-url-plugin" };',
    ]);
    const pluginUrl = importPathForFile(pluginPath);
    const registeredPlugins: RegisteredPlugin[] = [];

    await runLoadPlugins({
      registeredPlugins,
      requiredPlugins: [requiredTypesPlugin()],
      strategies: ["local"],
      config: configWithPlugin(pluginUrl),
    });

    expect(registeredPlugins.map(plugin => plugin.name)).toEqual([
      "types",
      "file-url-plugin",
    ]);
    expectSuccessfulLoadSummary({
      count: 1,
      pluginName: "file-url-plugin",
      source: pluginUrl,
    });
  });

  test("falls through failed npm attempts to load a local plugin", async () => {
    const pluginPath = writePluginModule([
      'export const localFallbackPlugin = { name: "local-fallback-plugin" };',
    ]);
    const registeredPlugins: RegisteredPlugin[] = [];

    await runLoadPlugins({
      registeredPlugins,
      requiredPlugins: [requiredTypesPlugin()],
      strategies: ["npm", "local"],
      config: configWithPlugin(pluginPath),
    });

    expect(registeredPlugins.map(plugin => plugin.name)).toEqual([
      "types",
      "local-fallback-plugin",
    ]);
    expectSuccessfulLoadSummary({
      count: 1,
      pluginName: "local-fallback-plugin",
      source: importPathForFile(pluginPath),
    });
  });

  test("falls back to a default plugin record export", async () => {
    const pluginPath = writePluginModule([
      'export default { name: "default-plugin" };',
    ]);
    const registeredPlugins: RegisteredPlugin[] = [];

    await runLoadPlugins({
      registeredPlugins,
      requiredPlugins: [requiredTypesPlugin()],
      strategies: ["local"],
      config: configWithPlugin(pluginPath),
    });

    expect(registeredPlugins.map(plugin => plugin.name)).toEqual([
      "types",
      "default-plugin",
    ]);
  });

  test("passes tuple plugin options to a plugin factory", async () => {
    const pluginPath = writeConfigurablePluginModule();
    const options = { marker: "from tuple" };
    const registeredPlugins: RegisteredPlugin[] = [];

    await runLoadPlugins({
      registeredPlugins,
      requiredPlugins: [requiredTypesPlugin()],
      strategies: ["local"],
      config: configWithPlugin([pluginPath, options]),
    });

    expect(registeredPlugins[1]?.plugin).toMatchObject({ config: options });
  });

  test("passes tuple plugin options to the registry registration", async () => {
    const pluginPath = writeConfigurablePluginModule();
    const options = { marker: "from tuple" };
    const registeredPlugins: RegisteredPlugin[] = [];

    await runLoadPlugins({
      registeredPlugins,
      requiredPlugins: [requiredTypesPlugin()],
      strategies: ["local"],
      config: configWithPlugin([pluginPath, options]),
    });

    expect(registeredPlugins[1]?.config).toEqual(options);
  });

  test("skips non-plugin exports and registers the first valid plugin shape", async () => {
    const pluginPath = writePluginModule([
      "export const helper = { helper: true };",
      'export const validPlugin = { name: "valid-plugin" };',
    ]);
    const registeredPlugins: RegisteredPlugin[] = [];

    await runLoadPlugins({
      registeredPlugins,
      requiredPlugins: [requiredTypesPlugin()],
      strategies: ["local"],
      config: configWithPlugin(pluginPath),
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

  test("reports npm package attempts when a package plugin is missing", async () => {
    const failure = await capturePluginLoadError(
      runLoadPlugins({
        registeredPlugins: [],
        requiredPlugins: [requiredTypesPlugin()],
        strategies: ["npm"],
        config: configWithPlugin("missing-plugin"),
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
    const pluginPath = writePluginModule(["// no exports"]);

    const failure = await capturePluginLoadError(
      runLoadPlugins({
        registeredPlugins: [],
        requiredPlugins: [requiredTypesPlugin()],
        strategies: ["local"],
        config: configWithPlugin(pluginPath),
      })
    );

    expect(failure.attempts).toEqual([
      {
        path: importPathForFile(pluginPath),
        error: "No plugin export found",
      },
    ]);
  });

  test("captures factory failures in plugin loading attempts", async () => {
    const pluginPath = writePluginModule([
      "export const brokenPlugin = () => {",
      ...createThrowingModuleSource({
        errorName: "PluginFactoryError",
        message: "factory failed",
        indent: "  ",
      }),
      "};",
    ]);

    const failure = await capturePluginLoadError(
      runLoadPlugins({
        registeredPlugins: [],
        requiredPlugins: [requiredTypesPlugin()],
        strategies: ["local"],
        config: configWithPlugin(pluginPath),
      })
    );

    expect(failure.attempts).toEqual([
      {
        path: importPathForFile(pluginPath),
        error:
          "Export 'brokenPlugin' could not be instantiated: factory failed",
      },
    ]);
  });

  test("rejects exports without a plugin name", async () => {
    const pluginPath = writePluginModule([
      "export const namelessPlugin = { generate: () => {} };",
    ]);
    const registeredPlugins: RegisteredPlugin[] = [];

    const failure = await capturePluginLoadError(
      runLoadPlugins({
        registeredPlugins,
        requiredPlugins: [requiredTypesPlugin()],
        strategies: ["local"],
        config: configWithPlugin(pluginPath),
      })
    );

    expect(failure.attempts).toEqual([
      {
        path: importPathForFile(pluginPath),
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
