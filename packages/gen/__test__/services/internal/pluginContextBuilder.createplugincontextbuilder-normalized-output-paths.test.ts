import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { HttpMethod } from "@rexeus/typeweaver-core";
import { FileSystem } from "effect";
import { afterEach, describe, expect, test } from "vitest";
import { UnsafeGeneratedPathError } from "../../../src/errors/UnsafeGeneratedPathError.js";
import {
  createPluginContextBuilder,
  liveSyncAtomicFileSystem,
} from "../../../src/services/internal/pluginContextBuilder.js";
import {
  livePathSafetyShape,
  liveTemplateRendererShape,
} from "../../../src/services/internal/pluginContextEffectIO.js";
import type { SyncAtomicFileSystem } from "../../../src/services/internal/pluginContextBuilder.js";

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
