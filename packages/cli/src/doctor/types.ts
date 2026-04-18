import type { TypeweaverConfig } from "@rexeus/typeweaver-gen";
import type { Logger } from "../logger.js";
import type {
  BaseCheckResult,
  Check,
  CheckContext,
  CheckOutcome,
  CheckStatus,
  RunSummary,
} from "../pipeline/types.js";

export type DoctorCheckStatus = CheckStatus;

export type DoctorCheckPhase = "standard" | "deep";

export type DoctorState = {
  loadedConfig?: Partial<TypeweaverConfig>;
  inputPath?: string;
  outputPath?: string;
  bundledSpecFile?: string;
};

export type DoctorCheckContext = CheckContext<DoctorState> & {
  readonly logger: Logger;
  readonly execDir: string;
  readonly configPath: string;
  readonly isDeep: boolean;
  readonly temporaryDirectory: string;
};

export type DoctorCheckResult = BaseCheckResult & {
  readonly phase: DoctorCheckPhase;
};

export type DoctorCheckOutcome = CheckOutcome<DoctorState, DoctorCheckResult>;

export type DoctorCheck = Check<
  DoctorState,
  DoctorCheckResult,
  DoctorCheckContext
>;

export type DoctorRunSummary = RunSummary;
