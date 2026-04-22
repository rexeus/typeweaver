import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { createPluginContextBuilder } from "../src/plugins/pluginContext.js";
import type { GeneratorContext, PluginConfig } from "../src/plugins/types.js";

const createGeneratorContext = (outputDir: string): GeneratorContext => {
  const builder = createPluginContextBuilder();

  return builder.createGeneratorContext({
    pluginName: "test",
    outputDir,
    inputDir: outputDir,
    config: {} as PluginConfig,
    normalizedSpec: { resources: [], responses: [] },
    templateDir: outputDir,
    coreDir: outputDir,
    responsesOutputDir: path.join(outputDir, "responses"),
    specOutputDir: path.join(outputDir, "spec"),
  });
};

describe("pluginContext.writeFile", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
    tempDirs.length = 0;
  });

  const makeOutputDir = (): string => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "typeweaver-writefile-"));
    tempDirs.push(dir);
    return dir;
  };

  test("writes files inside the plugin output directory", () => {
    const outputDir = makeOutputDir();
    const context = createGeneratorContext(outputDir);

    context.writeFile("nested/hello.ts", "export const hello = 1;\n");

    const written = fs.readFileSync(
      path.join(outputDir, "nested", "hello.ts"),
      "utf-8"
    );
    expect(written).toBe("export const hello = 1;\n");
  });

  test("rejects relative paths that escape the output directory", () => {
    const outputDir = makeOutputDir();
    const context = createGeneratorContext(outputDir);

    expect(() =>
      context.writeFile("../outside.ts", "boom")
    ).toThrowErrorMatchingInlineSnapshot(
      `[Error: Plugin writeFile refused path '../outside.ts' because it escapes the output directory.]`
    );
    expect(fs.existsSync(path.join(outputDir, "..", "outside.ts"))).toBe(false);
  });

  test("rejects absolute paths outright", () => {
    const outputDir = makeOutputDir();
    const context = createGeneratorContext(outputDir);

    expect(() =>
      context.writeFile(path.join(outputDir, "abs.ts"), "x")
    ).toThrowError(/refused an absolute path/);
  });
});
