import fs from "node:fs";
import path from "node:path";
import { pascalCase } from "polycase";
import { relative } from "../helpers/path.js";
import { renderTemplate } from "../helpers/templateEngine.js";
import { MissingCanonicalResponseError } from "./errors/MissingCanonicalResponseError.js";
import type { NormalizedResponse, NormalizedSpec } from "../NormalizedSpec.js";
import type { GeneratorContext, PluginConfig, PluginContext } from "./types.js";

type SafeGeneratedFilePath = {
  readonly fullPath: string;
  readonly generatedPath: string;
};

type FileSystemError = Error & {
  readonly code?: string;
};

const WINDOWS_DRIVE_PREFIX_PATTERN = /^[a-zA-Z]:/;

function resolveSafeGeneratedFilePath(
  outputDir: string,
  requestedPath: string
): SafeGeneratedFilePath {
  if (requestedPath.length === 0) {
    throwUnsafeGeneratedFilePath(requestedPath, "path must not be empty");
  }

  const projectPath = requestedPath.replace(/\\/g, "/");

  if (
    path.isAbsolute(requestedPath) ||
    path.posix.isAbsolute(projectPath) ||
    path.win32.isAbsolute(requestedPath) ||
    path.win32.isAbsolute(projectPath) ||
    WINDOWS_DRIVE_PREFIX_PATTERN.test(requestedPath)
  ) {
    throwUnsafeGeneratedFilePath(
      requestedPath,
      "absolute paths are not allowed"
    );
  }

  const generatedPath = path.posix.normalize(projectPath);

  if (generatedPath === ".") {
    throwUnsafeGeneratedFilePath(
      requestedPath,
      "path must name a file inside the output directory"
    );
  }

  if (generatedPath.split("/").includes("..")) {
    throwUnsafeGeneratedFilePath(
      requestedPath,
      "path contains parent-directory traversal"
    );
  }

  const outputRoot = path.resolve(outputDir);
  const fullPath = path.resolve(outputRoot, toNativePath(generatedPath));

  if (!isStrictlyInsidePath(fullPath, outputRoot)) {
    throwUnsafeGeneratedFilePath(
      requestedPath,
      "path escapes the output directory"
    );
  }

  assertGeneratedPathHasNoSymlinkComponents({
    outputRoot,
    generatedPath,
    requestedPath,
  });

  return { fullPath, generatedPath };
}

function toNativePath(projectPath: string): string {
  return projectPath.split("/").join(path.sep);
}

function assertGeneratedPathHasNoSymlinkComponents(config: {
  readonly outputRoot: string;
  readonly generatedPath: string;
  readonly requestedPath: string;
}): void {
  assertExistingPathIsNotSymlink(config.outputRoot, config.requestedPath);

  let currentPath = config.outputRoot;

  for (const segment of config.generatedPath.split("/")) {
    currentPath = path.join(currentPath, segment);

    const pathStats = getExistingPathStats(currentPath);

    if (pathStats === undefined) {
      return;
    }

    assertPathStatsIsNotSymlink(pathStats, config.requestedPath);

    if (!pathStats.isDirectory()) {
      return;
    }
  }
}

function assertExistingPathIsNotSymlink(
  absolutePath: string,
  requestedPath: string
): void {
  const pathStats = getExistingPathStats(absolutePath);

  if (pathStats === undefined) {
    return;
  }

  assertPathStatsIsNotSymlink(pathStats, requestedPath);
}

function assertPathStatsIsNotSymlink(
  pathStats: fs.Stats,
  requestedPath: string
): void {
  if (!pathStats.isSymbolicLink()) {
    return;
  }

  throwUnsafeGeneratedFilePath(
    requestedPath,
    "path contains a symbolic link"
  );
}

function getExistingPathStats(absolutePath: string): fs.Stats | undefined {
  try {
    return fs.lstatSync(absolutePath);
  } catch (error) {
    if (isMissingPathError(error)) {
      return undefined;
    }

    throw error;
  }
}

