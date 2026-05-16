import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { TypeweaverConfig } from "@rexeus/typeweaver-gen";
import { Effect, Either } from "effect";
import { afterEach, describe, expect, test } from "vitest";
import { InvalidConfigExportError } from "../src/errors/InvalidConfigExportError.js";
import { UnsupportedConfigExtensionError } from "../src/errors/UnsupportedConfigExtensionError.js";
import { UnsupportedTypeScriptConfigError } from "../src/errors/UnsupportedTypeScriptConfigError.js";
import {
  ConfigLoader,
  getResolvedConfigPath,
} from "../src/services/ConfigLoader.js";

// Test shims that bridge the legacy sync/async API onto ConfigLoader.
// `Effect.either` flattens typed failures into the success channel so
// tests can `.rejects.toBeInstanceOf` against the underlying error rather
// than against Effect's `FiberFailure` wrapper.
const assertSupportedConfigPath = (configPath: string): void => {
  const result = Effect.runSync(
    Effect.either(ConfigLoader.assertSupportedPath(configPath)).pipe(
      Effect.provide(ConfigLoader.Default)
    )
  );
  if (Either.isLeft(result)) throw result.left;
};

const loadConfig = async (
  configPath: string
): Promise<Partial<TypeweaverConfig>> => {
  const result = await Effect.runPromise(
    Effect.either(ConfigLoader.load(configPath)).pipe(
      Effect.provide(ConfigLoader.Default)
    )
  );
  if (Either.isLeft(result)) throw result.left;
  return result.right;
};

