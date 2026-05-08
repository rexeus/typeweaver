import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type {
  PluginConfig,
  TypeweaverConfig,
  TypeweaverPlugin,
} from "@rexeus/typeweaver-gen";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { PluginLoadingFailure } from "../src/generators/errors/PluginLoadingFailure.js";
import { loadPlugins } from "../src/generators/pluginLoader.js";
import type { PluginRegistrar } from "../src/generators/pluginLoader.js";

type RegisteredPlugin = {
  readonly name: string;
  readonly plugin: TypeweaverPlugin;
  readonly config?: unknown;
};

type SuccessfulLoadSummaryEntry = {
  readonly pluginName: string;
  readonly source: string;
};

const requiredTypesPlugin = (): TypeweaverPlugin => ({
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

function createRegistry(): {
  readonly registry: PluginRegistrar;
  readonly registeredPlugins: RegisteredPlugin[];
} {
  const registeredPlugins: RegisteredPlugin[] = [];

  return {
    registry: {
      register: (plugin: TypeweaverPlugin, config?: unknown) => {
        registeredPlugins.push({
          name: plugin.name,
          plugin,
          config,
        });
      },
    },
    registeredPlugins,
  };
}

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
      "export class ConfigurablePlugin {",
      "  constructor(config) {",
      '    this.name = "configurable-plugin";',
      "    this.config = config;",
      "  }",
      "}",
    ]);

  const capturePluginLoadingFailure = async (
    load: Promise<void>
  ): Promise<PluginLoadingFailure> => {
    const failure = await load.then(
      () => undefined,
      error => error
    );

    if (!(failure instanceof PluginLoadingFailure)) {
      throw new Error("Expected plugin loading to fail with PluginLoadingFailure");
    }

    return failure;
  };

  const expectNoSuccessfulLoadSummary = (): void => {
    expect(vi.mocked(console.info)).not.toHaveBeenCalled();
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

    expect(info).toHaveBeenCalledTimes(entries.length + 1);
    expect(info).toHaveBeenNthCalledWith(
      1,
      `Successfully loaded ${count} plugin(s):`
    );

    entries.forEach((entry, index) => {
      expect(info).toHaveBeenNthCalledWith(
        index + 2,
        `  - ${entry.pluginName} (from ${entry.source})`
      );
    });
  };

  test("registers required plugins when config is absent", async () => {
    const { registry, registeredPlugins } = createRegistry();

    await loadPlugins(registry, [requiredTypesPlugin()], ["local"]);

    expect(registeredPlugins.map(plugin => plugin.name)).toEqual(["types"]);
    expectNoSuccessfulLoadSummary();
  });

  test("registers required plugins when plugins are omitted", async () => {
    const { registry, registeredPlugins } = createRegistry();

    await loadPlugins(
      registry,
      [requiredTypesPlugin()],
      ["local"],
      configWithoutPlugins()
    );

    expect(registeredPlugins.map(plugin => plugin.name)).toEqual(["types"]);
    expectNoSuccessfulLoadSummary();
  });

  test("registers required plugins before configured plugins", async () => {
    const pluginPath = writePluginModule([
      "export class LocalPlugin {",
      '  name = "local-plugin";',
      "}",
    ]);
    const { registry, registeredPlugins } = createRegistry();

    await loadPlugins(registry, [requiredTypesPlugin()], ["local"], {
      input: "./spec.ts",
      output: "./generated",
      plugins: [pluginPath],
    });

    expect(registeredPlugins.map(plugin => plugin.name)).toEqual([
      "types",
      "local-plugin",
    ]);
  });

  test("loads a named plugin class exported from an absolute local file path", async () => {
    const pluginPath = writePluginModule([
      "export class NamedPlugin {",
      '  name = "named-plugin";',
      "}",
    ]);
    const { registry, registeredPlugins } = createRegistry();

    await loadPlugins(
      registry,
      [requiredTypesPlugin()],
      ["local"],
      configWithPlugin(pluginPath)
    );

    expect(registeredPlugins.map(plugin => plugin.name)).toEqual([
      "types",
      "named-plugin",
    ]);
  });

  test("reports configured plugin count, name, and source", async () => {
    const pluginPath = writePluginModule([
      "export class ReportedPlugin {",
      '  name = "reported-plugin";',
      "}",
    ]);
    const { registry } = createRegistry();

    await loadPlugins(
      registry,
      [requiredTypesPlugin()],
      ["local"],
      configWithPlugin(pluginPath)
    );

    expectSuccessfulLoadSummary({
      count: 1,
      pluginName: "reported-plugin",
      source: importPathForFile(pluginPath),
    });
  });

  test("reports multiple configured plugins in config order", async () => {
    const firstPath = writePluginModule([
      "export class FirstPlugin {",
      '  name = "first-plugin";',
      "}",
    ]);
    const secondPath = writePluginModule([
      "export class SecondPlugin {",
      '  name = "second-plugin";',
      "}",
    ]);
    const { registry, registeredPlugins } = createRegistry();

    await loadPlugins(registry, [requiredTypesPlugin()], ["local"], {
      input: "./spec.ts",
      output: "./generated",
      plugins: [firstPath, secondPath],
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

  test("loads a named plugin class exported from a file URL", async () => {
    const pluginPath = writePluginModule([
      "export class FileUrlPlugin {",
      '  name = "file-url-plugin";',
      "}",
    ]);
    const pluginUrl = importPathForFile(pluginPath);
    const { registry, registeredPlugins } = createRegistry();

    await loadPlugins(
      registry,
      [requiredTypesPlugin()],
      ["local"],
      configWithPlugin(pluginUrl)
    );

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
      "export class LocalFallbackPlugin {",
      '  name = "local-fallback-plugin";',
      "}",
    ]);
    const { registry, registeredPlugins } = createRegistry();

    await loadPlugins(
      registry,
      [requiredTypesPlugin()],
      ["npm", "local"],
      configWithPlugin(pluginPath)
    );

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

  test("falls back to a default plugin class export", async () => {
    const pluginPath = writePluginModule([
      "export default class DefaultPlugin {",
      '  name = "default-plugin";',
      "}",
    ]);
    const { registry, registeredPlugins } = createRegistry();

    await loadPlugins(
      registry,
      [requiredTypesPlugin()],
      ["local"],
      configWithPlugin(pluginPath)
    );

    expect(registeredPlugins.map(plugin => plugin.name)).toEqual([
      "types",
      "default-plugin",
    ]);
  });

  test("passes tuple plugin options to the plugin constructor", async () => {
    const pluginPath = writeConfigurablePluginModule();
    const options = { marker: "from tuple" };
    const { registry, registeredPlugins } = createRegistry();

    await loadPlugins(
      registry,
      [requiredTypesPlugin()],
      ["local"],
      configWithPlugin([pluginPath, options])
    );

    expect(registeredPlugins[1]?.plugin).toMatchObject({ config: options });
  });

  test("passes tuple plugin options to the registry registration", async () => {
    const pluginPath = writeConfigurablePluginModule();
    const options = { marker: "from tuple" };
    const { registry, registeredPlugins } = createRegistry();

    await loadPlugins(
      registry,
      [requiredTypesPlugin()],
      ["local"],
      configWithPlugin([pluginPath, options])
    );

    expect(registeredPlugins[1]?.config).toEqual(options);
  });

  test("skips helper exports and registers the first valid plugin shape", async () => {
    const pluginPath = writePluginModule([
      "export function Helper() {",
      "  return { helper: true };",
      "}",
      "export class ValidPlugin {",
      '  name = "valid-plugin";',
      "}",
    ]);
    const { registry, registeredPlugins } = createRegistry();

    await loadPlugins(
      registry,
      [requiredTypesPlugin()],
      ["local"],
      configWithPlugin(pluginPath)
    );

    expect(registeredPlugins.map(plugin => plugin.name)).toEqual([
      "types",
      "valid-plugin",
    ]);
  });

  test("reports attempted paths and errors when a plugin cannot be resolved", async () => {
    const { registry } = createRegistry();

    const failure = await capturePluginLoadingFailure(
      loadPlugins(
        registry,
        [requiredTypesPlugin()],
        ["local"],
        configWithPlugin("missing-plugin")
      )
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
    const { registry } = createRegistry();

    const failure = await capturePluginLoadingFailure(
      loadPlugins(
        registry,
        [requiredTypesPlugin()],
        ["npm"],
        configWithPlugin("missing-plugin")
      )
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
    const pluginPath = writePluginModule([
      'throw new Error("evaluation failed");',
    ]);
    const { registry } = createRegistry();

    const failure = await capturePluginLoadingFailure(
      loadPlugins(
        registry,
        [requiredTypesPlugin()],
        ["local"],
        configWithPlugin(pluginPath)
      )
    );

    expect(failure.pluginName).toBe(pluginPath);
    expect(failure.attempts).toEqual([
      {
        path: importPathForFile(pluginPath),
        error: "evaluation failed",
      },
    ]);
  });

  test("reports no plugin constructor export when a module has no function exports", async () => {
    const pluginPath = writePluginModule([
      'export const name = "metadata-only";',
    ]);
    const { registry } = createRegistry();

    const failure = await capturePluginLoadingFailure(
      loadPlugins(
        registry,
        [requiredTypesPlugin()],
        ["local"],
        configWithPlugin(pluginPath)
      )
    );

    expect(failure.attempts).toEqual([
      {
        path: importPathForFile(pluginPath),
        error: "No plugin constructor export found",
      },
    ]);
  });

  test("captures constructor failures in plugin loading attempts", async () => {
    const pluginPath = writePluginModule([
      "export class BrokenPlugin {",
      "  constructor() {",
      '    throw new Error("constructor failed");',
      "  }",
      "}",
    ]);
    const { registry } = createRegistry();

    const failure = await capturePluginLoadingFailure(
      loadPlugins(
        registry,
        [requiredTypesPlugin()],
        ["local"],
        configWithPlugin(pluginPath)
      )
    );

    expect(failure.attempts).toEqual([
      {
        path: importPathForFile(pluginPath),
        error:
          "Export 'BrokenPlugin' could not be instantiated: constructor failed",
      },
    ]);
  });

  test("rejects instantiated exports without a plugin name", async () => {
    const pluginPath = writePluginModule([
      "export class NamelessPlugin {",
      "  generate() {}",
      "}",
    ]);
    const { registry, registeredPlugins } = createRegistry();

    const failure = await capturePluginLoadingFailure(
      loadPlugins(
        registry,
        [requiredTypesPlugin()],
        ["local"],
        configWithPlugin(pluginPath)
      )
    );

    expect(failure.attempts).toEqual([
      {
        path: importPathForFile(pluginPath),
        error:
          "Export 'NamelessPlugin' did not produce a valid plugin with a string name",
      },
    ]);
    expect(registeredPlugins.map(plugin => plugin.name)).toEqual(["types"]);
  });

  test("reports a scoped package attempt when the scoped strategy cannot load it", async () => {
    const { registry } = createRegistry();

    const failure = await capturePluginLoadingFailure(
      loadPlugins(
        registry,
        [requiredTypesPlugin()],
        ["scoped"],
        configWithPlugin("@example/missing-plugin")
      )
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
