import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { GenerationSummary } from "../generationResult.js";
import type { Logger } from "../logger.js";
import { TYPEWEAVER_CONFIG_FILE } from "../templates/typeweaverConfigTemplate.js";
import { createDoctorChecks } from "../doctor/checks.js";
import { reportDoctorChecks } from "../doctor/reporter.js";
import { runDoctorChecks, summarizeDoctorChecks } from "../doctor/runner.js";
import {
  createCommandLogger,
  type SharedCommandOptions,
} from "./shared.js";

export type DoctorCommandOptions = SharedCommandOptions & {
  readonly config?: string;
  readonly deep?: boolean;
};

export type DoctorCommandContext = {
  readonly execDir?: string;
  readonly createLogger?: (options: DoctorCommandOptions) => Logger;
};

export const handleDoctorCommand = async (
  options: DoctorCommandOptions,
  context: DoctorCommandContext = {}
): Promise<GenerationSummary> => {
  const execDir = context.execDir ?? process.cwd();
  const logger = (context.createLogger ?? createCommandLogger)(options);
  const configPath = path.resolve(execDir, options.config ?? TYPEWEAVER_CONFIG_FILE);
  const temporaryDirectory = fs.mkdtempSync(
    path.join(os.tmpdir(), "typeweaver-doctor-")
  );

  try {
    logger.step("Running Typeweaver doctor...");

    const results = await runDoctorChecks(createDoctorChecks(options.deep ?? false), {
      execDir,
      configPath,
      isDeep: options.deep ?? false,
      logger,
      temporaryDirectory,
      state: {},
    });
    reportDoctorChecks(logger, results);

    const summary = summarizeDoctorChecks(results);
    const generationSummary: GenerationSummary = {
      mode: "doctor",
      dryRun: false,
      targetConfigPath: configPath,
      totalChecks: summary.totalChecks,
      passedChecks: summary.passedChecks,
      warnedChecks: summary.warnedChecks,
      failedChecks: summary.failedChecks,
      skippedChecks: summary.skippedChecks,
      resourceCount: 0,
      operationCount: 0,
      responseCount: 0,
      pluginCount: 0,
      generatedFiles: [],
      warnings: [],
    };

    logger.summary(generationSummary);

    if (summary.hasFailures) {
      process.exitCode = 1;
    }

    return generationSummary;
  } finally {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  }
};
