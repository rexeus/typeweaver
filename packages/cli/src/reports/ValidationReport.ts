import type { Issue, Severity } from "@rexeus/typeweaver-gen";
import { z } from "zod";

export const SeveritySchema = z.enum(["error", "warning", "info"]);

export const ValidationIssueSchema = z
  .object({
    code: z.string().regex(/^TW-[A-Z0-9-]+$/u),
    severity: SeveritySchema,
    message: z.string().min(1),
    path: z.string(),
    source: z
      .object({
        file: z.string().min(1),
        line: z.number().int().positive().optional(),
        column: z.number().int().positive().optional(),
      })
      .strict()
      .optional(),
    hint: z.string().min(1).optional(),
    fixable: z.boolean(),
  })
  .strict();

export const ValidationReportSchema = z
  .object({
    version: z.literal(1),
    command: z.literal("validate"),
    valid: z.boolean(),
    threshold: SeveritySchema,
    summary: z
      .object({
        error: z.number().int().nonnegative(),
        warning: z.number().int().nonnegative(),
        info: z.number().int().nonnegative(),
        total: z.number().int().nonnegative(),
      })
      .strict(),
    issues: z.array(ValidationIssueSchema),
  })
  .strict();

export type ValidationReport = z.infer<typeof ValidationReportSchema>;

const SEVERITY_RANK: Readonly<Record<Severity, number>> = {
  error: 3,
  warning: 2,
  info: 1,
};

const shouldFail = (issues: readonly Issue[], threshold: Severity): boolean =>
  issues.some(
    issue => SEVERITY_RANK[issue.severity] >= SEVERITY_RANK[threshold]
  );

export const createValidationReport = (
  issues: readonly Issue[],
  threshold: Severity
): ValidationReport => {
  const summary = {
    error: issues.filter(issue => issue.severity === "error").length,
    warning: issues.filter(issue => issue.severity === "warning").length,
    info: issues.filter(issue => issue.severity === "info").length,
    total: issues.length,
  };
  return ValidationReportSchema.parse({
    version: 1,
    command: "validate",
    valid: !shouldFail(issues, threshold),
    threshold,
    summary,
    issues,
  });
};

export const renderValidationReport = (report: ValidationReport): string => {
  if (report.issues.length === 0) {
    return "Validation passed with 0 issues.\n";
  }

  const lines = report.issues.flatMap(issue => [
    `[${issue.severity.toUpperCase()}] ${issue.code} ${issue.path}: ${issue.message}`,
    ...(issue.hint === undefined ? [] : [`  Hint: ${issue.hint}`]),
  ]);
  lines.push(
    `Validation ${report.valid ? "passed" : "failed"}: ${report.summary.error} error(s), ${report.summary.warning} warning(s), ${report.summary.info} info issue(s).`
  );
  return `${lines.join("\n")}\n`;
};
