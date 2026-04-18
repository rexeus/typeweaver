export type CheckStatus = "pass" | "warn" | "fail" | "skip";

export type CheckIdentity = {
  readonly id: string;
  readonly label: string;
};

export type BaseCheckResult = CheckIdentity & {
  readonly status: CheckStatus;
  readonly summary: string;
  readonly details: readonly string[];
};

export type CheckContext<TState extends object> = {
  readonly state: TState;
};

export type CheckOutcome<
  TState extends object,
  TResult extends BaseCheckResult,
> = {
  readonly result: TResult;
  readonly state?: Partial<TState>;
};

export type Check<
  TState extends object,
  TResult extends BaseCheckResult,
  TContext extends CheckContext<TState> = CheckContext<TState>,
> = Omit<TResult, "status" | "summary" | "details"> & {
  readonly dependsOn?: readonly string[];
  readonly run: (context: TContext) => Promise<CheckOutcome<TState, TResult>>;
};

export type RunSummary = {
  readonly totalChecks: number;
  readonly passedChecks: number;
  readonly warnedChecks: number;
  readonly failedChecks: number;
  readonly skippedChecks: number;
  readonly hasFailures: boolean;
};

export type ErrorReport = {
  readonly summary: string;
  readonly details: readonly string[];
};

export type ErrorReporter = (error: unknown) => ErrorReport;
