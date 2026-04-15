import type { TypeweaverConfig } from "@rexeus/typeweaver-gen";
import { writeDiagnostic } from "../diagnosticFormatter.js";
import type { GenerationSummary } from "../generationResult.js";
import type { Logger } from "../logger.js";
import { getResolvedConfigPath, loadConfig } from "../configLoader.js";
import { FileWatcher } from "../generators/fileWatcher.js";
import { Generator } from "../generators/generator.js";
import type { GeneratorConfig } from "../generators/generator.js";
import {
  createCommandLogger,
  resolveCommandPath,
  resolvePluginList,
  type SharedCommandOptions,
} from "./shared.js";

type ResolvedGenerateConfig = GeneratorConfig & {
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
};

export const handleGenerateCommand = async (
  options: GenerateCommandOptions,
  context: GenerateCommandContext = {}
): Promise<GenerationSummary | void> => {
  const execDir = context.execDir ?? process.cwd();
  const logger = (context.createLogger ?? createCommandLogger)(options);

  try {
    if (options.watch && options.dryRun) {
      throw new Error(
        "Cannot combine --dry-run with --watch. Dry-run is a one-time preview mode; rerun without --dry-run to watch and regenerate files."
      );
    }

    const config = await resolveGenerateConfig(options, execDir, logger);

    if (options.watch) {
      const watcher = (context.createWatcher ?? defaultCreateWatcher)(
        config.input,
        config.output,
        config,
        logger
      );

      await watcher.watch();
      return;
    }

    const generator = (context.createGenerator ?? defaultCreateGenerator)(logger);
    const summary = await generator.generate(
      config.input,
      config.output,
      config,
      execDir
    );

    const commandSummary: GenerationSummary = {
      ...summary,
      targetOutputDir: config.summaryOutputDir,
    };

    logger.summary(commandSummary);
    return commandSummary;
  } catch (error) {
    writeDiagnostic(logger, error);
    process.exitCode = 1;
  }
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
    input: resolveCommandPath(execDir, inputPath),
    output: resolveCommandPath(execDir, outputDir),
    summaryOutputDir: outputDir,
    format: options.format ?? config.format ?? true,
    clean: options.clean ?? config.clean ?? true,
    dryRun: options.dryRun ?? false,
    plugins: resolvePlugins(options.plugins, config.plugins),
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

const defaultCreateGenerator = (logger: Logger): Generator => {
  return new Generator(undefined, undefined, logger);
};

const defaultCreateWatcher = (
  inputPath: string,
  outputDir: string,
  config: TypeweaverConfig,
  logger: Logger
): FileWatcher => {
  return new FileWatcher(inputPath, outputDir, config, undefined, logger);
};
