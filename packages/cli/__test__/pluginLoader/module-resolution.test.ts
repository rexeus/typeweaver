import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import {
  aNamedPluginModule,
  createPluginFixtureWorkspace,
  importPathForFile,
} from "../helpers/index.js";
import {
  configWithPlugin,
  expectSuccessfulLoadSummary,
  requiredTypesPlugin,
  runLoadPlugins,
} from "./support.js";
import type { RegisteredPlugin } from "./support.js";

const fixtures = createPluginFixtureWorkspace();

const writePluginModule = fixtures.writePluginModule;

afterEach(() => {
  fixtures.cleanup();
});

describe("pluginLoader module resolution", () => {
  test("resolves a relative plugin path from the current working directory", async () => {
    const pluginPath = writePluginModule([
      'export const relativePlugin = { name: "relative-plugin" };',
    ]);
    const registeredPlugins: RegisteredPlugin[] = [];
    const originalWorkingDirectory = process.cwd();

    process.chdir(path.dirname(pluginPath));
    try {
      const resolvedPluginUrl = importPathForFile(path.resolve("plugin.mjs"));
      const { logs } = await runLoadPlugins({
        registeredPlugins,
        requiredPlugins: [requiredTypesPlugin()],
        strategies: ["local"],
        config: configWithPlugin("./plugin.mjs"),
        useRealModuleLoader: true,
      });

      expect(registeredPlugins.map(plugin => plugin.name)).toEqual([
        "types",
        "relative-plugin",
      ]);
      expectSuccessfulLoadSummary(logs, {
        count: 1,
        pluginName: "relative-plugin",
        source: resolvedPluginUrl,
      });
    } finally {
      process.chdir(originalWorkingDirectory);
    }
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
});
