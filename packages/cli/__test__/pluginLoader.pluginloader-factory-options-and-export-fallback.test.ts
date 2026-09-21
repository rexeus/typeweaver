import { afterEach, describe, expect, test } from "vitest";
import { PluginLoadError } from "../src/errors/PluginLoadError.js";
import { TestAssertionError } from "./errors/index.js";
import {
  configWithPlugin,
  createPluginFixtureWorkspace,
  importPathForFile,
  requiredTypesPlugin,
  runLoadPlugins,
} from "./helpers/index.js";
import type {
  PluginLoaderRunResult,
  RegisteredPlugin,
} from "./helpers/index.js";

const aConfigurablePluginModule = (
  exportName: string,
  name: string
): Record<string, unknown> => ({
  [exportName]: (config: unknown) => ({ name, config }),
});

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
  load: Promise<PluginLoaderRunResult>
): Promise<PluginLoadError> => {
  const failure: unknown = await load.then(
    () => undefined,
    (error: unknown) => error
  );

  if (!(failure instanceof PluginLoadError)) {
    throw new TestAssertionError(
      `Expected plugin loading to fail with PluginLoadError, received: ${failure instanceof Error ? failure.message : String(failure)}`
    );
  }

  return failure;
};

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
        error: expect.stringMatching(/\S/) as unknown,
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
        error: expect.stringMatching(/\S/) as unknown,
      },
      {
        path: "@rexeus/missing-plugin",
        error: expect.stringMatching(/\S/) as unknown,
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
