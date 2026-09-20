import { Cause } from "effect";
import { CliError } from "effect/unstable/cli";

const causeDefects = (cause: Cause.Cause<unknown>): ReadonlyArray<unknown> =>
  cause.reasons.filter(Cause.isDieReason).map(reason => reason.defect);
const causeFailures = (cause: Cause.Cause<unknown>): ReadonlyArray<unknown> =>
  cause.reasons.filter(Cause.isFailReason).map(reason => reason.error);

/**
 * Returns `true` when every failure and every defect carried by `cause`
 * is an `effect/unstable/cli` `CliError`. Such causes are already pretty-
 * printed by the framework (help requests, missing flags, etc.); the CLI's
 * `tapCause` uses this predicate to suppress the custom formatter and
 * avoid double-printing.
 *
 * Empty causes (no failures and no defects) return `false` — there is
 * nothing to suppress, and `formatErrorForCli` will fall back to
 * `Cause.pretty`.
 */
export const isOnlyValidationErrorCause = (
  cause: Cause.Cause<unknown>
): boolean => {
  const failures = causeFailures(cause);
  const defects = causeDefects(cause);

  if (failures.length + defects.length === 0) {
    return false;
  }

  if (Cause.hasInterrupts(cause)) {
    return false;
  }

  return (
    failures.every(failure => CliError.isCliError(failure)) &&
    defects.every(defect => CliError.isCliError(defect))
  );
};
