export type GenerateSummary = {
  readonly mode: "generate";
  readonly dryRun: boolean;
  readonly targetOutputDir: string;
  readonly resourceCount: number;
  readonly operationCount: number;
  readonly responseCount: number;
  readonly pluginCount: number;
  readonly generatedFiles: readonly string[];
  readonly warnings: readonly string[];
};

export type InitSummary = {
  readonly mode: "init";
  readonly targetOutputDir: string;
  readonly targetConfigPath: string;
  readonly resourceCount: number;
  readonly operationCount: number;
  readonly responseCount: number;
  readonly pluginCount: number;
  readonly generatedFiles: readonly string[];
};

export type MigrateSummary = {
  readonly mode: "migrate";
  readonly detectedVersion: string;
  readonly advisoryCount: number;
};

export type DoctorSummary = {
  readonly mode: "doctor";
  readonly targetConfigPath: string;
  readonly totalChecks: number;
  readonly passedChecks: number;
  readonly warnedChecks: number;
  readonly failedChecks: number;
  readonly skippedChecks: number;
};

export type GenerationSummary =
  | GenerateSummary
  | InitSummary
  | MigrateSummary
  | DoctorSummary;
