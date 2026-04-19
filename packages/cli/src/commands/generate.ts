import type { TypeweaverConfig } from "@rexeus/typeweaver-gen";
import { getResolvedConfigPath, loadConfig } from "../configLoader.js";
import { writeDiagnostic } from "../diagnosticFormatter.js";
import { FileWatcher } from "../generators/fileWatcher.js";
import { Generator } from "../generators/generator.js";
import { runPreflightValidation } from "../validate/preflight.js";
import {
  createCommandLogger,
  resolveCommandPath,
  resolvePluginList,
} from "./shared.js";
import type { GenerateSummary } from "../generationResult.js";
import type { GeneratorConfig } from "../generators/generator.js";
import type { Logger } from "../logger.js";
import type { PreflightOptions, ValidationReport } from "../validate/index.js";
import type { SharedCommandOptions } from "./shared.js";

type ResolvedGenerateConfig = {
  readonly engineConfig: GeneratorConfig;
  readonly summaryOutputDir: string;
};

export type GenerateCommandOptions = SharedCommandOptions & {
  readonly input?: string;
  readonly output?: string;
  readonly config?: string;
  readonly plugins?: string;
  readonly format?: boolean;
  readonly clean?: boolean;
  readonly watch?: boolean;
  readonly dryRun?: boolean;
};

export type GenerateCommandResult =
  | { readonly kind: "watch" }
  | { readonly kind: "once"; readonly summary: GenerateSummary };

export type GenerateCommandContext = {
  readonly execDir?: string;
  readonly createLogger?: (options: SharedCommandOptions) => Logger;
  readonly createGenerator?: (logger: Logger) => Generator;
  readonly createWatcher?: (
    inputPath: string,
    outputDir: string,
    config: TypeweaverConfig,
    logger: Logger
  ) => FileWatcher;
  readonly runPreflight?: (
    options: PreflightOptions
  ) => Promise<ValidationReport>;
};

export const handleGenerateCommand = async (
  options: GenerateCommandOptions,
  context: GenerateCommandContext = {}
): Promise<GenerateCommandResult | undefined> => {
  const execDir = context.execDir ?? process.cwd();
  const logger = (context.createLogger ?? createCommandLogger)(options);

  try {
    validateGenerateOptions(options);

    const { engineConfig, summaryOutputDir } = await resolveGenerateConfig(
      options,
      execDir,
      logger
    );

    const preflight = context.runPreflight ?? runPreflightValidation;
    const preflightReport = await preflight({
      inputPath: engineConfig.input,
      execDir,
      logger,
    });

    if (preflightReport.hasErrors) {
      logger.error(
        "Spec validation failed. Fix the issues above or run 'typeweaver validate' for details."
      );
      process.exitCode = 1;
      return undefined;
    }

    if (options.watch) {
      return await runWatchMode({
        engineConfig,
        logger,
        createWatcher: context.createWatcher ?? defaultCreateWatcher,
      });
    }

    return await runOnceMode({
      engineConfig,
      summaryOutputDir,
      execDir,
      logger,
      createGenerator: context.createGenerator ?? defaultCreateGenerator,
    });
  } catch (error) {
    writeDiagnostic(logger, error);
    process.exitCode = 1;
    return undefined;
  }
};

type RunOnceParams = {
  readonly engineConfig: GeneratorConfig;
  readonly summaryOutputDir: string;
  readonly execDir: string;
  readonly logger: Logger;
  readonly createGenerator: (logger: Logger) => Generator;
};

const runOnceMode = async (
  params: RunOnceParams
): Promise<GenerateCommandResult> => {
  const generator = params.createGenerator(params.logger);
  const summary = await generator.generate(
    params.engineConfig.input,
    params.engineConfig.output,
    params.engineConfig,
    params.execDir
  );

  const commandSummary: GenerateSummary = {
    ...summary,
    targetOutputDir: params.summaryOutputDir,
  };

  params.logger.summary(commandSummary);
  return { kind: "once", summary: commandSummary };
};

type RunWatchParams = {
  readonly engineConfig: GeneratorConfig;
  readonly logger: Logger;
  readonly createWatcher: (
    inputPath: string,
    outputDir: string,
    config: TypeweaverConfig,
    logger: Logger
  ) => FileWatcher;
};

const runWatchMode = async (
  params: RunWatchParams
): Promise<GenerateCommandResult> => {
  const watcher = params.createWatcher(
    params.engineConfig.input,
    params.engineConfig.output,
    params.engineConfig,
    params.logger
  );

  await watcher.watch();
  return { kind: "watch" };
};

const resolveGenerateConfig = async (
  options: GenerateCommandOptions,
  execDir: string,
  logger: Logger
): Promise<ResolvedGenerateConfig> => {
  let config: Partial<TypeweaverConfig> = {};

  if (options.config) {
    const configPath = getResolvedConfigPath(options.config, execDir);
    config = await loadConfig(configPath);
    logger.info(`Loaded configuration from ${configPath}`);
  }

  const inputPath = options.input ?? config.input;
  const outputDir = options.output ?? config.output;

  if (!inputPath) {
    throw new Error(
      "No input spec entrypoint provided. Use --input or specify it in a config file."
    );
  }

  if (!outputDir) {
    throw new Error(
      "No output directory provided. Use --output or specify it in a config file."
    );
  }

  return {
    engineConfig: {
      input: resolveCommandPath(execDir, inputPath),
      output: resolveCommandPath(execDir, outputDir),
      format: options.format ?? config.format ?? true,
      clean: options.clean ?? config.clean ?? true,
      dryRun: options.dryRun ?? false,
      plugins: resolvePlugins(options.plugins, config.plugins),
    },
    summaryOutputDir: outputDir,
  };
};

const resolvePlugins = (
  plugins: string | undefined,
  configPlugins: TypeweaverConfig["plugins"]
): TypeweaverConfig["plugins"] => {
  const resolvedPlugins = resolvePluginList(plugins);

  if (resolvedPlugins) {
    return resolvedPlugins;
  }

  return configPlugins;
};

const validateGenerateOptions = (options: GenerateCommandOptions): void => {
  if (options.watch && options.dryRun) {
    throw new Error(
      "Cannot combine --dry-run with --watch. Dry-run is a one-time preview mode; rerun without --dry-run to watch and regenerate files."
    );
  }
};

const defaultCreateGenerator = (logger: Logger): Generator => {
  return new Generator({ logger });
};

const defaultCreateWatcher = (
  inputPath: string,
  outputDir: string,
  config: TypeweaverConfig,
  logger: Logger
): FileWatcher => {
  return new FileWatcher(inputPath, outputDir, config, undefined, logger);
};
