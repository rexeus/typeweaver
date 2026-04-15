import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { TypeweaverConfig } from "@rexeus/typeweaver-gen";
import { getResolvedConfigPath, loadConfig } from "../configLoader.js";
import { writeDiagnostic } from "../diagnosticFormatter.js";
import type { GenerationSummary } from "../generationResult.js";
import type { Logger } from "../logger.js";
import { loadSpec } from "../generators/specLoader.js";
import type { NormalizedSpec } from "@rexeus/typeweaver-gen";
import {
  createCommandLogger,
  resolveCommandPath,
  type SharedCommandOptions,
} from "./shared.js";

export type ValidateCommandOptions = SharedCommandOptions & {
  readonly input?: string;
  readonly config?: string;
};

export type ValidateCommandContext = {
  readonly execDir?: string;
  readonly createLogger?: (options: ValidateCommandOptions) => Logger;
};

export const handleValidateCommand = async (
  options: ValidateCommandOptions,
  context: ValidateCommandContext = {}
): Promise<GenerationSummary | void> => {
  const execDir = context.execDir ?? process.cwd();
  const logger = (context.createLogger ?? createCommandLogger)(options);
  const temporaryDirectory = fs.mkdtempSync(
    path.join(os.tmpdir(), "typeweaver-validate-")
  );

  try {
    const config = await resolveValidateConfig(options, execDir, logger);
    logger.step(`Validating spec '${config.input}'...`);

    const { normalizedSpec } = await loadSpec({
      inputFile: config.input,
      specOutputDir: path.join(temporaryDirectory, "spec"),
    });

    const summary = createValidationSummary(normalizedSpec);
    logger.success("Validation complete!");
    logger.summary(summary);

    return summary;
  } catch (error) {
    writeDiagnostic(logger, error);
    process.exitCode = 1;
  } finally {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  }
};

const resolveValidateConfig = async (
  options: ValidateCommandOptions,
  execDir: string,
  logger: Logger
): Promise<Pick<TypeweaverConfig, "input">> => {
  let config: Partial<TypeweaverConfig> = {};

  if (options.config) {
    const configPath = getResolvedConfigPath(options.config, execDir);
    config = await loadConfig(configPath);
    logger.info(`Loaded configuration from ${configPath}`);
  }

  const inputPath = options.input ?? config.input;

  if (!inputPath) {
    throw new Error(
      "No input spec entrypoint provided. Use --input or specify it in a config file."
    );
  }

  return {
    input: resolveCommandPath(execDir, inputPath),
  };
};

const createValidationSummary = (
  normalizedSpec: NormalizedSpec
): GenerationSummary => {
  const operationCount = normalizedSpec.resources.reduce(
    (count, resource) => count + resource.operations.length,
    0
  );

  return {
    mode: "validate",
    dryRun: false,
    resourceCount: normalizedSpec.resources.length,
    operationCount,
    responseCount: normalizedSpec.responses.length,
    pluginCount: 0,
    generatedFiles: [],
    warnings: [],
  };
};
