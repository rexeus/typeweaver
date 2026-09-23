import type { TypeweaverConfig } from "@rexeus/typeweaver-gen";
import { afterEach, describe, expect, test } from "vitest";
import {
  aNamedPluginModule,
  createPluginFixtureWorkspace,
} from "../helpers/index.js";
import {
  configWithPlugin,
  expectSuccessfulLoadSummary,
  expectSuccessfulLoadSummaryEntries,
  messages,
  requiredTypesPlugin,
  runLoadPlugins,
} from "./support.js";
import type { CapturedLog, RegisteredPlugin } from "./support.js";

const configWithoutPlugins = (): TypeweaverConfig => ({
  input: "./spec.ts",
  output: "./generated",
});

const fixtures = createPluginFixtureWorkspace();

afterEach(() => {
  fixtures.cleanup();
});

const expectNoSuccessfulLoadSummary = (logs: readonly CapturedLog[]): void => {
  expect(messages(logs)).not.toEqual(
    expect.arrayContaining([
      expect.stringMatching(/Successfully loaded/) as unknown,
    ]) as unknown
  );
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
