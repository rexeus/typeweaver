import { PluginConfigError } from "@rexeus/typeweaver-gen";
import { afterEach, describe, expect, test } from "vitest";
import { createPluginFixtureWorkspace } from "../helpers/index.js";
import {
  capturePluginLoadError,
  captureTaggedPluginConfigError,
  configWithPlugin,
  requiredTypesPlugin,
  runLoadPlugins,
} from "./support.js";

const fixtures = createPluginFixtureWorkspace();

afterEach(() => {
  fixtures.cleanup();
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
