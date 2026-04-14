/* eslint-disable import/max-dependencies */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { AwsCdkPlugin } from "@rexeus/typeweaver-aws-cdk";
import { ClientsPlugin } from "@rexeus/typeweaver-clients";
import type {
  PluginRegistryApi,
  TypeweaverPlugin,
} from "@rexeus/typeweaver-gen";
import { createPluginRegistry } from "@rexeus/typeweaver-gen";
import { HonoPlugin } from "@rexeus/typeweaver-hono";
import { ServerPlugin } from "@rexeus/typeweaver-server";
import { TypesPlugin } from "@rexeus/typeweaver-types";
import { afterEach, describe, expect, test, vi } from "vitest";
import { PluginLoadingFailure } from "../src/generators/errors/pluginLoadingFailure.js";
import { loadPlugins } from "../src/generators/pluginLoader.js";

type RegisteredPlugin = {
  readonly name: string;
  readonly plugin: TypeweaverPlugin;
};

function createRegistry(): {
  readonly registry: PluginRegistryApi;
  readonly registeredPlugins: RegisteredPlugin[];
} {
  const registeredPlugins: RegisteredPlugin[] = [];

  return {
    registry: {
      register: (plugin: TypeweaverPlugin) => {
        registeredPlugins.push({
          name: plugin.name,
          plugin,
        });
      },
      get: () => undefined,
      getAll: () => [],
      has: () => false,
      clear: () => {},
    },
    registeredPlugins,
  };
}

describe("pluginLoader", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    vi.restoreAllMocks();

    for (const tempDir of tempDirs) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }

    tempDirs.length = 0;
  });

  function createTempDir(): string {
    const tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "typeweaver-plugin-")
    );
    tempDirs.push(tempDir);

    return tempDir;
  }

  test("registers required plugins before loading configured plugins", async () => {
    const requiredPlugin = { name: "types" } as TypesPlugin;
    const pluginDir = createTempDir();
    const pluginPath = path.join(pluginDir, "local-plugin.mjs");

    fs.writeFileSync(
      pluginPath,
      ["export class LocalPlugin {", '  name = "local-plugin";', "}", ""].join(
        "\n"
      )
    );

    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    const { registry, registeredPlugins } = createRegistry();

    await loadPlugins(registry, [requiredPlugin], ["local"], {
      input: "./spec.ts",
      output: "./generated",
      plugins: [pluginPath],
    });

    expect(registeredPlugins.map(plugin => plugin.name)).toEqual([
      "types",
      "local-plugin",
    ]);
    expect(infoSpy).toHaveBeenCalledWith("Successfully loaded 1 plugin(s):");
    expect(infoSpy).toHaveBeenCalledWith(
      `  - local-plugin (from ${pluginPath})`
    );
  });

  test("surfaces attempted plugin paths when loading fails", async () => {
    const { registry } = createRegistry();

    await expect(
      loadPlugins(registry, [{ name: "types" } as TypesPlugin], ["local"], {
        input: "./spec.ts",
        output: "./generated",
        plugins: ["missing-plugin"],
      })
    ).rejects.toEqual(
      expect.objectContaining<Partial<PluginLoadingFailure>>({
        pluginName: "missing-plugin",
        attempts: [
          expect.objectContaining({
            path: "missing-plugin",
          }),
        ],
      })
    );
  });

  test("falls back to default plugin exports for third-party compatibility", async () => {
    const pluginDir = createTempDir();
    const pluginPath = path.join(pluginDir, "default-plugin.mjs");

    fs.writeFileSync(
      pluginPath,
      [
        "export default class DefaultPlugin {",
        '  name = "default-plugin";',
        "}",
        "",
      ].join("\n")
    );

    const { registry, registeredPlugins } = createRegistry();

    await loadPlugins(registry, [{ name: "types" } as TypesPlugin], ["local"], {
      input: "./spec.ts",
      output: "./generated",
      plugins: [pluginPath],
    });

    expect(registeredPlugins.map(plugin => plugin.name)).toEqual([
      "types",
      "default-plugin",
    ]);
  });

  test("preserves the expected built-in plugin order after dependency resolution", () => {
    const registry = createPluginRegistry();

    registry.register(new TypesPlugin());
    registry.register(new ClientsPlugin());
    registry.register(new ServerPlugin());
    registry.register(new HonoPlugin());
    registry.register(new AwsCdkPlugin());

    expect(registry.getAll().map(registration => registration.name)).toEqual([
      "types",
      "clients",
      "server",
      "hono",
      "aws-cdk",
    ]);
  });
});
