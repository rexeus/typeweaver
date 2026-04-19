import { reportCheckSection } from "../pipeline/reporting.js";
import { applyIssueRules } from "./rules.js";
import type { Logger } from "../logger.js";
import type { RuleResolver } from "./rules.js";
import type {
  Issue,
  IssueSeverity,
  ValidateCheckResult,
  ValidateConfig,
  ValidateState,
  ValidationReport,
  ValidationStats,
} from "./types.js";

export const REPORT_SCHEMA_VERSION = "1";

const SEVERITY_LABEL: Record<IssueSeverity, string> = {
  error: "error",
  warning: "warning",
  info: "info",
};

// ---------- Building the report ----------

export const computeValidationStats = (
  state: ValidateState,
  filteredIssues: readonly Issue[]
): ValidationStats => {
  const spec = state.spec;

  return {
    errors: filteredIssues.filter(issue => issue.severity === "error").length,
    warnings: filteredIssues.filter(issue => issue.severity === "warning")
      .length,
    infos: filteredIssues.filter(issue => issue.severity === "info").length,
    resources: spec?.resources.length ?? 0,
    operations:
      spec?.resources.reduce(
        (count, resource) => count + resource.operations.length,
        0
      ) ?? 0,
    responses: spec?.responses.length ?? 0,
  };
};

export const buildValidationReport = (
  state: ValidateState,
  checks: readonly ValidateCheckResult[],
  ruleResolver: RuleResolver,
  validateConfig: ValidateConfig = {}
): ValidationReport => {
  const issues = applyIssueRules(state.collectedIssues, ruleResolver);
  const stats = computeValidationStats(state, issues);
  const failOn: IssueSeverity = validateConfig.failOn ?? "error";
  const hasErrors = issues.some(issue =>
    ruleResolver.isFailing(issue.severity)
  );

  return {
    checks,
    issues,
    stats,
    hasErrors,
    failOn,
  };
};

// ---------- Rendering the report ----------

export const reportValidationText = (
  logger: Logger,
  report: ValidationReport
): void => {
  reportCheckSection(logger, "Checks", report.checks);
  reportIssues(logger, report.issues);
};

export const reportValidationJson = (
  stdout: Pick<NodeJS.WriteStream, "write">,
  report: ValidationReport
): void => {
  const payload = {
    version: REPORT_SCHEMA_VERSION,
    hasErrors: report.hasErrors,
    failOn: report.failOn,
    stats: report.stats,
    issues: report.issues,
    checks: report.checks,
  };

  stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
};

export const reportFinalSummary = (
  logger: Logger,
  report: ValidationReport
): void => {
  const { stats } = report;
  const verdict = report.hasErrors ? "failed" : "passed";

  logger.step(
    `Validation ${verdict}: ${stats.errors} error(s), ${stats.warnings} warning(s), ${stats.infos} info(s) across ${stats.resources} resource(s), ${stats.operations} operation(s), ${stats.responses} response(s).`
  );
};

const reportIssues = (logger: Logger, issues: readonly Issue[]): void => {
  if (issues.length === 0) {
    return;
  }

  logger.step(`Issues (${issues.length})`);

  for (const issue of issues) {
    const prefix = `[${issue.code}] ${SEVERITY_LABEL[issue.severity]}`;
    const location = issue.path ? ` ${issue.path}` : "";
    const line = `${prefix}${location}: ${issue.message}`;

    switch (issue.severity) {
      case "error":
        logger.error(line);
        break;
      case "warning":
        logger.warn(line);
        break;
      case "info":
        logger.info(line);
        break;
    }

    if (issue.hint) {
      logger.info(`  hint: ${issue.hint}`);
    }
  }
};
