import type {
  BaseCheckResult,
  Check,
  CheckContext,
  CheckOutcome,
  ErrorReporter,
  RunSummary,
} from "./types.js";

const BLOCKING_STATUSES = new Set<BaseCheckResult["status"]>(["fail", "skip"]);

const defaultErrorReporter: ErrorReporter = error => ({
  summary: error instanceof Error ? error.message : String(error),
  details: [],
});

export type RunChecksOptions = {
  readonly reportError?: ErrorReporter;
};

export const runChecks = async <
  TState extends object,
  TResult extends BaseCheckResult,
  TContext extends CheckContext<TState>,
>(
  checks: readonly Check<TState, TResult, TContext>[],
  context: TContext,
  options: RunChecksOptions = {}
): Promise<readonly TResult[]> => {
  const reportError = options.reportError ?? defaultErrorReporter;
  const results: TResult[] = [];
  const resultMap = new Map<string, TResult>();

  const recordResult = (checkId: string, result: TResult): void => {
    results.push(result);
    resultMap.set(checkId, result);
  };

  for (const check of checks) {
    // Deps that are not part of this run are treated as passing. This lets
    // callers run a subset of checks (e.g. in isolated unit tests) without
    // replaying the full dependency chain.
    const blockingDependencies = (check.dependsOn ?? [])
      .map(dependencyId => resultMap.get(dependencyId))
      .filter((dependency): dependency is TResult => {
        return (
          dependency !== undefined && BLOCKING_STATUSES.has(dependency.status)
        );
      });

    if (blockingDependencies.length > 0) {
      recordResult(
        check.id,
        buildResult<TState, TResult, TContext>(check, {
          status: "skip",
          summary: `Skipped because ${formatDependencyList(blockingDependencies)} did not pass.`,
          details: [],
        })
      );
      continue;
    }

    try {
      const outcome = await check.run(context);
      mergeState(context, outcome);
      recordResult(check.id, outcome.result);
    } catch (error) {
      const report = reportError(error);
      recordResult(
        check.id,
        buildResult<TState, TResult, TContext>(check, {
          status: "fail",
          summary: report.summary,
          details: report.details,
        })
      );
    }
  }

  return results;
};

export const assertKnownDependencies = <
  TState extends object,
  TResult extends BaseCheckResult,
  TContext extends CheckContext<TState>,
>(
  checks: readonly Check<TState, TResult, TContext>[]
): void => {
  const knownIds = new Set(checks.map(check => check.id));

  for (const check of checks) {
    for (const dependencyId of check.dependsOn ?? []) {
      if (!knownIds.has(dependencyId)) {
        throw new Error(
          `Check '${check.id}' declares unknown dependency '${dependencyId}'.`
        );
      }
    }
  }
};

export const summarizeChecks = (
  results: readonly BaseCheckResult[]
): RunSummary => {
  let passedChecks = 0;
  let warnedChecks = 0;
  let failedChecks = 0;
  let skippedChecks = 0;

  for (const result of results) {
    switch (result.status) {
      case "pass":
        passedChecks += 1;
        break;
      case "warn":
        warnedChecks += 1;
        break;
      case "fail":
        failedChecks += 1;
        break;
      case "skip":
        skippedChecks += 1;
        break;
    }
  }

  return {
    totalChecks: results.length,
    passedChecks,
    warnedChecks,
    failedChecks,
    skippedChecks,
    hasFailures: failedChecks > 0,
  };
};

// The Check type is defined as `Omit<TResult, "status" | "summary" | "details">
// & { dependsOn?, run }`. Stripping `dependsOn` and `run` from a check therefore
// yields exactly the remainder of TResult. TypeScript cannot verify this chain
// through generic inference, so we bridge it with an explicit cast.
const buildResult = <
  TState extends object,
  TResult extends BaseCheckResult,
  TContext extends CheckContext<TState>,
>(
  check: Check<TState, TResult, TContext>,
  outcome: Pick<TResult, "status" | "summary" | "details">
): TResult => {
  const { dependsOn: _dependsOn, run: _run, ...metadata } = check;

  return {
    ...metadata,
    ...outcome,
  } as TResult;
};

const mergeState = <TState extends object, TResult extends BaseCheckResult>(
  context: CheckContext<TState>,
  outcome: CheckOutcome<TState, TResult>
): void => {
  if (!outcome.state) {
    return;
  }

  Object.assign(context.state, outcome.state);
};

const formatDependencyList = (
  dependencies: readonly BaseCheckResult[]
): string => {
  return dependencies.map(dependency => `'${dependency.label}'`).join(", ");
};
