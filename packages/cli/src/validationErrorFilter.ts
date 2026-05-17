import { ValidationError } from "@effect/cli";
import { Cause, Chunk } from "effect";

/**
 * Returns `true` when every failure and every defect carried by `cause`
 * is a `@effect/cli` `ValidationError`. Such causes are already pretty-
 * printed by the framework (help requests, missing flags, etc.); the CLI's
 * `tapErrorCause` uses this predicate to suppress the custom formatter and
 * avoid double-printing.
 *
 * Empty causes (no failures and no defects) return `false` — there is
 * nothing to suppress, and `formatErrorForCli` will fall back to
 * `Cause.pretty`.
 */
export const isOnlyValidationErrorCause = (
  cause: Cause.Cause<unknown>
): boolean => {
  const failures = Chunk.toReadonlyArray(Cause.failures(cause));
  const defects = Chunk.toReadonlyArray(Cause.defects(cause));

  if (failures.length + defects.length === 0) {
    return false;
  }

  return (
    failures.every(failure => ValidationError.isValidationError(failure)) &&
    defects.every(defect => ValidationError.isValidationError(defect))
  );
};
