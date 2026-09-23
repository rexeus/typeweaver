import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import {
  aBuilder,
  aGeneratedProjectContext,
  aTempDir,
  generatedProjectParams,
  isUnsupportedFilesystemOperationError,
  nativeGeneratedFilePath,
  removeTempDirs,
} from "./fixtures.js";
import type { FileSystemError } from "./fixtures.js";

const isHardlinkUnsupportedError = (
  error: unknown
): error is FileSystemError => {
  return isUnsupportedFilesystemOperationError(error);
};

const isFileModeUnsupportedError = (
  error: unknown
): error is FileSystemError => {
  return isUnsupportedFilesystemOperationError(error);
};

type HardlinkCapability =
  | { readonly supported: true }
  | { readonly supported: false; readonly reason: string };

const detectHardlinkCapability = (): HardlinkCapability => {
  const tempDir = fs.mkdtempSync(
    path.join(os.tmpdir(), "typeweaver-gen-hardlink-")
  );

  try {
    const targetFile = path.join(tempDir, "target.ts");
    const linkedFile = path.join(tempDir, "linked.ts");
    fs.writeFileSync(targetFile, "export const target = true;\n");
    fs.linkSync(targetFile, linkedFile);

    if (fs.statSync(targetFile).nlink < 2) {
      return {
        supported: false,
        reason: "hardlink creation did not increase link count",
      };
    }

    return { supported: true };
  } catch (error) {
    if (isHardlinkUnsupportedError(error)) {
      const errorCode = error.code;

      return {
        supported: false,
        reason: `hardlink creation failed with ${errorCode}`,
      };
    }

    throw error;
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
};

const hardlinkCapability = detectHardlinkCapability();

const hardlinkSkipReason = hardlinkCapability.supported
  ? ""
  : ` (${hardlinkCapability.reason})`;

type FileModeCapability =
  | { readonly supported: true }
  | { readonly supported: false; readonly reason: string };

const detectFileModeCapability = (): FileModeCapability => {
  const tempDir = fs.mkdtempSync(
    path.join(os.tmpdir(), "typeweaver-gen-mode-")
  );

  try {
    const filePath = path.join(tempDir, "generated.ts");
    fs.writeFileSync(filePath, "export const generated = false;\n");
    fs.chmodSync(filePath, 0o600);

    const fileMode = fs.statSync(filePath).mode & 0o777;

    if (fileMode !== 0o600) {
      return {
        supported: false,
        reason: `chmod produced mode ${fileMode.toString(8)}`,
      };
    }

    return { supported: true };
  } catch (error) {
    if (isFileModeUnsupportedError(error)) {
      const errorCode = error.code;

      return {
        supported: false,
        reason: `chmod failed with ${errorCode}`,
      };
    }

    throw error;
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
};

const fileModeCapability = detectFileModeCapability();

const fileModeSkipReason = fileModeCapability.supported
  ? ""
  : ` (${fileModeCapability.reason})`;

afterEach(removeTempDirs);

describe("createPluginContextBuilder basic writes", () => {
  test("returns resource output directories under the generator output directory", () => {
    const generatorContext = aGeneratedProjectContext();

    const outputDir = generatorContext.getResourceOutputDir("todo");

    expect(outputDir).toBe(path.join("project", "generated", "todo"));
  });

  test("builds JSON-safe operation definition accessors", () => {
    const generatorContext = aGeneratedProjectContext();

    const accessor = generatorContext.getOperationDefinitionAccessor({
      resourceName: "todo/item",
      operationId: 'get"Todo',
    });

    expect(accessor).toBe(
      'getOperationDefinition(spec, "todo/item", "get\\"Todo")'
    );
  });

  test("writes files relative to the generator output directory and records them", () => {
    const outputDir = aTempDir();
    const generatorContext = aGeneratedProjectContext({ outputDir });
    const generatedFile = "todo/GetTodoClient.ts";
    const generatedFilePath = nativeGeneratedFilePath(outputDir, generatedFile);

    generatorContext.writeFile(generatedFile, "export const client = true;\n");

    expect(fs.readFileSync(generatedFilePath, "utf8")).toBe(
      "export const client = true;\n"
    );
    expect(generatorContext.getGeneratedFiles()).toEqual([generatedFile]);
  });

  test("queues Generated log lines per write and drains them once", () => {
    const outputDir = aTempDir();
    const builder = aBuilder();
    const context = builder.createGeneratorContext({
      ...generatedProjectParams,
      outputDir,
    });

    context.writeFile("todo/GetTodoClient.ts", "export const client = true;\n");
    context.writeFile(
      "todo/GetTodoRequest.ts",
      "export const request = true;\n"
    );

    expect(builder.drainPendingWriteLogs()).toEqual([
      "todo/GetTodoClient.ts",
      "todo/GetTodoRequest.ts",
    ]);
    expect(builder.drainPendingWriteLogs()).toEqual([]);
    expect(context.getGeneratedFiles()).toEqual([
      "todo/GetTodoClient.ts",
      "todo/GetTodoRequest.ts",
    ]);
  });

  test("overwrites existing generated files and records them", () => {
    const outputDir = aTempDir();
    const generatorContext = aGeneratedProjectContext({ outputDir });
    const generatedFile = "todo/GetTodoClient.ts";
    const generatedFilePath = nativeGeneratedFilePath(outputDir, generatedFile);
    fs.mkdirSync(path.dirname(generatedFilePath), { recursive: true });
    fs.writeFileSync(generatedFilePath, "export const client = false;\n");

    generatorContext.writeFile(generatedFile, "export const client = true;\n");

    expect(fs.readFileSync(generatedFilePath, "utf8")).toBe(
      "export const client = true;\n"
    );
    expect(generatorContext.getGeneratedFiles()).toEqual([generatedFile]);
  });
});

describe("createPluginContextBuilder existing target replacement", () => {
  test.skipIf(!fileModeCapability.supported)(
    `preserves existing generated file mode when replacing it${fileModeSkipReason}`,
    () => {
      const outputDir = aTempDir();
      const generatorContext = aGeneratedProjectContext({ outputDir });
      const generatedFile = "todo/GetTodoClient.ts";
      const generatedFilePath = nativeGeneratedFilePath(
        outputDir,
        generatedFile
      );
      fs.mkdirSync(path.dirname(generatedFilePath), { recursive: true });
      fs.writeFileSync(generatedFilePath, "export const client = false;\n");
      fs.chmodSync(generatedFilePath, 0o600);
      const originalMode = fs.statSync(generatedFilePath).mode & 0o777;

      generatorContext.writeFile(
        generatedFile,
        "export const client = true;\n"
      );

      expect(fs.readFileSync(generatedFilePath, "utf8")).toBe(
        "export const client = true;\n"
      );
      expect(fs.statSync(generatedFilePath).mode & 0o777).toBe(originalMode);
      expect(generatorContext.getGeneratedFiles()).toEqual([generatedFile]);
    }
  );

  test.skipIf(!hardlinkCapability.supported)(
    `replaces generated hardlink targets without mutating external files${hardlinkSkipReason}`,
    () => {
      const workspaceDir = aTempDir();
      const outputDir = path.join(workspaceDir, "generated");
      const externalDir = path.join(workspaceDir, "external");
      const generatedFile = "todo/Generated.ts";
      const generatedFilePath = nativeGeneratedFilePath(
        outputDir,
        generatedFile
      );
      const externalFilePath = path.join(externalDir, "shared.ts");
      fs.mkdirSync(path.dirname(generatedFilePath), { recursive: true });
      fs.mkdirSync(externalDir);
      fs.writeFileSync(externalFilePath, "export const sentinel = true;\n");
      fs.linkSync(externalFilePath, generatedFilePath);

      const generatorContext = aGeneratedProjectContext({ outputDir });

      generatorContext.writeFile(
        generatedFile,
        "export const generated = true;\n"
      );

      expect(fs.readFileSync(externalFilePath, "utf8")).toBe(
        "export const sentinel = true;\n"
      );
      expect(fs.readFileSync(generatedFilePath, "utf8")).toBe(
        "export const generated = true;\n"
      );
      expect(generatorContext.getGeneratedFiles()).toEqual([generatedFile]);
    }
  );
});
