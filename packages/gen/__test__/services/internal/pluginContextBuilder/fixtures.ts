import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { HttpMethod } from "@rexeus/typeweaver-core";
import { FileSystem } from "effect";
import { expect } from "vitest";
import { createPluginContextBuilder } from "../../../../src/services/internal/pluginContextBuilder.js";
import {
  livePathSafetyShape,
  liveTemplateRendererShape,
} from "../../../../src/services/internal/pluginContextEffectIO.js";
import { liveSyncAtomicFileSystem } from "../../../../src/services/internal/pluginContextFileWriter.js";
import type { SyncAtomicFileSystem } from "../../../../src/services/internal/pluginContextFileWriter.js";

/**
 * Real-deps factory for the sync plugin-context builder: the exact live
 * shapes the production `ContextBuilder` service wires in — the pure
 * path-safety guard and the project's hand-rolled template engine. The
 * Effect-native context surface is exercised separately against an
 * in-memory `FileSystem` (see the cli-side
 * `pluginContextEffect.inMemoryFs.test.ts`); the no-op implementation here
 * only satisfies the builder's dependency shape.
 */
export const realPluginContextBuilderDeps = {
  pathSafety: livePathSafetyShape,
  templateRenderer: liveTemplateRendererShape,
  syncAtomicFileSystem: liveSyncAtomicFileSystem,
  fileSystem: FileSystem.makeNoop({}),
};

export const aBuilder = (
  syncAtomicFileSystem: SyncAtomicFileSystem = liveSyncAtomicFileSystem
) =>
  createPluginContextBuilder({
    ...realPluginContextBuilderDeps,
    syncAtomicFileSystem,
  });

export type GeneratorContextParams = Parameters<
  ReturnType<typeof createPluginContextBuilder>["createGeneratorContext"]
>[0];

export type NormalizedSpec = GeneratorContextParams["normalizedSpec"];

export type NormalizedResponse = NormalizedSpec["responses"][number];

export const validationErrorResponse: NormalizedResponse = {
  name: "validationError",
  statusCode: 400,
  statusCodeName: "BadRequest",
  description: "The request failed validation.",
  kind: "response",
};

export const todoSpec: NormalizedSpec = {
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

export const generatedProjectParams: GeneratorContextParams = {
  outputDir: path.join("project", "generated"),
  inputDir: path.join("project", "definitions"),
  config: { emitRuntimeTypes: true },
  normalizedSpec: todoSpec,
  templateDir: path.join("project", "templates"),
  coreDir: "@rexeus/typeweaver-core",
  responsesOutputDir: path.join("project", "generated", "responses"),
  specOutputDir: path.join("project", "generated", "spec"),
};

export const aGeneratedProjectContext = (
  overrides: Partial<GeneratorContextParams> = {}
) =>
  aBuilder().createGeneratorContext({
    ...generatedProjectParams,
    ...overrides,
  });

const tempDirs: string[] = [];

export const removeTempDirs = (): void => {
  for (const tempDir of tempDirs.splice(0)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
};

export const aTempDir = (): string => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "typeweaver-gen-"));
  tempDirs.push(tempDir);
  return tempDir;
};

export const catchThrownError = (operation: () => void): unknown => {
  try {
    operation();
  } catch (error) {
    return error;
  }

  throw new Error("Expected operation to throw.");
};

export const expectUnsafeGeneratedFilePath = (operation: () => void): void => {
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

export const nativeGeneratedFilePath = (
  outputDir: string,
  generatedFile: string
): string => path.join(outputDir, ...generatedFile.split("/"));

export type FileSystemError = Error & {
  readonly code?: string;
};

export const UNSUPPORTED_FILESYSTEM_OPERATION_CODES = [
  "EACCES",
  "EINVAL",
  "ENOSYS",
  "ENOTSUP",
  "EOPNOTSUPP",
  "EPERM",
] as const;

export const isUnsupportedFilesystemOperationError = (
  error: unknown
): boolean => {
  if (!(error instanceof Error)) {
    return false;
  }

  const errorCode = (error as FileSystemError).code;

  return UNSUPPORTED_FILESYSTEM_OPERATION_CODES.some(
    unsupportedCode => unsupportedCode === errorCode
  );
};
