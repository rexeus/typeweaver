import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { liveSyncAtomicFileSystem } from "../../../../src/services/internal/pluginContextBuilder.js";
import {
  aBuilder,
  aGeneratedProjectContext,
  aTempDir,
  catchThrownError,
  expectUnsafeGeneratedFilePath,
  generatedProjectParams,
  nativeGeneratedFilePath,
  removeTempDirs,
} from "./fixtures.js";
import type { SyncAtomicFileSystem } from "../../../../src/services/internal/pluginContextBuilder.js";

const coordinationMarkerFile = ".typeweaver-coordination";

const atomicWriteMarkerSource =
  "typeweaver-coordination-artifact/v1\nkind=atomic-write-temp\n";

afterEach(removeTempDirs);

describe("createPluginContextBuilder atomic write failures", () => {
  test("publishes the ownership marker before staging sync content", () => {
    const outputDir = aTempDir();
    let observedMarkerSource: string | undefined;
    const syncAtomicFileSystem = {
      ...liveSyncAtomicFileSystem,
      writeFileExclusive: (filePath, content, mode) => {
        if (path.basename(filePath) === "generated.tmp") {
          observedMarkerSource = fs.readFileSync(
            path.join(path.dirname(filePath), coordinationMarkerFile),
            "utf8"
          );
        }
        liveSyncAtomicFileSystem.writeFileExclusive(filePath, content, mode);
      },
    } satisfies SyncAtomicFileSystem;
    const generatorContext = aBuilder(
      syncAtomicFileSystem
    ).createGeneratorContext({
      ...generatedProjectParams,
      outputDir,
    });

    generatorContext.writeFile("todo/GetTodoClient.ts", "generated");

    expect(observedMarkerSource).toBe(atomicWriteMarkerSource);
  });

  test("leaves output unchanged when replacing an existing directory target fails", () => {
    const outputDir = aTempDir();
    const generatorContext = aGeneratedProjectContext({ outputDir });
    fs.mkdirSync(path.join(outputDir, "todo"));

    const writeDirectoryTarget = () =>
      generatorContext.writeFile("todo", "export const client = true;\n");

    expect(writeDirectoryTarget).toThrowError();
    expect(generatorContext.getGeneratedFiles()).toEqual([]);
    expect(
      fs.readdirSync(outputDir, { withFileTypes: true }).map(entry => ({
        name: entry.name,
        isDirectory: entry.isDirectory(),
      }))
    ).toEqual([{ name: "todo", isDirectory: true }]);
  });

  test("preserves a sync rename defect when temp cleanup also defects", () => {
    const renameDefect = new Error("rename defect");
    const cleanupDefect = new Error("cleanup defect");
    const cleanupCalls: string[] = [];
    const syncAtomicFileSystem = {
      getExistingFileMode: () => undefined,
      makeTempDirectory: prefixPath => `${prefixPath}test`,
      writeFileExclusive: () => undefined,
      chmod: () => undefined,
      rename: () => {
        throw renameDefect;
      },
      removeDirectory: dirPath => {
        cleanupCalls.push(dirPath);
        throw cleanupDefect;
      },
    } satisfies SyncAtomicFileSystem;
    const outputDir = aTempDir();
    const builder = aBuilder(syncAtomicFileSystem);
    const generatorContext = builder.createGeneratorContext({
      ...generatedProjectParams,
      outputDir,
    });

    const writeGeneratedFile = () =>
      generatorContext.writeFile("todo/GetTodoClient.ts", "generated");

    expect(catchThrownError(writeGeneratedFile)).toBe(renameDefect);
    expect(cleanupCalls).toHaveLength(1);
    expect(generatorContext.getGeneratedFiles()).toEqual([]);
    expect(builder.drainPendingWriteLogs()).toEqual([]);
  });

  test("tracks a committed sync rename before surfacing a cleanup defect", () => {
    const cleanupDefect = new Error("cleanup defect after commit");
    const syncAtomicFileSystem = {
      ...liveSyncAtomicFileSystem,
      removeDirectory: () => {
        throw cleanupDefect;
      },
    } satisfies SyncAtomicFileSystem;
    const outputDir = aTempDir();
    const builder = aBuilder(syncAtomicFileSystem);
    const generatorContext = builder.createGeneratorContext({
      ...generatedProjectParams,
      outputDir,
    });
    const generatedFile = "todo/GetTodoClient.ts";
    const generatedFilePath = nativeGeneratedFilePath(outputDir, generatedFile);

    const writeGeneratedFile = () =>
      generatorContext.writeFile(generatedFile, "generated");

    expect(catchThrownError(writeGeneratedFile)).toBe(cleanupDefect);
    expect(fs.readFileSync(generatedFilePath, "utf8")).toBe("generated");
    expect(generatorContext.getGeneratedFiles()).toEqual([generatedFile]);
    expect(builder.drainPendingWriteLogs()).toEqual([generatedFile]);
  });
});

