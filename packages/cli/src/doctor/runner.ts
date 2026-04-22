import { reportErrorFromDiagnostic } from "../diagnosticFormatter.js";
import { runChecks, summarizeChecks } from "../pipeline/runner.js";
import type {
  DoctorCheck,
  DoctorCheckContext,
  DoctorCheckResult,
  DoctorRunSummary,
} from "./types.js";

export const runDoctorChecks = (
  checks: readonly DoctorCheck[],
  context: DoctorCheckContext
): Promise<readonly DoctorCheckResult[]> => {
  return runChecks<typeof context.state, DoctorCheckResult, DoctorCheckContext>(
    checks,
    context,
    { reportError: reportErrorFromDiagnostic }
  );
};

export const summarizeDoctorChecks = (
  results: readonly DoctorCheckResult[]
): DoctorRunSummary => {
  return summarizeChecks(results);
};
