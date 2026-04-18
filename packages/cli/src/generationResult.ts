export type GenerationSummary = {
  readonly mode: "generate" | "init" | "migrate" | "doctor";
  readonly dryRun: boolean;
  readonly targetOutputDir?: string;
  readonly targetConfigPath?: string;
  readonly detectedVersion?: string;
  readonly advisoryCount?: number;
  readonly totalChecks?: number;
  readonly passedChecks?: number;
  readonly warnedChecks?: number;
  readonly failedChecks?: number;
  readonly skippedChecks?: number;
  readonly resourceCount: number;
  readonly operationCount: number;
  readonly responseCount: number;
  readonly pluginCount: number;
  readonly generatedFiles: readonly string[];
  readonly warnings: readonly string[];
};
