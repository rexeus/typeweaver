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

const nativeGeneratedFilePath = (
  outputDir: string,
  generatedFile: string
): string => path.join(outputDir, ...generatedFile.split("/"));

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

const isHardlinkUnsupportedError = (error: unknown): boolean => {
  return isUnsupportedFilesystemOperationError(error);
};

const isFileModeUnsupportedError = (error: unknown): boolean => {
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
      const errorCode = (error as FileSystemError).code;

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
      const errorCode = (error as FileSystemError).code;

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

afterEach(() => {
  for (const tempDir of tempDirs.splice(0)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

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
