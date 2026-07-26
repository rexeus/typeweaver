import path from "node:path";
import type { TypeweaverConfig } from "@rexeus/typeweaver-gen";
import { MissingGenerateOptionError } from "./errors/MissingGenerateOptionError.js";

export type GenerateCommandOptions = {
  readonly input?: string;
  readonly output?: string;
  readonly plugins?: string;
  readonly format?: boolean;
  readonly clean?: boolean;
};

export type ResolvedGenerateOptions = {
  readonly inputPath: string;
  readonly outputDir: string;
  readonly config: TypeweaverConfig;
};

const resolvePath = (value: string, currentWorkingDirectory: string): string =>
  path.isAbsolute(value) ? value : path.join(currentWorkingDirectory, value);

const resolveBooleanOption = (
  optionValue: boolean | undefined,
  configValue: boolean | undefined
): boolean => optionValue ?? configValue ?? true;

export const parsePluginList = (plugins: string): string[] =>
  plugins.split(",").map(plugin => plugin.trim());

export const resolveGenerateOptions = (
  options: GenerateCommandOptions,
  config: Partial<TypeweaverConfig>,
  currentWorkingDirectory: string
): ResolvedGenerateOptions => {
  const inputPath = options.input ?? config.input;
  const outputDir = options.output ?? config.output;

  if (!inputPath) {
    throw new MissingGenerateOptionError({
      optionName: "input",
      flag: "--input",
      configKey: "input",
    });
  }

  if (!outputDir) {
    throw new MissingGenerateOptionError({
      optionName: "output",
      flag: "--output",
      configKey: "output",
    });
  }

  const resolvedInputPath = resolvePath(inputPath, currentWorkingDirectory);
  const resolvedOutputDir = resolvePath(outputDir, currentWorkingDirectory);
  const finalConfig: TypeweaverConfig = {
    ...config,
    input: resolvedInputPath,
    output: resolvedOutputDir,
    format: resolveBooleanOption(options.format, config.format),
    clean: resolveBooleanOption(options.clean, config.clean),
  };

  if (options.plugins) {
    finalConfig.plugins = parsePluginList(options.plugins);
  }

  return {
    inputPath: resolvedInputPath,
    outputDir: resolvedOutputDir,
    config: finalConfig,
  };
};