describe("configLoader", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const tempDir of tempDirs) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }

    tempDirs.length = 0;
  });

  const createTempDir = (): string => {
    const tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "typeweaver-config-")
    );
    tempDirs.push(tempDir);

    return tempDir;
  };

  const writeConfigModule = (extension: string, contents: string): string => {
    const tempDir = createTempDir();
    const configPath = path.join(tempDir, `typeweaver.config${extension}`);

    fs.writeFileSync(path.join(tempDir, "package.json"), '{"type":"module"}\n');

    fs.writeFileSync(configPath, `${contents.trim()}\n`);

    return configPath;
  };

  const writeUnsupportedConfigFile = (
    extension: string,
    contents: string
  ): string => {
    const configPath = path.join(
      createTempDir(),
      `typeweaver.config${extension}`
    );

    fs.writeFileSync(configPath, `${contents.trim()}\n`);

    return configPath;
  };

  const createThrowingModuleSource = (options: {
    readonly errorName: string;
    readonly message: string;
  }): string => `
    class ${options.errorName} extends Error {
      name = "${options.errorName}";
    }
    throw new ${options.errorName}(${JSON.stringify(options.message)});
  `;

  const captureConfigPathError = (action: () => void): unknown => {
    try {
      action();
    } catch (error) {
      return error;
    }

    return undefined;
  };

  test.each([
    { extension: ".js" },
    { extension: ".mjs" },
    { extension: ".cjs" },
  ])("accepts $extension config paths", ({ extension }) => {
    expect(() =>
      assertSupportedConfigPath(`typeweaver.config${extension}`)
    ).not.toThrow();
  });

  test.each([
    { extension: ".ts" },
    { extension: ".mts" },
    { extension: ".cts" },
  ])("rejects $extension TypeScript config paths", ({ extension }) => {
    const configPath = `typeweaver.config${extension}`;
    const error = captureConfigPathError(() =>
      assertSupportedConfigPath(configPath)
    );

    expect(error).toBeInstanceOf(UnsupportedTypeScriptConfigError);
    expect(error).toEqual(
      expect.objectContaining({
        configPath,
        extension,
      })
    );
  });

  test.each([
    { configPath: "typeweaver.config.json", scenario: ".json" },
    { configPath: "typeweaver.config.toml", scenario: ".toml" },
    { configPath: "typeweaver-config", scenario: "extensionless" },
  ])("rejects $scenario config paths as unsupported", ({ configPath }) => {
    const error = captureConfigPathError(() =>
      assertSupportedConfigPath(configPath)
    );

    expect(error).toBeInstanceOf(UnsupportedConfigExtensionError);
    expect(error).toEqual(
      expect.objectContaining({
        configPath,
        extension: path.extname(configPath).toLowerCase(),
        supportedExtensions: [".js", ".mjs", ".cjs"],
      })
    );
  });

  test("leaves absolute config paths unchanged", () => {
    const configPath = path.resolve("/workspace/project/typeweaver.config.mjs");

    const resolvedConfigPath = getResolvedConfigPath(
      configPath,
      "/other/project"
    );

    expect(resolvedConfigPath).toBe(configPath);
  });

  test("resolves relative config paths from the provided working directory", () => {
    const resolvedConfigPath = getResolvedConfigPath(
      "configs/typeweaver.config.mjs",
      "/workspace/project"
    );

    expect(resolvedConfigPath).toBe(
      path.resolve("/workspace/project", "configs/typeweaver.config.mjs")
    );
  });

  test("normalizes relative config paths with dot segments", () => {
    const resolvedConfigPath = getResolvedConfigPath(
      "./configs/../typeweaver.config.mjs",
      "/workspace/project/packages/cli"
    );

    expect(resolvedConfigPath).toBe(
      path.resolve(
        "/workspace/project/packages/cli",
        "./configs/../typeweaver.config.mjs"
      )
    );
  });

  test("loads ESM named config exports", async () => {
    const configPath = writeConfigModule(
      ".mjs",
      `
        export const config = {
          input: "./spec/index.ts",
          output: "./generated",
          plugins: ["clients"],
        };
      `
    );

    const loadedConfig = await loadConfig(configPath);

    expect(loadedConfig).toEqual({
      input: "./spec/index.ts",
      output: "./generated",
      plugins: ["clients"],
    });
  });

  test("loads ESM default config exports", async () => {
    const configPath = writeConfigModule(
      ".mjs",
      `
        export default {
          input: "./spec/default.ts",
          output: "./generated-default",
          plugins: ["hono"],
        };
      `
    );

    const loadedConfig = await loadConfig(configPath);

    expect(loadedConfig).toEqual({
      input: "./spec/default.ts",
      output: "./generated-default",
      plugins: ["hono"],
    });
  });

  test("loads ESM .js default config files", async () => {
    const configPath = writeConfigModule(
      ".js",
      `
        export default { output: "./generated-js" };
      `
    );

    const loadedConfig = await loadConfig(configPath);

    expect(loadedConfig).toStrictEqual({ output: "./generated-js" });
  });

  test("loads CommonJS module exports as default config exports", async () => {
    const configPath = writeConfigModule(
      ".cjs",
      `
        module.exports = {
          input: "./spec/commonjs.ts",
          output: "./generated-commonjs",
          plugins: ["aws-cdk"],
        };
      `
    );

    const loadedConfig = await loadConfig(configPath);

    expect(loadedConfig).toEqual({
      input: "./spec/commonjs.ts",
      output: "./generated-commonjs",
      plugins: ["aws-cdk"],
    });
  });

  test("rejects ESM modules that export both default and named config", async () => {
    const configPath = writeConfigModule(
      ".mjs",
      `
        export const config = { output: "./named" };
        export default { output: "./default" };
      `
    );

    const configLoad = loadConfig(configPath);

    await expect(configLoad).rejects.toBeInstanceOf(InvalidConfigExportError);
    await expect(configLoad).rejects.toMatchObject({
      reason: "both-default-and-named-config",
    });
  });

  test.each([
    {
      defaultExport: '{ default: { output: "./nested-default" } }',
      scenario: "only a default sentinel",
    },
    {
      defaultExport: '{ config: { output: "./nested-config" } }',
      scenario: "only a config sentinel",
    },
  ])(
    "rejects namespace-like default config exports with $scenario",
    async ({ defaultExport }) => {
      const configPath = writeConfigModule(
        ".mjs",
        `
          export default ${defaultExport};
        `
      );

      const configLoad = loadConfig(configPath);

      await expect(configLoad).rejects.toBeInstanceOf(InvalidConfigExportError);
      await expect(configLoad).rejects.toMatchObject({
        reason: "default-namespace-wrapper",
      });
    }
  );

  test("rejects unsupported extensions before evaluating config files", async () => {
    const configPath = writeUnsupportedConfigFile(
      ".json",
      `
        { "output": "./generated-json" }
      `
    );

    await expect(loadConfig(configPath)).rejects.toBeInstanceOf(
      UnsupportedConfigExtensionError
    );
  });

  test("rejects config modules without a supported export", async () => {
    const configPath = writeConfigModule(
      ".mjs",
      `
        export const input = "./spec/index.ts";
        export const output = "./generated";
      `
    );

    const configLoad = loadConfig(configPath);

    await expect(configLoad).rejects.toBeInstanceOf(InvalidConfigExportError);
    await expect(configLoad).rejects.toMatchObject({
      reason: "missing-config-export",
    });
  });

  test.each([
    { exportExpression: "null", scenario: "null" },
    { exportExpression: "[]", scenario: "array" },
    { exportExpression: '"./generated"', scenario: "string" },
    {
      exportExpression: "() => ({ output: './generated' })",
      scenario: "function",
    },
  ])("rejects $scenario config exports", async ({ exportExpression }) => {
    const configPath = writeConfigModule(
      ".mjs",
      `export default ${exportExpression};`
    );

    const configLoad = loadConfig(configPath);

    await expect(configLoad).rejects.toBeInstanceOf(InvalidConfigExportError);
    await expect(configLoad).rejects.toMatchObject({
      reason: "non-object-config",
    });
  });

  test("propagates errors thrown while evaluating config modules", async () => {
    const configPath = writeConfigModule(
      ".mjs",
      createThrowingModuleSource({
        errorName: "ConfigEvaluationError",
        message: "config evaluation failed",
      })
    );
    const configLoad = loadConfig(configPath);

    await expect(configLoad).rejects.toMatchObject({
      name: "ConfigEvaluationError",
    });
    await expect(configLoad).rejects.toThrow(/config evaluation failed/);
  });

  test("propagates missing dependency failures from config modules", async () => {
    const missingDependency = "definitely-missing-typeweaver-config-dependency";
    const configPath = writeConfigModule(
      ".mjs",
      `
        import "${missingDependency}";

        export default { output: "./generated" };
      `
    );

    await expect(loadConfig(configPath)).rejects.toThrow(missingDependency);
  });

  test("propagates syntax errors from config modules", async () => {
    const configPath = writeConfigModule(
      ".mjs",
      `
        export default {
          output: "./generated",
      `
    );
    const configLoad = loadConfig(configPath);

    await expect(configLoad).rejects.toThrow(
      /parse|syntax|Unexpected|Invalid|missing|end/i
    );
  });
});
