import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { UnsafeGeneratedPathError } from "../../../../src/errors/UnsafeGeneratedPathError.js";
import {
  createPluginContextBuilder,
  liveSyncAtomicFileSystem,
} from "../../../../src/services/internal/pluginContextBuilder.js";
import { livePathSafetyShape } from "../../../../src/services/internal/pluginContextEffectIO.js";
import {
  aBuilder,
  aGeneratedProjectContext,
  aTempDir,
  catchThrownError,
  expectUnsafeGeneratedFilePath,
  generatedProjectParams,
  nativeGeneratedFilePath,
  realPluginContextBuilderDeps,
  removeTempDirs,
} from "./fixtures.js";
import type { SyncAtomicFileSystem } from "../../../../src/services/internal/pluginContextBuilder.js";

afterEach(removeTempDirs);

describe("createPluginContextBuilder normalized output paths", () => {
  test("normalizes current-directory segments before writing and recording generated files", () => {
    const outputDir = aTempDir();
    const generatorContext = aGeneratedProjectContext({ outputDir });
    const generatedFile = "todo/GetTodoClient.ts";
    const generatedFilePath = nativeGeneratedFilePath(outputDir, generatedFile);

    generatorContext.writeFile(
      "todo/./GetTodoClient.ts",
      "export const client = true;\n"
    );

    expect(fs.readFileSync(generatedFilePath, "utf8")).toBe(
      "export const client = true;\n"
    );
    expect(generatorContext.getGeneratedFiles()).toEqual([generatedFile]);
  });

  test("normalizes Windows separators before writing and recording generated files", () => {
    const outputDir = aTempDir();
    const generatorContext = aGeneratedProjectContext({ outputDir });
    const generatedFile = "todo/GetTodoClient.ts";
    const generatedFilePath = nativeGeneratedFilePath(outputDir, generatedFile);

    generatorContext.writeFile(
      "todo\\GetTodoClient.ts",
      "export const client = true;\n"
    );

    expect(fs.readFileSync(generatedFilePath, "utf8")).toBe(
      "export const client = true;\n"
    );
    expect(generatorContext.getGeneratedFiles()).toEqual([generatedFile]);
  });

  test("writes safely when the configured output directory does not exist yet", () => {
    const workspaceDir = aTempDir();
    const outputDir = path.join(workspaceDir, "generated");
    const generatorContext = aGeneratedProjectContext({ outputDir });
    const generatedFile = "todo/GetTodoClient.ts";
    const generatedFilePath = nativeGeneratedFilePath(outputDir, generatedFile);

    generatorContext.writeFile(generatedFile, "export const client = true;\n");

    expect(fs.readFileSync(generatedFilePath, "utf8")).toBe(
      "export const client = true;\n"
    );
    expect(generatorContext.getGeneratedFiles()).toEqual([generatedFile]);
  });
});

describe("createPluginContextBuilder destination revalidation", () => {
  test("revalidates the destination after staging and before sync rename", () => {
    const outputDir = aTempDir();
    const generatedFile = "todo/GetTodoClient.ts";
    const generatedFilePath = nativeGeneratedFilePath(outputDir, generatedFile);
    const unsafePath = new UnsafeGeneratedPathError({
      requestedPath: generatedFile,
      reason: "symlink-component",
    });
    let validationCount = 0;
    const builder = createPluginContextBuilder({
      ...realPluginContextBuilderDeps,
      pathSafety: {
        validateGeneratedPath: params => {
          validationCount += 1;
          if (validationCount === 3) {
            throw unsafePath;
          }
          return livePathSafetyShape.validateGeneratedPath(params);
        },
      },
    });
    const generatorContext = builder.createGeneratorContext({
      ...generatedProjectParams,
      outputDir,
    });

    const writeGeneratedFile = () =>
      generatorContext.writeFile(generatedFile, "generated");

    expect(catchThrownError(writeGeneratedFile)).toBe(unsafePath);
    expect(validationCount).toBe(3);
    expect(fs.existsSync(generatedFilePath)).toBe(false);
    expect(generatorContext.getGeneratedFiles()).toEqual([]);
    expect(builder.drainPendingWriteLogs()).toEqual([]);
  });

  test("rejects an ancestor symlink swap before sync publication", () => {
    const workspaceDir = aTempDir();
    const outputDir = path.join(workspaceDir, "generated");
    const externalDir = path.join(workspaceDir, "external");
    const resourceDir = path.join(outputDir, "todo");
    const stagedResourceDir = path.join(outputDir, "todo-staged");
    const generatedFile = "todo/GetTodoClient.ts";
    fs.mkdirSync(outputDir);
    fs.mkdirSync(externalDir);
    let renameCount = 0;
    const syncAtomicFileSystem = {
      ...liveSyncAtomicFileSystem,
      writeFileExclusive: (filePath, content, mode) => {
        liveSyncAtomicFileSystem.writeFileExclusive(filePath, content, mode);
        if (path.basename(filePath) !== "generated.tmp") {
          return;
        }
        fs.renameSync(resourceDir, stagedResourceDir);
        fs.symlinkSync(
          externalDir,
          resourceDir,
          process.platform === "win32" ? "junction" : "dir"
        );
      },
      rename: (oldPath, newPath) => {
        renameCount += 1;
        liveSyncAtomicFileSystem.rename(oldPath, newPath);
      },
    } satisfies SyncAtomicFileSystem;
    const builder = aBuilder(syncAtomicFileSystem);
    const generatorContext = builder.createGeneratorContext({
      ...generatedProjectParams,
      outputDir,
    });

    const writeGeneratedFile = () =>
      generatorContext.writeFile(generatedFile, "generated");

    expectUnsafeGeneratedFilePath(writeGeneratedFile);
    expect(renameCount).toBe(0);
    expect(fs.existsSync(path.join(externalDir, "GetTodoClient.ts"))).toBe(
      false
    );
    expect(generatorContext.getGeneratedFiles()).toEqual([]);
    expect(builder.drainPendingWriteLogs()).toEqual([]);
  });
});