describe("createPluginContextBuilder traversal write rejection", () => {
  test("rejects parent traversal paths before writing outside the output directory", () => {
    const workspaceDir = aTempDir();
    const outputDir = path.join(workspaceDir, "generated");
    fs.mkdirSync(outputDir);
    const outsideFile = path.join(workspaceDir, "outside.ts");
    const generatorContext = aGeneratedProjectContext({ outputDir });

    const writeOutside = () =>
      generatorContext.writeFile(
        "../outside.ts",
        "export const outside = true;\n"
      );

    expectUnsafeGeneratedFilePath(writeOutside);
    expect(fs.existsSync(outsideFile)).toBe(false);
    expect(generatorContext.getGeneratedFiles()).toEqual([]);
  });

  test.each([
    { scenario: "POSIX separators", generatedPath: "todo/../File.ts" },
    { scenario: "Windows separators", generatedPath: "todo\\..\\File.ts" },
  ])(
    "rejects $scenario traversal paths that normalize back inside before writing",
    ({ generatedPath }) => {
      const outputDir = aTempDir();
      const generatorContext = aGeneratedProjectContext({ outputDir });
      const normalizedTargetFile = path.join(outputDir, "File.ts");
      const nestedTargetFile = path.join(outputDir, "todo", "File.ts");

      const writeNormalizedInsidePath = () =>
        generatorContext.writeFile(
          generatedPath,
          "export const file = true;\n"
        );

      expectUnsafeGeneratedFilePath(writeNormalizedInsidePath);
      expect(fs.existsSync(normalizedTargetFile)).toBe(false);
      expect(fs.existsSync(nestedTargetFile)).toBe(false);
      expect(generatorContext.getGeneratedFiles()).toEqual([]);
    }
  );

  test.each([
    { scenario: "POSIX trailing slash", generatedPath: "todo/" },
    { scenario: "Windows trailing slash", generatedPath: "todo\\" },
    {
      scenario: "POSIX final current-directory segment",
      generatedPath: "todo/.",
    },
    {
      scenario: "Windows final current-directory segment",
      generatedPath: "todo\\.",
    },
  ])(
    "rejects $scenario directory-like paths before writing",
    ({ generatedPath }) => {
      const outputDir = aTempDir();
      const generatorContext = aGeneratedProjectContext({ outputDir });

      const writeDirectoryLikePath = () =>
        generatorContext.writeFile(
          generatedPath,
          "export const directoryLike = true;\n"
        );

      expectUnsafeGeneratedFilePath(writeDirectoryLikePath);
      expect(fs.existsSync(path.join(outputDir, "todo"))).toBe(false);
      expect(generatorContext.getGeneratedFiles()).toEqual([]);
    }
  );

  test.each([
    {
      scenario: "POSIX separators",
      pathFromOutputParent: (outputDirName: string) =>
        `../${outputDirName}/todo/File.ts`,
    },
    {
      scenario: "Windows separators",
      pathFromOutputParent: (outputDirName: string) =>
        `..\\${outputDirName}\\todo\\File.ts`,
    },
    {
      scenario: "mixed separators",
      pathFromOutputParent: (outputDirName: string) =>
        `../${outputDirName}\\todo/File.ts`,
    },
  ])(
    "rejects $scenario traversal paths that re-enter the output directory before writing",
    ({ pathFromOutputParent }) => {
      const workspaceDir = aTempDir();
      const outputDir = path.join(workspaceDir, "generated");
      fs.mkdirSync(outputDir);
      const targetFile = path.join(outputDir, "todo", "File.ts");
      const generatorContext = aGeneratedProjectContext({ outputDir });

      const writeReenteredOutput = () =>
        generatorContext.writeFile(
          pathFromOutputParent(path.basename(outputDir)),
          "export const reentered = true;\n"
        );

      expectUnsafeGeneratedFilePath(writeReenteredOutput);
      expect(fs.existsSync(targetFile)).toBe(false);
      expect(generatorContext.getGeneratedFiles()).toEqual([]);
    }
  );
});
