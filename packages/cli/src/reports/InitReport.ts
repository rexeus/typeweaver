import { z } from "zod";

export const InitDiagnosticSchema = z
  .object({
    code: z.string().regex(/^TW-INIT-\d{3}$/u),
    message: z.string().min(1),
    hint: z.string().min(1).optional(),
  })
  .strict();

export const InitReportSchema = z
  .object({
    version: z.literal(1),
    command: z.literal("init"),
    success: z.boolean(),
    status: z.enum(["planned", "created", "failed"]),
    dryRun: z.boolean(),
    targetDir: z.string().min(1),
    configFile: z.string().min(1),
    files: z.array(z.string().min(1)),
    overwrittenFiles: z.array(z.string().min(1)),
    preservedFiles: z.array(z.string().min(1)),
    nextSteps: z.array(z.string().min(1)),
    diagnostics: z.array(InitDiagnosticSchema),
  })
  .strict();

export type InitDiagnostic = z.infer<typeof InitDiagnosticSchema>;
export type InitReport = z.infer<typeof InitReportSchema>;

export const createInitReport = (candidate: InitReport): InitReport =>
  InitReportSchema.parse(candidate);

export const renderInitReport = (report: InitReport): string => {
  if (!report.success) {
    const lines = report.diagnostics.flatMap(diagnostic => [
      `[ERROR] ${diagnostic.code}: ${diagnostic.message}`,
      ...(diagnostic.hint === undefined ? [] : [`  Hint: ${diagnostic.hint}`]),
    ]);
    return `${lines.join("\n")}\n`;
  }

  const summary =
    report.status === "planned"
      ? `Init dry run planned ${report.files.length} file(s) for ${report.targetDir}.`
      : `Created TypeWeaver project at ${report.targetDir} with ${report.files.length} file(s).`;
  const details = [
    summary,
    ...(report.overwrittenFiles.length === 0
      ? []
      : [`Overwritten: ${report.overwrittenFiles.join(", ")}`]),
    ...(report.preservedFiles.length === 0
      ? []
      : [`Preserved: ${report.preservedFiles.join(", ")}`]),
    ...report.nextSteps.map(step => `Next: ${step}`),
  ];
  return `${details.join("\n")}\n`;
};