function isMissingPathError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  return ["ENOENT", "ENOTDIR"].includes(
    (error as FileSystemError).code ?? ""
  );
}

function isStrictlyInsidePath(childPath: string, parentPath: string): boolean {
  const relativePath = path.relative(parentPath, childPath);

  return (
    relativePath !== "" &&
    relativePath !== ".." &&
    !relativePath.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relativePath)
  );
}

function throwUnsafeGeneratedFilePath(
  requestedPath: string,
  reason: string
): never {
  throw new Error(
    `Unsafe generated file path '${requestedPath}': ${reason}. ` +
      `Generated writes must stay inside the output directory.`
  );
}

function revalidateGeneratedWritePathAfterMkdir(
  outputDir: string,
  generatedPath: string
): SafeGeneratedFilePath {
  // Parent directory creation can expose a symlink inserted in the write path;
  // validate again immediately before writeFile follows the filesystem path.
  return resolveSafeGeneratedFilePath(outputDir, generatedPath);
}

function writeGeneratedFileByReplacingDestination(config: {
  readonly outputDir: string;
  readonly generatedPath: string;
  readonly fullPath: string;
  readonly content: string;
}): SafeGeneratedFilePath {
  const destinationDir = path.dirname(config.fullPath);
  const existingFileMode = getExistingFileMode(config.fullPath);
  const tempDir = fs.mkdtempSync(path.join(destinationDir, ".typeweaver-"));
  const tempFile = path.join(tempDir, "generated.tmp");

  try {
    fs.writeFileSync(tempFile, config.content, {
      flag: "wx",
      mode: existingFileMode ?? 0o666,
    });

    const writablePath = revalidateGeneratedWritePathAfterMkdir(
      config.outputDir,
      config.generatedPath
    );
    fs.renameSync(tempFile, writablePath.fullPath);

    return writablePath;
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

function getExistingFileMode(absolutePath: string): number | undefined {
  const pathStats = getExistingPathStats(absolutePath);

  if (pathStats?.isFile() !== true) {
    return undefined;
  }

  return pathStats.mode & 0o777;
}

export type PluginContextBuilderApi = {
  readonly createPluginContext: (params: {
    outputDir: string;
    inputDir: string;
    config: PluginConfig;
  }) => PluginContext;
  readonly createGeneratorContext: (params: {
    readonly outputDir: string;
    readonly inputDir: string;
    readonly config: PluginConfig;
    readonly normalizedSpec: NormalizedSpec;
    readonly templateDir: string;
    readonly coreDir: string;
    readonly responsesOutputDir: string;
    readonly specOutputDir: string;
  }) => GeneratorContext;
  readonly getGeneratedFiles: () => string[];
  readonly clearGeneratedFiles: () => void;
};

export function createPluginContextBuilder(): PluginContextBuilderApi {
  const generatedFiles = new Set<string>();

  const createPluginContext = (params: {
    outputDir: string;
    inputDir: string;
    config: PluginConfig;
  }): PluginContext => {
    return {
      outputDir: params.outputDir,
      inputDir: params.inputDir,
      config: params.config,
    };
  };

  const createGeneratorContext = (params: {
    readonly outputDir: string;
    readonly inputDir: string;
    readonly config: PluginConfig;
    readonly normalizedSpec: NormalizedSpec;
    readonly templateDir: string;
    readonly coreDir: string;
    readonly responsesOutputDir: string;
    readonly specOutputDir: string;
  }): GeneratorContext => {
    const pluginContext = createPluginContext(params);
    const canonicalResponsesByName = new Map<string, NormalizedResponse>(
      params.normalizedSpec.responses.map(response => [response.name, response])
    );

    const getResourceOutputDir = (resourceName: string): string => {
      return path.join(params.outputDir, resourceName);
    };

    const getOperationOutputPaths = (config: {
      readonly resourceName: string;
      readonly operationId: string;
    }) => {
      const outputDir = getResourceOutputDir(config.resourceName);
      const fileBase = pascalCase(config.operationId);
      const requestFileName = `${fileBase}Request.ts`;
      const responseFileName = `${fileBase}Response.ts`;
      const requestValidationFileName = `${fileBase}RequestValidator.ts`;
      const responseValidationFileName = `${fileBase}ResponseValidator.ts`;
      const clientFileName = `${fileBase}Client.ts`;

      return {
        outputDir,
        requestFile: path.join(outputDir, requestFileName),
        requestFileName,
        responseFile: path.join(outputDir, responseFileName),
        responseFileName,
        requestValidationFile: path.join(outputDir, requestValidationFileName),
        requestValidationFileName,
        responseValidationFile: path.join(
          outputDir,
          responseValidationFileName
        ),
        responseValidationFileName,
        clientFile: path.join(outputDir, clientFileName),
        clientFileName,
      };
    };

    const getCanonicalResponse = (responseName: string): NormalizedResponse => {
      const response = canonicalResponsesByName.get(responseName);

      if (response === undefined) {
        throw new MissingCanonicalResponseError(responseName);
      }

      return response;
    };

    const getCanonicalResponseOutputFile = (responseName: string): string => {
      return path.join(
        params.responsesOutputDir,
        `${pascalCase(responseName)}Response.ts`
      );
    };

    return {
      ...pluginContext,
      normalizedSpec: params.normalizedSpec,
      coreDir: params.coreDir,
      responsesOutputDir: params.responsesOutputDir,
      specOutputDir: params.specOutputDir,
      getCanonicalResponse,
      getCanonicalResponseOutputFile,
      getCanonicalResponseImportPath: config => {
        return relative(
          config.importerDir,
          getCanonicalResponseOutputFile(config.responseName).replace(
            /\.ts$/,
            ".js"
          )
        );
      },
      getSpecImportPath: config => {
        return relative(
          config.importerDir,
          path.join(params.specOutputDir, "spec.js")
        );
      },
      getOperationDefinitionAccessor: config => {
        return (
          `getOperationDefinition(` +
          `spec, ` +
          `${JSON.stringify(config.resourceName)}, ` +
          `${JSON.stringify(config.operationId)}` +
          `)`
        );
      },
      getOperationOutputPaths,
      getResourceOutputDir,

      writeFile: (relativePath: string, content: string) => {
        const safePath = resolveSafeGeneratedFilePath(
          params.outputDir,
          relativePath
        );
        const dir = path.dirname(safePath.fullPath);

        fs.mkdirSync(dir, { recursive: true });
        const writablePath = revalidateGeneratedWritePathAfterMkdir(
          params.outputDir,
          safePath.generatedPath
        );
        const generatedFile = writeGeneratedFileByReplacingDestination({
          outputDir: params.outputDir,
          generatedPath: writablePath.generatedPath,
          fullPath: writablePath.fullPath,
          content,
        });
        generatedFiles.add(generatedFile.generatedPath);

        console.info(`Generated: ${generatedFile.generatedPath}`);
      },

      renderTemplate: (templatePath: string, data: unknown) => {
        const fullTemplatePath = path.isAbsolute(templatePath)
          ? templatePath
          : path.join(params.templateDir, templatePath);

        const template = fs.readFileSync(fullTemplatePath, "utf8");
        return renderTemplate(
          template,
          (data ?? {}) as Record<string, unknown>
        );
      },

      addGeneratedFile: (relativePath: string) => {
        const safePath = resolveSafeGeneratedFilePath(
          params.outputDir,
          relativePath
        );

        generatedFiles.add(safePath.generatedPath);
      },

      getGeneratedFiles: () => {
        return Array.from(generatedFiles);
      },
    };
  };

  return {
    createPluginContext,
    createGeneratorContext,
    getGeneratedFiles: () => Array.from(generatedFiles),
    clearGeneratedFiles: () => generatedFiles.clear(),
  };
}
