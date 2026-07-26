import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { HttpMethod } from "@rexeus/typeweaver-core";
import { FileSystem } from "@effect/platform";
import { afterEach, describe, expect, test } from "vitest";
import { UnsafeGeneratedPathError } from "../../../src/errors/UnsafeGeneratedPathError.js";
import { MissingCanonicalResponseError } from "../../../src/plugins/errors/MissingCanonicalResponseError.js";
import {
  createPluginContextBuilder,
  livePathSafetyShape,
  liveSyncAtomicFileSystem,
  liveTemplateRendererShape,
} from "../../../src/services/internal/pluginContextBuilder.js";
import type {
  NormalizedResponse,
  NormalizedSpec,
} from "../../../src/NormalizedSpec.js";
import type { SyncAtomicFileSystem } from "../../../src/services/internal/pluginContextBuilder.js";

const coordinationMarkerFile = ".typeweaver-coordination";
const atomicWriteMarkerSource =
  "typeweaver-coordination-artifact/v1\nkind=atomic-write-temp\n";

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

const validationErrorResponse: NormalizedResponse = {
  name: "validationError",
  statusCode: 400,
  statusCodeName: "BadRequest",
  description: "The request failed validation.",
  kind: "response",
};

const todoSpec: NormalizedSpec = {
  resources: [
    {
      name: "todo",
      operations: [
        {
          operationId: "getTodo",
          method: HttpMethod.GET,
          path: "/todos/{todoId}",
          summary: "Get a todo item.",
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

type GeneratorContextParams = Parameters<
  ReturnType<typeof createPluginContextBuilder>["createGeneratorContext"]
>[0];

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

const isSymlinkUnsupportedError = (error: unknown): boolean => {
  return isUnsupportedFilesystemOperationError(error);
};

const isHardlinkUnsupportedError = (error: unknown): boolean => {
  return isUnsupportedFilesystemOperationError(error);
};

const isFileModeUnsupportedError = (error: unknown): boolean => {
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

const outputDirWithInternalSymlink = (): {
  readonly outputDir: string;
  readonly targetDir: string;
} => {
  const outputDir = aTempDir();
  const targetDir = path.join(outputDir, "target");
  const linkedDir = path.join(outputDir, "linked");
  fs.mkdirSync(targetDir);
  fs.symlinkSync(targetDir, linkedDir, "dir");

  return { outputDir, targetDir };
};

afterEach(() => {
  for (const tempDir of tempDirs.splice(0)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

describe("createPluginContextBuilder context metadata and imports", () => {
  test("creates plugin contexts with the configured directories and config", () => {
    const pluginContext = aBuilder().createPluginContext({
      outputDir: path.join("project", "generated"),
      inputDir: path.join("project", "definitions"),
      config: { emitRuntimeTypes: true },
    });

    expect(pluginContext).toEqual({
      outputDir: path.join("project", "generated"),
      inputDir: path.join("project", "definitions"),
      config: { emitRuntimeTypes: true },
    });
  });

  test("exposes configured generator metadata unchanged", () => {
    const generatorContext = aGeneratedProjectContext();

    expect({
      outputDir: generatorContext.outputDir,
      inputDir: generatorContext.inputDir,
      config: generatorContext.config,
      normalizedSpec: generatorContext.normalizedSpec,
      coreDir: generatorContext.coreDir,
      responsesOutputDir: generatorContext.responsesOutputDir,
      specOutputDir: generatorContext.specOutputDir,
    }).toEqual({
      outputDir: generatedProjectParams.outputDir,
      inputDir: generatedProjectParams.inputDir,
      config: generatedProjectParams.config,
      normalizedSpec: generatedProjectParams.normalizedSpec,
      coreDir: generatedProjectParams.coreDir,
      responsesOutputDir: generatedProjectParams.responsesOutputDir,
      specOutputDir: generatedProjectParams.specOutputDir,
    });
  });

  test.each([
    {
      scenario: "sibling resource directory",
      importerDir: path.join("project", "generated", "todo"),
      expected: "../spec/spec.js",
    },
    {
      scenario: "deeply nested generated directory",
      importerDir: path.join(
        "project",
        "generated",
        "todo",
        "validators",
        "nested"
      ),
      expected: "../../../spec/spec.js",
    },
    {
      scenario: "same spec output directory",
      importerDir: path.join("project", "generated", "spec"),
      expected: "./spec.js",
    },
  ])(
    "returns a POSIX spec import path from a $scenario",
    ({ importerDir, expected }) => {
      const generatorContext = aGeneratedProjectContext();

      const specImportPath = generatorContext.getSpecImportPath({
        importerDir,
      });

      expect(specImportPath).toBe(expected);
      expect(specImportPath).not.toContain("\\");
    }
  );

  test.each([
    {
      scenario: "same responses directory",
      importerDir: path.join("project", "generated", "responses"),
      expected: "./ValidationErrorResponse.js",
    },
    {
      scenario: "nested resource directory",
      importerDir: path.join("project", "generated", "todo", "validators"),
      expected: "../../responses/ValidationErrorResponse.js",
    },
    {
      scenario: "parent generated directory",
      importerDir: path.join("project", "generated"),
      expected: "./responses/ValidationErrorResponse.js",
    },
  ])(
    "returns a POSIX canonical response import path from a $scenario",
    ({ importerDir, expected }) => {
      const generatorContext = aGeneratedProjectContext();

      const responseImportPath =
        generatorContext.getCanonicalResponseImportPath({
          importerDir,
          responseName: "validationError",
        });

      expect(responseImportPath).toBe(expected);
      expect(responseImportPath).not.toContain("\\");
    }
  );
});

describe("createPluginContextBuilder canonical response metadata", () => {
  test("names canonical response output files with PascalCase response names under the responses output directory", () => {
    const generatorContext = aGeneratedProjectContext();

    const outputFile =
      generatorContext.getCanonicalResponseOutputFile("validationError");

    expect(outputFile).toBe(
      path.join(
        "project",
        "generated",
        "responses",
        "ValidationErrorResponse.ts"
      )
    );
  });

  test("returns canonical response definitions by normalized response name", () => {
    const generatorContext = aGeneratedProjectContext();

    const response = generatorContext.getCanonicalResponse("validationError");

    expect(response).toBe(validationErrorResponse);
  });

  test("reports the missing canonical response name", () => {
    const generatorContext = aGeneratedProjectContext();

    const readMissingResponse = () =>
      generatorContext.getCanonicalResponse("unauthorized");

    expect(readMissingResponse).toThrowError(MissingCanonicalResponseError);
    expect(readMissingResponse).toThrowError(
      "Missing canonical response 'unauthorized' in the normalized spec."
    );

    // Discriminating field assertion: the tagged error carries the missing
    // response name so a downstream handler can report which key was
    // requested, not just that something was missing.
    let captured: MissingCanonicalResponseError | undefined;
    try {
      readMissingResponse();
    } catch (error) {
      if (error instanceof MissingCanonicalResponseError) captured = error;
    }
    expect(captured?.responseName).toBe("unauthorized");
  });
});

describe("createPluginContextBuilder operation output paths", () => {
  test.each([
    {
      scenario: "camelCase operation id",
      operationId: "getTodo",
      fileBase: "GetTodo",
    },
    {
      scenario: "PascalCase operation id",
      operationId: "GetTodo",
      fileBase: "GetTodo",
    },
    {
      scenario: "operation id with numeric segment",
      operationId: "getV2Todo",
      fileBase: "GetV2Todo",
    },
  ])(
    "names $scenario outputs with PascalCase TypeScript file names",
    ({ operationId, fileBase }) => {
      const paths = aGeneratedProjectContext().getOperationOutputPaths({
        resourceName: "todo",
        operationId,
      });

      expect({
        requestFileName: paths.requestFileName,
        responseFileName: paths.responseFileName,
        requestValidationFileName: paths.requestValidationFileName,
        responseValidationFileName: paths.responseValidationFileName,
        clientFileName: paths.clientFileName,
      }).toEqual({
        requestFileName: `${fileBase}Request.ts`,
        responseFileName: `${fileBase}Response.ts`,
        requestValidationFileName: `${fileBase}RequestValidator.ts`,
        responseValidationFileName: `${fileBase}ResponseValidator.ts`,
        clientFileName: `${fileBase}Client.ts`,
      });
    }
  );

  test("places operation output files under the resource output directory", () => {
    const paths = aGeneratedProjectContext().getOperationOutputPaths({
      resourceName: "todo",
      operationId: "getTodo",
    });

    const outputDir = path.join("project", "generated", "todo");
    expect({
      outputDir: paths.outputDir,
      requestFile: paths.requestFile,
      responseFile: paths.responseFile,
      requestValidationFile: paths.requestValidationFile,
      responseValidationFile: paths.responseValidationFile,
      clientFile: paths.clientFile,
    }).toEqual({
      outputDir,
      requestFile: path.join(outputDir, "GetTodoRequest.ts"),
      responseFile: path.join(outputDir, "GetTodoResponse.ts"),
      requestValidationFile: path.join(outputDir, "GetTodoRequestValidator.ts"),
      responseValidationFile: path.join(
        outputDir,
        "GetTodoResponseValidator.ts"
      ),
      clientFile: path.join(outputDir, "GetTodoClient.ts"),
    });
  });
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

describe("createPluginContextBuilder symlink root rejection", () => {
  test.skipIf(!symlinkCapability.supported)(
    `rejects safe internal directory symlinks before writing inside the output directory${symlinkSkipReason}`,
    () => {
      const { outputDir, targetDir } = outputDirWithInternalSymlink();
      const generatorContext = aGeneratedProjectContext({ outputDir });
      const targetFile = path.join(targetDir, "GetTodoClient.ts");

      const writeThroughInternalSymlink = () =>
        generatorContext.writeFile(
          "linked/GetTodoClient.ts",
          "export const client = true;\n"
        );

      expectUnsafeGeneratedFilePath(writeThroughInternalSymlink);
      expect(fs.existsSync(targetFile)).toBe(false);
      expect(generatorContext.getGeneratedFiles()).toEqual([]);
    }
  );

  test.skipIf(!symlinkCapability.supported)(
    `rejects existing output-root symlinks before writing generated files${symlinkSkipReason}`,
    () => {
      const workspaceDir = aTempDir();
      const targetOutputDir = path.join(workspaceDir, "target-generated");
      const outputDir = path.join(workspaceDir, "generated");
      const targetFile = path.join(targetOutputDir, "todo", "GetTodoClient.ts");
      fs.mkdirSync(targetOutputDir);
      fs.symlinkSync(targetOutputDir, outputDir, "dir");

      const generatorContext = aGeneratedProjectContext({ outputDir });

      const writeThroughOutputRootSymlink = () =>
        generatorContext.writeFile(
          path.join("todo", "GetTodoClient.ts"),
          "export const client = true;\n"
        );

      expectUnsafeGeneratedFilePath(writeThroughOutputRootSymlink);
      expect(fs.existsSync(targetFile)).toBe(false);
      expect(generatorContext.getGeneratedFiles()).toEqual([]);
    }
  );

  test.skipIf(!symlinkCapability.supported)(
    `rejects safe internal symlink paths before tracking generated files${symlinkSkipReason}`,
    () => {
      const { outputDir } = outputDirWithInternalSymlink();
      const generatorContext = aGeneratedProjectContext({ outputDir });

      const trackInternalSymlinkPath = () =>
        generatorContext.addGeneratedFile("linked/GetTodoClient.ts");

      expectUnsafeGeneratedFilePath(trackInternalSymlinkPath);
      expect(generatorContext.getGeneratedFiles()).toEqual([]);
    }
  );

  test.skipIf(!symlinkCapability.supported)(
    `rejects existing output-root symlinks before tracking generated files${symlinkSkipReason}`,
    () => {
      const workspaceDir = aTempDir();
      const targetOutputDir = path.join(workspaceDir, "target-generated");
      const outputDir = path.join(workspaceDir, "generated");
      fs.mkdirSync(targetOutputDir);
      fs.symlinkSync(targetOutputDir, outputDir, "dir");

      const generatorContext = aGeneratedProjectContext({ outputDir });

      const trackOutputRootSymlinkPath = () =>
        generatorContext.addGeneratedFile(
          path.join("todo", "GetTodoClient.ts")
        );

      expectUnsafeGeneratedFilePath(trackOutputRootSymlinkPath);
      expect(generatorContext.getGeneratedFiles()).toEqual([]);
    }
  );
});

describe("createPluginContextBuilder unsafe generated-file tracking", () => {
  test("rejects unsafe generated file tracking paths", () => {
    const outputDir = aTempDir();
    const generatorContext = aGeneratedProjectContext({ outputDir });

    const trackUnsafePath = () =>
      generatorContext.addGeneratedFile("../outside.ts");

    expectUnsafeGeneratedFilePath(trackUnsafePath);
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
  ])(
    "rejects $scenario generated file paths before tracking",
    ({ generatedPath }) => {
      const outputDir = aTempDir();
      const generatorContext = aGeneratedProjectContext({ outputDir });

      const trackOutputRoot = () =>
        generatorContext.addGeneratedFile(generatedPath);

      expectUnsafeGeneratedFilePath(trackOutputRoot);
      expect(generatorContext.getGeneratedFiles()).toEqual([]);
    }
  );
});

describe("createPluginContextBuilder absolute and traversal tracking rejection", () => {
  test("rejects absolute POSIX paths before tracking generated files", () => {
    const workspaceDir = aTempDir();
    const outputDir = path.join(workspaceDir, "generated");
    fs.mkdirSync(outputDir);
    const outsideFile = path.join(workspaceDir, "outside.ts");
    const generatorContext = aGeneratedProjectContext({ outputDir });

    const trackOutside = () => generatorContext.addGeneratedFile(outsideFile);

    expectUnsafeGeneratedFilePath(trackOutside);
    expect(generatorContext.getGeneratedFiles()).toEqual([]);
  });

  test.each([
    { scenario: "POSIX separators", generatedPath: "todo/../File.ts" },
    { scenario: "Windows separators", generatedPath: "todo\\..\\File.ts" },
  ])(
    "rejects $scenario traversal paths that normalize back inside before tracking generated files",
    ({ generatedPath }) => {
      const outputDir = aTempDir();
      const generatorContext = aGeneratedProjectContext({ outputDir });

      const trackNormalizedInsidePath = () =>
        generatorContext.addGeneratedFile(generatedPath);

      expectUnsafeGeneratedFilePath(trackNormalizedInsidePath);
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
    "rejects $scenario directory-like paths before tracking generated files",
    ({ generatedPath }) => {
      const outputDir = aTempDir();
      const generatorContext = aGeneratedProjectContext({ outputDir });

      const trackDirectoryLikePath = () =>
        generatorContext.addGeneratedFile(generatedPath);

      expectUnsafeGeneratedFilePath(trackDirectoryLikePath);
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
    "rejects $scenario traversal paths that re-enter the output directory before tracking generated files",
    ({ pathFromOutputParent }) => {
      const workspaceDir = aTempDir();
      const outputDir = path.join(workspaceDir, "generated");
      fs.mkdirSync(outputDir);
      const generatorContext = aGeneratedProjectContext({ outputDir });

      const trackReenteredOutput = () =>
        generatorContext.addGeneratedFile(
          pathFromOutputParent(path.basename(outputDir))
        );

      expectUnsafeGeneratedFilePath(trackReenteredOutput);
      expect(generatorContext.getGeneratedFiles()).toEqual([]);
    }
  );
});

describe("createPluginContextBuilder normalized generated-file tracking", () => {
  test("normalizes current-directory segments before tracking generated files", () => {
    const outputDir = aTempDir();
    const generatorContext = aGeneratedProjectContext({ outputDir });

    generatorContext.addGeneratedFile("todo/./GetTodoClient.ts");

    expect(generatorContext.getGeneratedFiles()).toEqual([
      "todo/GetTodoClient.ts",
    ]);
  });

  test("normalizes Windows separators before tracking generated files", () => {
    const outputDir = aTempDir();
    const generatorContext = aGeneratedProjectContext({ outputDir });

    generatorContext.addGeneratedFile("todo\\GetTodoClient.ts");

    expect(generatorContext.getGeneratedFiles()).toEqual([
      "todo/GetTodoClient.ts",
    ]);
  });

  test.each([
    { scenario: "Windows traversal", generatedPath: "..\\outside.ts" },
    {
      scenario: "nested Windows traversal",
      generatedPath: "todo\\..\\..\\outside.ts",
    },
    { scenario: "Windows rooted", generatedPath: "\\tmp\\outside.ts" },
    {
      scenario: "UNC share",
      generatedPath: "\\\\server\\share\\outside.ts",
    },
    { scenario: "drive-relative", generatedPath: "C:tmp\\outside.ts" },
  ])(
    "rejects unsafe $scenario paths when tracking generated files",
    ({ generatedPath }) => {
      const workspaceDir = aTempDir();
      const outputDir = path.join(workspaceDir, "generated");
      fs.mkdirSync(outputDir);
      const generatorContext = aGeneratedProjectContext({ outputDir });

      const trackUnsafePath = () =>
        generatorContext.addGeneratedFile(generatedPath);

      expectUnsafeGeneratedFilePath(trackUnsafePath);
      expect(generatorContext.getGeneratedFiles()).toEqual([]);
    }
  );
});

describe("createPluginContextBuilder generated-file tracker semantics", () => {
  test("returns defensive arrays for generated file tracking", () => {
    const generatorContext = aGeneratedProjectContext();

    generatorContext.addGeneratedFile("todo/GetTodoClient.ts");
    const generatedFiles = generatorContext.getGeneratedFiles();

    generatedFiles.push("mutated.ts");

    expect(generatorContext.getGeneratedFiles()).toEqual([
      "todo/GetTodoClient.ts",
    ]);
  });

  test("returns generated file paths in stable alphabetical order regardless of write order", () => {
    const outputDir = aTempDir();
    const generatorContext = aGeneratedProjectContext({ outputDir });

    // Track in reverse alphabetical order to surface any insertion-order
    // dependency.
    generatorContext.addGeneratedFile("todo/Z.ts");
    generatorContext.addGeneratedFile("todo/M.ts");
    generatorContext.addGeneratedFile("todo/A.ts");

    expect(generatorContext.getGeneratedFiles()).toEqual([
      "todo/A.ts",
      "todo/M.ts",
      "todo/Z.ts",
    ]);
  });

  test("isolates the generated-file tracker across builder instances", () => {
    const firstBuilder = aBuilder();
    const secondBuilder = aBuilder();

    const firstContext = firstBuilder.createGeneratorContext(
      generatedProjectParams
    );
    const secondContext = secondBuilder.createGeneratorContext(
      generatedProjectParams
    );

    firstContext.addGeneratedFile("todo/GetTodoClient.ts");

    expect(firstBuilder.getGeneratedFiles()).toEqual(["todo/GetTodoClient.ts"]);
    expect(secondBuilder.getGeneratedFiles()).toEqual([]);
    expect(secondContext.getGeneratedFiles()).toEqual([]);
  });
});

describe("createPluginContextBuilder template rendering", () => {
  test("renders relative template paths from the configured template directory", () => {
    const templateDir = aTempDir();
    fs.writeFileSync(
      path.join(templateDir, "message.ejs"),
      "Hello <%= name %>!"
    );
    const generatorContext = aGeneratedProjectContext({ templateDir });

    const result = generatorContext.renderTemplate("message.ejs", {
      name: "Ada",
    });

    expect(result).toBe("Hello Ada!");
  });

  test("renders absolute template paths without prefixing the template directory", () => {
    const templateDir = aTempDir();
    const absoluteTemplatePath = path.join(aTempDir(), "absolute.ejs");
    fs.writeFileSync(path.join(templateDir, "absolute.ejs"), "wrong template");
    fs.writeFileSync(absoluteTemplatePath, "Absolute <%= name %>");
    const generatorContext = aGeneratedProjectContext({ templateDir });

    const result = generatorContext.renderTemplate(absoluteTemplatePath, {
      name: "template",
    });

    expect(result).toBe("Absolute template");
  });

  test.each([
    { scenario: "null data", data: null },
    { scenario: "undefined data", data: undefined },
  ])("renders static templates with $scenario as empty data", ({ data }) => {
    const templateDir = aTempDir();
    fs.writeFileSync(path.join(templateDir, "static.ejs"), "static output");
    const generatorContext = aGeneratedProjectContext({ templateDir });

    const result = generatorContext.renderTemplate("static.ejs", data);

    expect(result).toBe("static output");
  });
});
