import type {
  Issue,
  IssueSeverity,
  NormalizedSpec,
  TypeweaverConfig,
  ValidateConfig,
} from "@rexeus/typeweaver-gen";
import type { Logger } from "../logger.js";
import type {
  BaseCheckResult,
  Check,
  CheckContext,
  CheckOutcome,
} from "../pipeline/types.js";
import type { RuleResolver } from "./rules.js";

export type { Issue, IssueSeverity, ValidateConfig };

export type ValidateCheckResult = BaseCheckResult;

export type ValidateState = {
  loadedConfig?: Partial<TypeweaverConfig>;
  spec?: NormalizedSpec;
  inputPath?: string;
  readonly collectedIssues: Issue[];
};

export type ValidateCheckContext = CheckContext<ValidateState> & {
  readonly logger: Logger;
  readonly execDir: string;
  readonly temporaryDirectory: string;
  readonly ruleResolver: RuleResolver;
  readonly pluginsEnabled: boolean;
  readonly emitIssue: (issue: Issue) => void;
};

export type ValidateCheckOutcome = CheckOutcome<
  ValidateState,
  ValidateCheckResult
>;

export type ValidateCheck = Check<
  ValidateState,
  ValidateCheckResult,
  ValidateCheckContext
>;

export type ValidationStats = {
  readonly errors: number;
  readonly warnings: number;
  readonly infos: number;
  readonly resources: number;
  readonly operations: number;
  readonly responses: number;
};

export type ValidationReport = {
  readonly checks: readonly ValidateCheckResult[];
  readonly issues: readonly Issue[];
  readonly stats: ValidationStats;
  readonly hasErrors: boolean;
  readonly failOn: IssueSeverity;
};
