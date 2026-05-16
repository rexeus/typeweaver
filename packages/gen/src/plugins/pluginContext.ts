import fs from "node:fs";
import path from "node:path";
import { pascalCase } from "polycase";
import { relative } from "../helpers/path.js";
import { resolveSafeGeneratedFilePath } from "../helpers/pathSafety.js";
import type { SafeGeneratedFilePath } from "../helpers/pathSafety.js";
import { renderTemplate } from "../helpers/templateEngine.js";
import { MissingCanonicalResponseError } from "./errors/MissingCanonicalResponseError.js";
import type { NormalizedResponse, NormalizedSpec } from "../NormalizedSpec.js";
import type { GeneratorContext, PluginConfig, PluginContext } from "./types.js";

const revalidateGeneratedWritePath = (
  outputDir: string,
  generatedPath: string
): SafeGeneratedFilePath =>
  resolveSafeGeneratedFilePath(outputDir, generatedPath);

function writeGeneratedFileByReplacingDestination(config: {
  readonly outputDir: string;
  readonly generatedPath: string;
  readonly content: string;
}): SafeGeneratedFilePath {
  const existingPath = revalidateGeneratedWritePath(
    config.outputDir,
    config.generatedPath
  );
  const existingFileMode = getExistingFileMode(existingPath.fullPath);
  const tempParentPath = revalidateGeneratedWritePath(
    config.outputDir,
    config.generatedPath
  );
  const destinationDir = path.dirname(tempParentPath.fullPath);
  const tempDir = fs.mkdtempSync(path.join(destinationDir, ".typeweaver-"));
  const tempFile = path.join(tempDir, "generated.tmp");

  try {
    revalidateGeneratedWritePath(config.outputDir, config.generatedPath);
    fs.writeFileSync(tempFile, config.content, {
      flag: "wx",
      mode: existingFileMode ?? 0o666,
    });

    if (existingFileMode !== undefined) {
      fs.chmodSync(tempFile, existingFileMode);
    }

    const writablePath = revalidateGeneratedWritePath(
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
  let pathStats: fs.Stats;
  try {
    pathStats = fs.lstatSync(absolutePath);
  } catch (error) {
    if (
      error instanceof Error &&
      ["ENOENT", "ENOTDIR"].includes(
        (error as Error & { code?: string }).code ?? ""
      )
    ) {
      return undefined;
    }
    throw error;
  }

  if (!pathStats.isFile()) {
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
        throw new MissingCanonicalResponseError({ responseName });
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
        const writablePath = revalidateGeneratedWritePath(
          params.outputDir,
          safePath.generatedPath
        );
        const generatedFile = writeGeneratedFileByReplacingDestination({
          outputDir: params.outputDir,
          generatedPath: writablePath.generatedPath,
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
        return Array.from(generatedFiles).sort();
      },
    };
  };

  return {
    createPluginContext,
    createGeneratorContext,
    getGeneratedFiles: () => Array.from(generatedFiles).sort(),
    clearGeneratedFiles: () => generatedFiles.clear(),
  };
}
