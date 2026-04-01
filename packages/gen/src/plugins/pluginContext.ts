import fs from "node:fs";
import path from "node:path";
import { relative } from "../helpers/path";
import { renderTemplate } from "../helpers/templateEngine";
import type { NormalizedResponse, NormalizedSpec } from "../NormalizedSpec";
import type { GeneratorContext, PluginConfig, PluginContext } from "./types";

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
      const requestFileName = `${config.operationId}Request.ts`;
      const responseFileName = `${config.operationId}Response.ts`;
      const requestValidationFileName = `${config.operationId}RequestValidator.ts`;
      const responseValidationFileName = `${config.operationId}ResponseValidator.ts`;
      const clientFileName = `${config.operationId}Client.ts`;

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
        throw new Error(`Missing canonical response '${responseName}'.`);
      }

      return response;
    };

    const getCanonicalResponseOutputFile = (responseName: string): string => {
      return path.join(params.responsesOutputDir, `${responseName}Response.ts`);
    };

    return {
      ...pluginContext,
      normalizedSpec: params.normalizedSpec,
      templateDir: params.templateDir,
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
            ""
          )
        );
      },
      getSpecImportPath: config => {
        return relative(
          config.importerDir,
          path.join(params.specOutputDir, "spec").replace(/\.ts$/, "")
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
        const fullPath = path.join(params.outputDir, relativePath);
        const dir = path.dirname(fullPath);

        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(fullPath, content);
        generatedFiles.add(relativePath);

        console.info(`Generated: ${relativePath}`);
      },

      renderTemplate: (templatePath: string, data: unknown) => {
        const fullTemplatePath = path.isAbsolute(templatePath)
          ? templatePath
          : path.join(params.templateDir, templatePath);

        const template = fs.readFileSync(fullTemplatePath, "utf8");
        return renderTemplate(template, (data ?? {}) as Record<string, unknown>);
      },

      addGeneratedFile: (relativePath: string) => {
        generatedFiles.add(relativePath);
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
