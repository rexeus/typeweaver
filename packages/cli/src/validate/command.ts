// oxlint-disable import/max-dependencies -- command coordinates the validate subsystem
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { TypeweaverConfig, ValidateConfig } from "@rexeus/typeweaver-gen";
import { createCommandLogger, resolveCommandPath } from "../commands/shared.js";
import { getResolvedConfigPath, loadConfig } from "../configLoader.js";
import {
  reportErrorFromDiagnostic,
  writeDiagnostic,
} from "../diagnosticFormatter.js";
import { runChecks } from "../pipeline/runner.js";
import { createValidateChecks } from "./checks/index.js";
import {
  buildValidationReport,
  reportFinalSummary,
  reportValidationJson,
  reportValidationText,
} from "./reporter.js";
import { createRuleResolver, resolveValidateOptions } from "./rules.js";
import { createValidationRun } from "./run.js";
import type { SharedCommandOptions } from "../commands/shared.js";
import type { Logger } from "../logger.js";
import type {
  IssueSeverity,
  ValidateCheckContext,
  ValidateCheckResult,
  ValidateState,
  ValidationReport,
} from "./types.js";

const SEVERITY_VALUES: readonly IssueSeverity[] = ["info", "warning", "error"];

export type ValidateCommandOptions = SharedCommandOptions & {
  readonly input?: string;
  readonly output?: string;
  readonly config?: string;
  readonly strict?: boolean;
  readonly failOn?: string;
  readonly disable?: string;
  readonly enable?: string;
  readonly plugins?: boolean;
  readonly json?: boolean;
};

export type ValidateCommandContext = {
  readonly execDir?: string;
  readonly createLogger?: (options: ValidateCommandOptions) => Logger;
  readonly stdout?: Pick<NodeJS.WriteStream, "write">;
};

type ResolvedValidateConfig = {
  readonly inputPath: string;
  readonly loadedConfig: Partial<TypeweaverConfig>;
  readonly validateConfig: ValidateConfig;
  readonly pluginsEnabled: boolean;
};

export const handleValidateCommand = async (
  options: ValidateCommandOptions,
  context: ValidateCommandContext = {}
): Promise<ValidationReport | undefined> => {
  const execDir = context.execDir ?? process.cwd();
  const stdout = context.stdout ?? process.stdout;
  const useJson = options.json ?? false;

  // JSON mode must not pollute stdout with progress logging.
  const loggerOptions: ValidateCommandOptions = useJson
    ? { ...options, quiet: true }
    : options;
  const logger = (context.createLogger ?? createCommandLogger)(loggerOptions);

  const temporaryDirectory = fs.mkdtempSync(
    path.join(os.tmpdir(), "typeweaver-validate-")
  );

  try {
    const resolved = await resolveValidateConfig(options, execDir, logger);

    const ruleResolver = createRuleResolver(
      resolveValidateOptions(
        {
          strict: options.strict,
          failOn: parseSeverity(options.failOn),
          disable: splitCodes(options.disable),
          enable: splitCodes(options.enable),
          plugins: options.plugins,
        },
        resolved.validateConfig
      )
    );

    const { state, context: checkContext } = createValidationRun({
      initialState: {
        loadedConfig: resolved.loadedConfig,
        inputPath: resolved.inputPath,
      },
      logger,
      execDir,
      temporaryDirectory,
      ruleResolver,
      pluginsEnabled: resolved.pluginsEnabled,
    });

    if (!useJson) {
      logger.step(`Validating spec '${resolved.inputPath}'...`);
    }

    const checks = createValidateChecks({
      plugins: resolved.pluginsEnabled,
    });

    const checkResults = await runChecks<
      ValidateState,
      ValidateCheckResult,
      ValidateCheckContext
    >(checks, checkContext, { reportError: reportErrorFromDiagnostic });

    const report = buildValidationReport(
      state,
      checkResults,
      ruleResolver,
      resolved.validateConfig
    );

    if (useJson) {
      reportValidationJson(stdout, report);
    } else {
      reportValidationText(logger, report);
      reportFinalSummary(logger, report);
    }

    if (report.hasErrors) {
      process.exitCode = 1;
    }

    return report;
  } catch (error) {
    writeDiagnostic(logger, error);
    process.exitCode = 1;
    return undefined;
  } finally {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  }
};

const resolveValidateConfig = async (
  options: ValidateCommandOptions,
  execDir: string,
  logger: Logger
): Promise<ResolvedValidateConfig> => {
  let loadedConfig: Partial<TypeweaverConfig> = {};

  if (options.config) {
    const configPath = getResolvedConfigPath(options.config, execDir);
    loadedConfig = await loadConfig(configPath);
    logger.info(`Loaded configuration from ${configPath}`);
  }

  const inputPath = options.input ?? loadedConfig.input;

  if (!inputPath) {
    throw new Error(
      "No input spec entrypoint provided. Use --input or specify it in a config file."
    );
  }

  const validateConfig: ValidateConfig = loadedConfig.validate ?? {};
  const configPluginsEnabled = validateConfig.plugins ?? true;
  // CLI `--plugins` (boolean via `--no-plugins`) overrides config.
  const pluginsEnabled =
    options.plugins === undefined ? configPluginsEnabled : options.plugins;

  return {
    inputPath: resolveCommandPath(execDir, inputPath),
    loadedConfig,
    validateConfig,
    pluginsEnabled,
  };
};

const splitCodes = (raw: string | undefined): readonly string[] => {
  if (!raw) {
    return [];
  }

  return raw
    .split(",")
    .map(code => code.trim())
    .filter(code => code.length > 0);
};

const isIssueSeverity = (value: string): value is IssueSeverity =>
  (SEVERITY_VALUES as readonly string[]).includes(value);

const parseSeverity = (raw: string | undefined): IssueSeverity | undefined => {
  if (!raw) {
    return undefined;
  }

  const normalized = raw.trim().toLowerCase();
  if (!isIssueSeverity(normalized)) {
    throw new Error(
      `Invalid --fail-on value '${raw}'. Expected one of: ${SEVERITY_VALUES.join(", ")}.`
    );
  }

  return normalized;
};
