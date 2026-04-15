import type { TypeweaverConfig } from "@rexeus/typeweaver-gen";
import type { Logger } from "../logger.js";

export type DoctorCheckStatus = "pass" | "warn" | "fail" | "skip";

export type DoctorCheckPhase = "standard" | "deep";

export type DoctorState = {
  loadedConfig?: Partial<TypeweaverConfig>;
  inputPath?: string;
  outputPath?: string;
  bundledSpecFile?: string;
};

export type DoctorCheckContext = {
  readonly execDir: string;
  readonly configPath: string;
  readonly isDeep: boolean;
  readonly logger: Logger;
  readonly temporaryDirectory: string;
  readonly state: DoctorState;
};

export type DoctorCheckResult = {
  readonly id: string;
  readonly label: string;
  readonly phase: DoctorCheckPhase;
  readonly status: DoctorCheckStatus;
  readonly summary: string;
  readonly details: readonly string[];
};

export type DoctorCheckOutcome = {
  readonly result: DoctorCheckResult;
  readonly state?: Partial<DoctorState>;
};

export type DoctorCheck = {
  readonly id: string;
  readonly label: string;
  readonly phase: DoctorCheckPhase;
  readonly dependsOn?: readonly string[];
  readonly run: (context: DoctorCheckContext) => Promise<DoctorCheckOutcome>;
};

export type DoctorRunSummary = {
  readonly totalChecks: number;
  readonly passedChecks: number;
  readonly warnedChecks: number;
  readonly failedChecks: number;
  readonly skippedChecks: number;
  readonly hasFailures: boolean;
};
