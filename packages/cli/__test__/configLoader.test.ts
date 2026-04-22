import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";
import {
  assertSupportedConfigPath,
  getResolvedConfigPath,
  loadConfig,
} from "../src/configLoader.js";
import { createTempDirFactory } from "./__helpers__/tempDir.js";

describe("configLoader", () => {
  const createTempDir = createTempDirFactory("typeweaver-config-");

  test("rejects TypeScript config files", () => {
    expect(() => assertSupportedConfigPath("typeweaver.config.ts")).toThrow(
      /TypeScript config files are no longer supported/
    );
  });

  test("rejects unsupported config extensions", () => {
    expect(() => assertSupportedConfigPath("typeweaver.config.json")).toThrow(
      /only accepts \.js, \.mjs, or \.cjs/
    );
  });

  test("resolves relative config paths from the provided working directory", () => {
    expect(
      getResolvedConfigPath(
        "configs/typeweaver.config.mjs",
        "/workspace/project"
      )
    ).toBe("/workspace/project/configs/typeweaver.config.mjs");
  });

  test("loads named config exports from supported JavaScript config files", async () => {
    const tempDir = createTempDir();
    const configPath = path.join(tempDir, "typeweaver.config.mjs");

    fs.writeFileSync(
      configPath,
      [
        "export const config = {",
        '  input: "./spec/index.ts",',
        '  output: "./generated",',
        '  plugins: ["clients"],',
        "}",
        "",
      ].join("\n")
    );

    await expect(loadConfig(configPath)).resolves.toEqual({
      input: "./spec/index.ts",
      output: "./generated",
      plugins: ["clients"],
    });
  });

  test("loads default config exports from supported JavaScript config files", async () => {
    const tempDir = createTempDir();
    const configPath = path.join(tempDir, "typeweaver.config.mjs");

    fs.writeFileSync(
      configPath,
      [
        "export default {",
        '  input: "./spec/default.ts",',
        '  output: "./generated-default",',
        '  plugins: ["hono"],',
        "};",
        "",
      ].join("\n")
    );

    await expect(loadConfig(configPath)).resolves.toEqual({
      input: "./spec/default.ts",
      output: "./generated-default",
      plugins: ["hono"],
    });
  });

  test("rejects config modules that export both default and named config", async () => {
    const tempDir = createTempDir();
    const configPath = path.join(tempDir, "typeweaver.config.mjs");

    fs.writeFileSync(
      configPath,
      [
        'export const config = { output: "./named" };',
        'export default { output: "./default" };',
        "",
      ].join("\n")
    );

    await expect(loadConfig(configPath)).rejects.toThrow(
      /must choose a single export style/
    );
  });

  test("rejects namespace-like default config exports", async () => {
    const tempDir = createTempDir();
    const configPath = path.join(tempDir, "typeweaver.config.mjs");

    fs.writeFileSync(
      configPath,
      [
        "export default {",
        '  config: { output: "./generated" },',
        "};",
        "",
      ].join("\n")
    );

    await expect(loadConfig(configPath)).rejects.toThrow(
      /default export must be the config object itself/
    );
  });

  test("rejects config modules without a supported export", async () => {
    const tempDir = createTempDir();
    const configPath = path.join(tempDir, "typeweaver.config.mjs");

    fs.writeFileSync(
      configPath,
      [
        'export const input = "./spec/index.ts";',
        'export const output = "./generated";',
        "",
      ].join("\n")
    );

    await expect(loadConfig(configPath)).rejects.toThrow(
      /must export its config via 'export default' or 'export const config = \.\.\.'/
    );
  });

  test("rejects non-object config exports", async () => {
    const tempDir = createTempDir();
    const configPath = path.join(tempDir, "typeweaver.config.mjs");

    fs.writeFileSync(configPath, 'export default "./generated";\n');

    await expect(loadConfig(configPath)).rejects.toThrow(
      /must export a config object via 'export default' or 'export const config = \.\.\.'/
    );
  });
});
