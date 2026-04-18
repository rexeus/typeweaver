import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { runChecks } from "../pipeline/runner.js";
import { createValidateChecks } from "./checks/index.js";
import { buildValidationReport, reportValidationText } from "./reporter.js";
import { createRuleResolver, resolveValidateOptions } from "./rules.js";
import { createValidationRun } from "./run.js";
import type { Logger } from "../logger.js";
import type {
  ValidateCheckContext,
  ValidateCheckResult,
  ValidateState,
  ValidationReport,
} from "./types.js";

export type PreflightOptions = {
  readonly inputPath: string;
  readonly execDir: string;
  readonly logger: Logger;
};

/**
 * Runs the core validation check pipeline as a pre-flight for `generate`.
 * This guards destructive steps (cleaning output, writing files) behind a
 * structural sanity check of the spec, producing the same rule-coded issues
 * the user sees from `typeweaver validate`.
 */
export const runPreflightValidation = async (
  options: PreflightOptions
): Promise<ValidationReport> => {
  const temporaryDirectory = fs.mkdtempSync(
    path.join(os.tmpdir(), "typeweaver-preflight-")
  );

  try {
    const ruleResolver = createRuleResolver(resolveValidateOptions(undefined));
    const { state, context } = createValidationRun({
      initialState: { inputPath: options.inputPath },
      logger: options.logger,
      execDir: options.execDir,
      temporaryDirectory,
      ruleResolver,
      pluginsEnabled: false,
    });

    const checkResults = await runChecks<
      ValidateState,
      ValidateCheckResult,
      ValidateCheckContext
    >(createValidateChecks({ plugins: false, style: false }), context);

    const report = buildValidationReport(state, checkResults, ruleResolver);

    if (report.hasErrors) {
      reportValidationText(options.logger, report);
    }

    return report;
  } finally {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  }
};
