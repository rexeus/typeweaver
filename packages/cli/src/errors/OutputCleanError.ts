import { Data } from "effect";

const formatCause = (cause: unknown): string =>
  cause instanceof Error ? cause.message : String(cause);

/**
 * Raised when the destructive clean step cannot remove an entry inside the
 * output directory (e.g. `EACCES`/`EPERM` on a read-only file, or a file
 * held open on Windows). Carries the underlying filesystem error on
 * `cause` so the operator sees the precise OS-level reason.
 */
export class OutputCleanError extends Data.TaggedError("OutputCleanError")<{
  readonly outputDir: string;
  readonly cause: unknown;
}> {
  public override get message(): string {
    return `Failed to clean output directory '${this.outputDir}': ${formatCause(this.cause)}`;
  }
}
