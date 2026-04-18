import fs from "node:fs";
import path from "node:path";
import { relative } from "../helpers/path.js";
import { renderTemplate } from "../helpers/templateEngine.js";
import type { NormalizedResponse, NormalizedSpec } from "../NormalizedSpec.js";
import type { GeneratorContext, PluginConfig, PluginContext } from "./types.js";

export type PluginContextBuilderApi = {
  readonly createPluginContext: (params: {
    pluginName: string;
    outputDir: string;
    inputDir: string;
    config: PluginConfig;
  }) => PluginContext;
  readonly createGeneratorContext: (params: {
    readonly pluginName: string;
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
    pluginName: string;
    outputDir: string;
    inputDir: string;
    config: PluginConfig;
  }): PluginContext => {
    return {
      pluginName: params.pluginName,
      outputDir: params.outputDir,
      inputDir: params.inputDir,
      config: params.config,
    };
  };

  const createGeneratorContext = (params: {
    readonly pluginName: string;
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

    const getPluginOutputDir = (pluginName: string): string => {
      return path.join(params.outputDir, pluginName);
    };

    const getPluginResourceOutputDir = (config: {
      readonly pluginName: string;
      readonly resourceName: string;
    }): string => {
      return path.join(
        getPluginOutputDir(config.pluginName),
        config.resourceName
      );
    };

    const getResourceOutputDir = (resourceName: string): string => {
      return getPluginResourceOutputDir({
        pluginName: params.pluginName,
        resourceName,
      });
    };

    const getOperationOutputPaths = (config: {
      readonly pluginName?: string;
      readonly resourceName: string;
      readonly operationId: string;
    }) => {
      const outputDir = getPluginResourceOutputDir({
        pluginName: config.pluginName ?? params.pluginName,
        resourceName: config.resourceName,
      });
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

    const getOperationImportPaths = (config: {
      readonly importerDir: string;
      readonly pluginName: string;
      readonly resourceName: string;
      readonly operationId: string;
    }) => {
      const outputPaths = getOperationOutputPaths(config);

      return {
        outputDir: outputPaths.outputDir,
        requestFile: relative(
          config.importerDir,
          outputPaths.requestFile.replace(/\.ts$/, ".js")
        ),
        responseFile: relative(
          config.importerDir,
          outputPaths.responseFile.replace(/\.ts$/, ".js")
        ),
        requestValidationFile: relative(
          config.importerDir,
          outputPaths.requestValidationFile.replace(/\.ts$/, ".js")
        ),
        responseValidationFile: relative(
          config.importerDir,
          outputPaths.responseValidationFile.replace(/\.ts$/, ".js")
        ),
        clientFile: relative(
          config.importerDir,
          outputPaths.clientFile.replace(/\.ts$/, ".js")
        ),
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
      coreDir: params.coreDir,
      responsesOutputDir: params.responsesOutputDir,
      specOutputDir: params.specOutputDir,
      getPluginOutputDir,
      getPluginResourceOutputDir,
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
      getOperationImportPaths,
      getLibImportPath: config => {
        const entry = config.entry ?? "index.js";
        const entryFile = path.extname(entry) === "" ? `${entry}.js` : entry;

        return relative(
          config.importerDir,
          path.join(params.outputDir, "lib", config.pluginName, entryFile)
        );
      },

      writeFile: (relativePath: string, content: string) => {
        const fullPath = path.join(params.outputDir, relativePath);
        const dir = path.dirname(fullPath);

        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(fullPath, content);
        generatedFiles.add(relativePath);
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
