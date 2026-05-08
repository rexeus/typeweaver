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

export const resolveGenerateOptions = (
  options: GenerateCommandOptions,
  config: Partial<TypeweaverConfig>,
  currentWorkingDirectory: string
): ResolvedGenerateOptions => {
  const inputPath = options.input ?? config.input;
  const outputDir = options.output ?? config.output;

  if (!inputPath) {
    throw new MissingGenerateOptionError("input", "--input", "input");
  }

  if (!outputDir) {
    throw new MissingGenerateOptionError("output", "--output", "output");
  }

  const resolvedInputPath = path.isAbsolute(inputPath)
    ? inputPath
    : path.join(currentWorkingDirectory, inputPath);
  const resolvedOutputDir = path.isAbsolute(outputDir)
    ? outputDir
    : path.join(currentWorkingDirectory, outputDir);
  const finalConfig: TypeweaverConfig = {
    input: resolvedInputPath,
    output: resolvedOutputDir,
    format: options.format ?? config.format ?? true,
    clean: options.clean ?? config.clean ?? true,
  };

  if (options.plugins) {
    finalConfig.plugins = options.plugins
      .split(",")
      .map(plugin => plugin.trim());
  } else if (config.plugins) {
    finalConfig.plugins = config.plugins;
  }

  return {
    inputPath: resolvedInputPath,
    outputDir: resolvedOutputDir,
    config: finalConfig,
  };
};
