import path from "node:path";
import type {
  GeneratorContext,
  NormalizedSpec,
  PluginConfig,
  PluginContext,
  PluginContextBuilderApi,
  PluginRegistryApi,
} from "@rexeus/typeweaver-gen";
import { formatCode } from "./formatter.js";
import { generateIndexFiles } from "./indexFileGenerator.js";
import type { Logger } from "../logger.js";

export const initializeRegisteredPlugins = async (config: {
  readonly registry: PluginRegistryApi;
  readonly pluginContext: PluginContext;
}): Promise<void> => {
  for (const registration of config.registry.getAll()) {
    if (registration.plugin.initialize) {
      await registration.plugin.initialize({
        ...config.pluginContext,
        pluginName: registration.plugin.name,
      });
    }
  }
};

export const collectRegisteredResources = async (config: {
  readonly registry: PluginRegistryApi;
  readonly normalizedSpec: NormalizedSpec;
}): Promise<NormalizedSpec> => {
  let normalizedSpec = config.normalizedSpec;

  for (const registration of config.registry.getAll()) {
    if (registration.plugin.collectResources) {
      normalizedSpec =
        await registration.plugin.collectResources(normalizedSpec);
    }
  }

  return normalizedSpec;
};

export const generateRegisteredFiles = async (config: {
  readonly registry: PluginRegistryApi;
  readonly createGeneratorContext: (pluginName: string) => GeneratorContext;
  readonly templateDir: string;
  readonly indexGeneratorContext: GeneratorContext;
  readonly logger: Logger;
}): Promise<void> => {
  for (const registration of config.registry.getAll()) {
    config.logger.info(`Running plugin: ${registration.plugin.name}`);
    if (registration.plugin.generate) {
      await registration.plugin.generate(
        config.createGeneratorContext(registration.plugin.name)
      );
    }
  }

  generateIndexFiles(config.templateDir, config.indexGeneratorContext);
};

export const finalizeRegisteredPlugins = async (config: {
  readonly registry: PluginRegistryApi;
  readonly pluginContext: PluginContext;
}): Promise<void> => {
  for (const registration of config.registry.getAll()) {
    if (registration.plugin.finalize) {
      await registration.plugin.finalize({
        ...config.pluginContext,
        pluginName: registration.plugin.name,
      });
    }
  }
};

export const formatGeneratedOutput = async (config: {
  readonly generationOutputDir: string;
  readonly shouldFormat: boolean;
}): Promise<readonly string[]> => {
  if (!config.shouldFormat) {
    return [];
  }

  return formatCode(config.generationOutputDir);
};

export const createGeneratorContextFactory = (config: {
  readonly contextBuilder: PluginContextBuilderApi;
  readonly generationOutputDir: string;
  readonly inputFile: string;
  readonly generationConfig: PluginConfig;
  readonly normalizedSpec: NormalizedSpec;
  readonly templateDir: string;
  readonly coreDir: string;
  readonly responsesOutputDir: string;
  readonly specOutputDir: string;
}): ((pluginName: string) => GeneratorContext) => {
  return (pluginName: string): GeneratorContext => {
    return config.contextBuilder.createGeneratorContext({
      pluginName,
      outputDir: config.generationOutputDir,
      inputDir: path.dirname(config.inputFile),
      config: config.generationConfig,
      normalizedSpec: config.normalizedSpec,
      templateDir: config.templateDir,
      coreDir: config.coreDir,
      responsesOutputDir: config.responsesOutputDir,
      specOutputDir: config.specOutputDir,
    });
  };
};
