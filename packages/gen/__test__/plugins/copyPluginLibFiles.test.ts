import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Cause, Effect, Exit, Option } from "effect";
import { afterEach, describe, expect, test } from "vitest";
import { UnsafeGeneratedPathError } from "../../src/errors/UnsafeGeneratedPathError.js";
import { definePluginWithLibCopy } from "../../src/plugins/definePluginWithLibCopy.js";
import { PluginExecutionError } from "../../src/plugins/errors/PluginExecutionError.js";
import type { GeneratorContext } from "../../src/plugins/contextTypes.js";

const tempDirs: string[] = [];

const createTempDir = (label: string): string => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `lib-copy-${label}-`));
  tempDirs.push(dir);
  return dir;
};

const aMinimalGeneratorContext = (outputDir: string): GeneratorContext =>
  // The lib-copy code only touches `outputDir` and `addGeneratedFile`,
  // so the rest of the context is permissive — a `Proxy` would also work,
  // but a plain object with stubs keeps the surface explicit.
  ({
    outputDir,
    inputDir: outputDir,
    config: {},
    normalizedSpec: {
      resources: [],
      responses: [],
      warnings: [],
    },
    coreDir: "",
    responsesOutputDir: "",
    specOutputDir: "",
    getCanonicalResponse: () => {
      throw new Error("not used");
    },
    getCanonicalResponseOutputFile: () => "",
    getCanonicalResponseImportPath: () => "",
    getSpecImportPath: () => "",
    getOperationDefinitionAccessor: () => "",
    getOperationOutputPaths: () => {
      throw new Error("not used");
    },
    getResourceOutputDir: () => "",
    writeFile: () => {},
    renderTemplate: () => "",
    addGeneratedFile: () => {},
    getGeneratedFiles: () => [],
    writeFileEffect: () => Effect.die("not used"),
    renderTemplateEffect: () => Effect.die("not used"),
    addGeneratedFileEffect: () => Effect.die("not used"),
  }) satisfies GeneratorContext;

describe("definePluginWithLibCopy path-safety guard", () => {
  afterEach(() => {
    for (const dir of tempDirs) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
    tempDirs.length = 0;
  });

  test("fails generation with UnsafeGeneratedPathError when the plugin name encodes a parent-traversal escape", () => {
    const libSourceDir = createTempDir("lib-source");
    fs.writeFileSync(
      path.join(libSourceDir, "index.ts"),
      "export const x = 1;"
    );
    const outputDir = createTempDir("output");

    const escapingPlugin = definePluginWithLibCopy({
      name: "../escape",
      libSourceDir,
      generators: [],
    });

    const exit = Effect.runSyncExit(
      escapingPlugin.generate!(aMinimalGeneratorContext(outputDir))
    );

    expect(Exit.isFailure(exit)).toBe(true);
    if (!Exit.isFailure(exit)) return;

    // The outer Effect.try wraps the throw as PluginExecutionError; the
    // tagged-error class carries the originating cause so operators see the
    // path-safety reason rather than a bare PluginExecutionError.
    const failure = Cause.failureOption(exit.cause);
    expect(Option.isSome(failure)).toBe(true);
    if (!Option.isSome(failure)) return;
    const pluginError = failure.value;
    expect(pluginError).toBeInstanceOf(PluginExecutionError);
    if (!(pluginError instanceof PluginExecutionError)) return;
    expect(pluginError.phase).toBe("generate");
    expect(pluginError.pluginName).toBe("../escape");
    expect(pluginError.cause).toBeInstanceOf(UnsafeGeneratedPathError);
    if (!(pluginError.cause instanceof UnsafeGeneratedPathError)) return;
    expect(pluginError.cause.reason).toBe("parent-traversal");

    // Defense-in-depth: nothing was copied outside outputDir.
    const escapedDestination = path.resolve(outputDir, "..", "escape");
    expect(fs.existsSync(escapedDestination)).toBe(false);
  });

  test("copies the lib subtree when the plugin name is a safe identifier", () => {
    const libSourceDir = createTempDir("lib-source-safe");
    fs.writeFileSync(
      path.join(libSourceDir, "index.ts"),
      "export const x = 1;"
    );
    const outputDir = createTempDir("output-safe");

    const safePlugin = definePluginWithLibCopy({
      name: "clients",
      libSourceDir,
      generators: [],
    });

    const exit = Effect.runSyncExit(
      safePlugin.generate!(aMinimalGeneratorContext(outputDir))
    );

    expect(Exit.isSuccess(exit)).toBe(true);
    expect(
      fs.existsSync(path.join(outputDir, "lib", "clients", "index.ts"))
    ).toBe(true);
  });
});
