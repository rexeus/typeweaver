import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { TypeweaverConfig } from "@rexeus/typeweaver-gen";
import { Effect, Result } from "effect";
import { afterEach, describe, expect, test } from "vitest";
import {
  ConfigModuleEvaluationError,
  InvalidConfigExportError,
  UnsupportedConfigExtensionError,
} from "../../src/errors/index.js";
import { ConfigLoader } from "../../src/services/ConfigLoader.js";

const loadConfig = async (
  configPath: string
): Promise<Partial<TypeweaverConfig>> => {
  const result = await Effect.runPromise(
    Effect.result(ConfigLoader.load(configPath)).pipe(
      Effect.provide(ConfigLoader.Default)
    )
  );
  if (Result.isFailure(result)) throw result.failure;
  return result.success;
};

const tempDirs: string[] = [];

afterEach(() => {
  for (const tempDir of tempDirs) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }

  tempDirs.length = 0;
});

const createTempDir = (): string => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "typeweaver-config-"));
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

describe("configLoader ambiguous exports", () => {
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
});

describe("configLoader invalid exports", () => {
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
});

describe("configLoader evaluation failures", () => {
  test("wraps errors thrown while evaluating config modules in ConfigModuleEvaluationError", async () => {
    const configPath = writeConfigModule(
      ".mjs",
      createThrowingModuleSource({
        errorName: "ConfigEvaluationError",
        message: "config evaluation failed",
      })
    );
    const configLoad = loadConfig(configPath);

    await expect(configLoad).rejects.toBeInstanceOf(
      ConfigModuleEvaluationError
    );
    await expect(configLoad).rejects.toMatchObject({
      configPath,
      cause: expect.objectContaining({
        name: "ConfigEvaluationError",
      }) as unknown,
    });
    await expect(configLoad).rejects.toThrow(/config evaluation failed/);
  });
  test("wraps missing dependency failures from config modules", async () => {
    const missingDependency = "definitely-missing-typeweaver-config-dependency";
    const configPath = writeConfigModule(
      ".mjs",
      `
        import "${missingDependency}";

        export default { output: "./generated" };
      `
    );
    const configLoad = loadConfig(configPath);

    await expect(configLoad).rejects.toBeInstanceOf(
      ConfigModuleEvaluationError
    );
    await expect(configLoad).rejects.toThrow(missingDependency);
  });
  test("wraps syntax errors from config modules", async () => {
    const configPath = writeConfigModule(
      ".mjs",
      `
        export default {
          output: "./generated",
      `
    );
    const configLoad = loadConfig(configPath);

    await expect(configLoad).rejects.toBeInstanceOf(
      ConfigModuleEvaluationError
    );
    await expect(configLoad).rejects.toThrow(
      /parse|syntax|Unexpected|Invalid|missing|end/i
    );
  });
});
