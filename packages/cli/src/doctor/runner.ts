import { formatDiagnostic } from "../diagnosticFormatter.js";
import type {
  DoctorCheck,
  DoctorCheckContext,
  DoctorCheckOutcome,
  DoctorCheckResult,
  DoctorRunSummary,
} from "./types.js";

export const runDoctorChecks = async (
  checks: readonly DoctorCheck[],
  context: DoctorCheckContext
): Promise<readonly DoctorCheckResult[]> => {
  const results: DoctorCheckResult[] = [];
  const resultMap = new Map<string, DoctorCheckResult>();

  for (const check of checks) {
    const blockingDependencies = (check.dependsOn ?? [])
      .map(dependencyId => resultMap.get(dependencyId))
      .filter((dependency): dependency is DoctorCheckResult => {
        return (
          dependency !== undefined &&
          (dependency.status === "fail" || dependency.status === "skip")
        );
      });

    if (blockingDependencies.length > 0) {
      const skippedResult: DoctorCheckResult = {
        id: check.id,
        label: check.label,
        phase: check.phase,
        status: "skip",
        summary: `Skipped because ${formatDependencyList(blockingDependencies)} did not pass.`,
        details: [],
      };

      results.push(skippedResult);
      resultMap.set(check.id, skippedResult);
      continue;
    }

    try {
      const outcome = await check.run(context);
      mergeState(context, outcome);
      results.push(outcome.result);
      resultMap.set(check.id, outcome.result);
    } catch (error) {
      const diagnostic = formatDiagnostic(error);
      const failedResult: DoctorCheckResult = {
        id: check.id,
        label: check.label,
        phase: check.phase,
        status: "fail",
        summary: diagnostic.summary,
        details: [...diagnostic.contextLines, ...(diagnostic.hint ? [diagnostic.hint] : [])],
      };

      results.push(failedResult);
      resultMap.set(check.id, failedResult);
    }
  }

  return results;
};

export const summarizeDoctorChecks = (
  results: readonly DoctorCheckResult[]
): DoctorRunSummary => {
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

const mergeState = (
  context: DoctorCheckContext,
  outcome: DoctorCheckOutcome
): void => {
  if (!outcome.state) {
    return;
  }

  Object.assign(context.state, outcome.state);
};

const formatDependencyList = (
  dependencies: readonly DoctorCheckResult[]
): string => {
  if (dependencies.length === 1) {
    const [dependency] = dependencies;

    if (!dependency) {
      return "a prerequisite check";
    }

    return `'${dependency.label}'`;
  }

  return dependencies
    .map(dependency => `'${dependency.label}'`)
    .join(", ");
};
