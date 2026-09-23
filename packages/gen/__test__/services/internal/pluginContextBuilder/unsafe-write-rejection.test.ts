import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { HttpMethod } from "@rexeus/typeweaver-core";
import { FileSystem } from "effect";
import { afterEach, describe, expect, test } from "vitest";
import {
  createPluginContextBuilder,
  liveSyncAtomicFileSystem,
} from "../../../../src/services/internal/pluginContextBuilder.js";
import {
  livePathSafetyShape,
  liveTemplateRendererShape,
} from "../../../../src/services/internal/pluginContextEffectIO.js";
import type { SyncAtomicFileSystem } from "../../../../src/services/internal/pluginContextBuilder.js";

/**
 * Real-deps factory for the sync plugin-context builder: the exact live
 * shapes the production `ContextBuilder` service wires in — the pure
 * path-safety guard and the project's hand-rolled template engine. The
 * Effect-native context surface is exercised separately against an
 * in-memory `FileSystem` (see the cli-side
 * `pluginContextEffect.inMemoryFs.test.ts`); the no-op implementation here
 * only satisfies the builder's dependency shape.
 */
const realPluginContextBuilderDeps = {
  pathSafety: livePathSafetyShape,
  templateRenderer: liveTemplateRendererShape,
  syncAtomicFileSystem: liveSyncAtomicFileSystem,
  fileSystem: FileSystem.makeNoop({}),
};

const aBuilder = (
  syncAtomicFileSystem: SyncAtomicFileSystem = liveSyncAtomicFileSystem
) =>
  createPluginContextBuilder({
    ...realPluginContextBuilderDeps,
    syncAtomicFileSystem,
  });

type GeneratorContextParams = Parameters<
  ReturnType<typeof createPluginContextBuilder>["createGeneratorContext"]
>[0];

type NormalizedSpec = GeneratorContextParams["normalizedSpec"];

type NormalizedResponse = NormalizedSpec["responses"][number];

const validationErrorResponse: NormalizedResponse = {
  name: "validationError",
  statusCode: 400,
  statusCodeName: "BadRequest",
  description: "The request failed validation.",
  kind: "response",
};

const todoSpec: NormalizedSpec = {
  metadata: { title: "Todo Test API", version: "1.0.0" },
  securitySchemes: [],
  security: { requirements: [], source: "none" },
  resources: [
    {
      name: "todo",
      tags: [],
      security: { requirements: [], source: "none" },
      operations: [
        {
          operationId: "getTodo",
          method: HttpMethod.GET,
          path: "/todos/{todoId}",
          summary: "Get a todo item.",
          deprecated: false,
          tags: [],
          security: { requirements: [], source: "none" },
          responses: [
            {
              source: "canonical",
              responseName: "validationError",
            },
          ],
        },
      ],
    },
  ],
  responses: [validationErrorResponse],
  warnings: [],
};

const generatedProjectParams: GeneratorContextParams = {
  outputDir: path.join("project", "generated"),
  inputDir: path.join("project", "definitions"),
  config: { emitRuntimeTypes: true },
  normalizedSpec: todoSpec,
  templateDir: path.join("project", "templates"),
  coreDir: "@rexeus/typeweaver-core",
  responsesOutputDir: path.join("project", "generated", "responses"),
  specOutputDir: path.join("project", "generated", "spec"),
};

const aGeneratedProjectContext = (
  overrides: Partial<GeneratorContextParams> = {}
) =>
  aBuilder().createGeneratorContext({
    ...generatedProjectParams,
    ...overrides,
  });

const tempDirs: string[] = [];

const aTempDir = (): string => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "typeweaver-gen-"));
  tempDirs.push(tempDir);
  return tempDir;
};

type FileSystemError = Error & {
  readonly code?: string;
};

const UNSUPPORTED_FILESYSTEM_OPERATION_CODES = [
  "EACCES",
  "EINVAL",
  "ENOSYS",
  "ENOTSUP",
  "EOPNOTSUPP",
  "EPERM",
] as const;

const isUnsupportedFilesystemOperationError = (error: unknown): boolean => {
  if (!(error instanceof Error)) {
    return false;
  }

  const errorCode = (error as FileSystemError).code;

  return UNSUPPORTED_FILESYSTEM_OPERATION_CODES.some(
    unsupportedCode => unsupportedCode === errorCode
  );
};

