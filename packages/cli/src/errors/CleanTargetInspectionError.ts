import { Data } from "effect";

const formatCause = (cause: unknown): string =>
  cause instanceof Error ? cause.message : String(cause);

/**
 * Raised when the clean-target safety guard cannot inspect a filesystem path.
 * This is distinct from `UnsafeCleanTargetError`: safety is unknown because an
 * expected operating-system failure prevented the guard from reaching a
 * decision.
 */
export class CleanTargetInspectionError extends Data.TaggedError(
  "CleanTargetInspectionError"
)<{
  readonly outputDir: string;
  readonly cause: unknown;
}> {
  public override get message(): string {
    return `Failed to inspect output directory '${this.outputDir}': ${formatCause(this.cause)}`;
  }
}
