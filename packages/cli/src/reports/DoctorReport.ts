import { z } from "zod";

export const DoctorOutcomeSchema = z.enum(["pass", "warn", "fail", "skip"]);

export const DoctorCheckSchema = z
  .object({
    code: z.string().regex(/^TW-DOCTOR-\d{3}$/u),
    name: z.string().min(1),
    outcome: DoctorOutcomeSchema,
    message: z.string().min(1),
    hint: z.string().min(1).optional(),
  })
  .strict();

export const DoctorReportSchema = z
  .object({
    version: z.literal(1),
    command: z.literal("doctor"),
    healthy: z.boolean(),
    summary: z
      .object({
        pass: z.number().int().nonnegative(),
        warn: z.number().int().nonnegative(),
        fail: z.number().int().nonnegative(),
        skip: z.number().int().nonnegative(),
        total: z.number().int().nonnegative(),
      })
      .strict(),
    checks: z.array(DoctorCheckSchema),
  })
  .strict();

export type DoctorOutcome = z.infer<typeof DoctorOutcomeSchema>;
export type DoctorCheck = z.infer<typeof DoctorCheckSchema>;
export type DoctorReport = z.infer<typeof DoctorReportSchema>;

export const createDoctorCheck = (candidate: DoctorCheck): DoctorCheck =>
  DoctorCheckSchema.parse(candidate);

export const createDoctorReport = (
  checks: readonly DoctorCheck[]
): DoctorReport => {
  const summary = {
    pass: checks.filter(check => check.outcome === "pass").length,
    warn: checks.filter(check => check.outcome === "warn").length,
    fail: checks.filter(check => check.outcome === "fail").length,
    skip: checks.filter(check => check.outcome === "skip").length,
    total: checks.length,
  };
  return DoctorReportSchema.parse({
    version: 1,
    command: "doctor",
    healthy: summary.fail === 0,
    summary,
    checks,
  });
};

export const renderDoctorReport = (report: DoctorReport): string => {
  const lines = report.checks.map(
    check =>
      `[${check.outcome.toUpperCase()}] ${check.code} ${check.name}: ${check.message}${check.hint === undefined ? "" : `\n  Hint: ${check.hint}`}`
  );
  lines.push(
    `Doctor ${report.healthy ? "passed" : "failed"}: ${report.summary.pass} passed, ${report.summary.warn} warning(s), ${report.summary.fail} failed, ${report.summary.skip} skipped.`
  );
  return `${lines.join("\n")}\n`;
};