const isSymlinkUnsupportedError = (error: unknown): boolean => {
  return isUnsupportedFilesystemOperationError(error);
};

type SymlinkCapability =
  | { readonly supported: true }
  | { readonly supported: false; readonly reason: string };

const detectSymlinkCapability = (): SymlinkCapability => {
  const tempDir = fs.mkdtempSync(
    path.join(os.tmpdir(), "typeweaver-gen-symlink-")
  );

  try {
    const targetDir = path.join(tempDir, "target");
    fs.mkdirSync(targetDir);
    fs.symlinkSync(targetDir, path.join(tempDir, "link"), "dir");

    return { supported: true };
  } catch (error) {
    if (isSymlinkUnsupportedError(error)) {
      const errorCode = (error as FileSystemError).code;

      return {
        supported: false,
        reason: `symlink creation failed with ${errorCode}`,
      };
    }

    throw error;
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
};

const symlinkCapability = detectSymlinkCapability();

const symlinkSkipReason = symlinkCapability.supported
  ? ""
  : ` (${symlinkCapability.reason})`;

const catchThrownError = (operation: () => void): unknown => {
  try {
    operation();
  } catch (error) {
    return error;
  }

  throw new Error("Expected operation to throw.");
};

const expectUnsafeGeneratedFilePath = (operation: () => void): void => {
  const error = catchThrownError(operation);

  expect(error).toBeInstanceOf(Error);

  if (!(error instanceof Error)) {
    return;
  }

  expect(error.message).toContain("Unsafe generated file path");
  expect(error.message).toContain(
    "Generated writes must stay inside the output directory."
  );
};

afterEach(() => {
  for (const tempDir of tempDirs.splice(0)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

describe("createPluginContextBuilder absolute write rejection", () => {
  test("rejects absolute POSIX paths before writing outside the output directory", () => {
    const workspaceDir = aTempDir();
    const outputDir = path.join(workspaceDir, "generated");
    fs.mkdirSync(outputDir);
    const outsideFile = path.join(workspaceDir, "outside.ts");
    const generatorContext = aGeneratedProjectContext({ outputDir });

    const writeOutside = () =>
      generatorContext.writeFile(outsideFile, "export const outside = true;\n");

    expectUnsafeGeneratedFilePath(writeOutside);
    expect(fs.existsSync(outsideFile)).toBe(false);
    expect(generatorContext.getGeneratedFiles()).toEqual([]);
  });

  test.each([
    { scenario: "drive absolute", generatedPath: "C:\\tmp\\outside.ts" },
    { scenario: "drive relative", generatedPath: "C:tmp\\outside.ts" },
    { scenario: "rooted", generatedPath: "\\tmp\\outside.ts" },
    {
      scenario: "UNC share",
      generatedPath: "\\\\server\\share\\outside.ts",
    },
  ])("rejects Windows-style $scenario paths", ({ generatedPath }) => {
    const outputDir = aTempDir();
    const generatorContext = aGeneratedProjectContext({ outputDir });

    const writeOutside = () =>
      generatorContext.writeFile(
        generatedPath,
        "export const outside = true;\n"
      );

    expectUnsafeGeneratedFilePath(writeOutside);
    expect(generatorContext.getGeneratedFiles()).toEqual([]);
  });

  test.each([
    { scenario: "empty", generatedPath: "" },
    { scenario: "current-directory", generatedPath: "." },
    { scenario: "current-directory segment", generatedPath: "./" },
    {
      scenario: "directory that normalizes to current",
      generatedPath: "todo/..",
    },
  ])("rejects $scenario generated file paths", ({ generatedPath }) => {
    const outputDir = aTempDir();
    const generatorContext = aGeneratedProjectContext({ outputDir });

    const writeOutputRoot = () =>
      generatorContext.writeFile(
        generatedPath,
        "export const invalid = true;\n"
      );

    expectUnsafeGeneratedFilePath(writeOutputRoot);
    expect(generatorContext.getGeneratedFiles()).toEqual([]);
  });
});

describe("createPluginContextBuilder normalized traversal write rejection", () => {
  test("rejects traversal paths that normalize outside the output directory", () => {
    const workspaceDir = aTempDir();
    const outputDir = path.join(workspaceDir, "generated");
    fs.mkdirSync(outputDir);
    const outsideFile = path.join(workspaceDir, "outside.ts");
    const generatorContext = aGeneratedProjectContext({ outputDir });

    const writeOutside = () =>
      generatorContext.writeFile(
        "todo/../../outside.ts",
        "export const outside = true;\n"
      );

    expectUnsafeGeneratedFilePath(writeOutside);
    expect(fs.existsSync(outsideFile)).toBe(false);
    expect(generatorContext.getGeneratedFiles()).toEqual([]);
  });

  test.each([
    {
      scenario: "single Windows parent segment",
      generatedPath: "..\\outside.ts",
    },
    {
      scenario: "nested mixed separators",
      generatedPath: "todo\\..\\..\\outside.ts",
    },
  ])("rejects $scenario traversal paths", ({ generatedPath }) => {
    const workspaceDir = aTempDir();
    const outputDir = path.join(workspaceDir, "generated");
    fs.mkdirSync(outputDir);
    const outsideFile = path.join(workspaceDir, "outside.ts");
    const generatorContext = aGeneratedProjectContext({ outputDir });

    const writeOutside = () =>
      generatorContext.writeFile(
        generatedPath,
        "export const outside = true;\n"
      );

    expectUnsafeGeneratedFilePath(writeOutside);
    expect(fs.existsSync(outsideFile)).toBe(false);
    expect(generatorContext.getGeneratedFiles()).toEqual([]);
  });
});

describe("createPluginContextBuilder symlink component rejection", () => {
  test.skipIf(!symlinkCapability.supported)(
    `rejects symlink directory components before writing outside the output directory${symlinkSkipReason}`,
    () => {
      const workspaceDir = aTempDir();
      const outputDir = path.join(workspaceDir, "generated");
      const externalDir = path.join(workspaceDir, "external");
      const symlinkDir = path.join(outputDir, "linked");
      const externalFile = path.join(externalDir, "outside.ts");
      fs.mkdirSync(outputDir);
      fs.mkdirSync(externalDir);
      fs.symlinkSync(externalDir, symlinkDir, "dir");

      const generatorContext = aGeneratedProjectContext({ outputDir });

      const writeOutside = () =>
        generatorContext.writeFile(
          "linked/outside.ts",
          "export const outside = true;\n"
        );

      expectUnsafeGeneratedFilePath(writeOutside);
      expect(fs.existsSync(externalFile)).toBe(false);
      expect(generatorContext.getGeneratedFiles()).toEqual([]);
    }
  );

  test.skipIf(!symlinkCapability.supported)(
    `rejects dangling final-path symlinks before writing outside the output directory${symlinkSkipReason}`,
    () => {
      const workspaceDir = aTempDir();
      const outputDir = path.join(workspaceDir, "generated");
      const outsideFile = path.join(workspaceDir, "missing", "outside.ts");
      fs.mkdirSync(outputDir);
      fs.symlinkSync(outsideFile, path.join(outputDir, "outside.ts"), "file");

      const generatorContext = aGeneratedProjectContext({ outputDir });

      const writeOutside = () =>
        generatorContext.writeFile(
          "outside.ts",
          "export const outside = true;\n"
        );

      expectUnsafeGeneratedFilePath(writeOutside);
      expect(fs.existsSync(outsideFile)).toBe(false);
      expect(generatorContext.getGeneratedFiles()).toEqual([]);
    }
  );

  test.skipIf(!symlinkCapability.supported)(
    `rejects final-path file symlinks before truncating outside files${symlinkSkipReason}`,
    () => {
      const workspaceDir = aTempDir();
      const outputDir = path.join(workspaceDir, "generated");
      const externalDir = path.join(workspaceDir, "external");
      const externalFile = path.join(externalDir, "outside.ts");
      fs.mkdirSync(outputDir);
      fs.mkdirSync(externalDir);
      fs.writeFileSync(externalFile, "export const outside = false;\n");
      fs.symlinkSync(externalFile, path.join(outputDir, "outside.ts"), "file");

      const generatorContext = aGeneratedProjectContext({ outputDir });

      const writeOutside = () =>
        generatorContext.writeFile(
          "outside.ts",
          "export const outside = true;\n"
        );

      expectUnsafeGeneratedFilePath(writeOutside);
      expect(fs.readFileSync(externalFile, "utf8")).toBe(
        "export const outside = false;\n"
      );
      expect(generatorContext.getGeneratedFiles()).toEqual([]);
    }
  );
});
