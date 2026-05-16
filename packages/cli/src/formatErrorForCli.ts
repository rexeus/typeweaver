import { Cause, Chunk } from "effect";

/**
 * Render any failure produced by the typeweaver runtime as a stable,
 * user-facing string. Tagged errors (`Data.TaggedError`) expose a `message`
 * getter that already contains the human-readable reason — use it. For
 * unknown defects, fall back to standard `Error` formatting. Multi-line
 * causes (e.g. `UnsafeCleanTargetError`) are preserved as-is.
 */
export const formatErrorForCli = (error: unknown): string => {
  if (Cause.isCause(error)) {
    return formatCause(error);
  }
  if (isTaggedError(error)) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
};

const isTaggedError = (
  value: unknown
): value is { readonly _tag: string; readonly message: string } =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as { _tag?: unknown })._tag === "string" &&
  typeof (value as { message?: unknown }).message === "string";

const formatCause = (cause: Cause.Cause<unknown>): string => {
  const failures = Chunk.toReadonlyArray(Cause.failures(cause));
  if (failures.length > 0) {
    return failures.map(failure => formatErrorForCli(failure)).join("\n");
  }

  const defects = Chunk.toReadonlyArray(Cause.defects(cause));
  if (defects.length > 0) {
    return defects.map(defect => formatErrorForCli(defect)).join("\n");
  }

  return Cause.pretty(cause);
};
