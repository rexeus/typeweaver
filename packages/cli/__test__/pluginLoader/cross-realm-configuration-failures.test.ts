import { PluginConfigError } from "@rexeus/typeweaver-gen";
import { Data } from "effect";
import { afterEach, describe, expect, test } from "vitest";
import {
  aModuleImportFailure,
  createPluginFixtureWorkspace,
} from "../helpers/index.js";
import {
  anIncompletePluginConfigTag,
  captureTaggedPluginConfigError,
  configWithPlugin,
  requiredTypesPlugin,
  runLoadPlugins,
} from "./support.js";
import type { ModuleFixture } from "../helpers/index.js";
import type { CapturedPluginConfigError, RegisteredPlugin } from "./support.js";

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

const fixtures = createPluginFixtureWorkspace();

afterEach(() => {
  fixtures.cleanup();
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
