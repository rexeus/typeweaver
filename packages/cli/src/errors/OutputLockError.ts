import { Data } from "effect";

export type OutputLockOperation = "acquire" | "release";

const formatCause = (cause: unknown): string =>
  cause instanceof Error ? cause.message : String(cause);

/**
 * Raised when an expected operating-system failure prevents output-lock I/O.
 * Lock contention remains a separate `ConcurrentGenerationError`.
 */
export class OutputLockError extends Data.TaggedError("OutputLockError")<{
  readonly outputDir: string;
  readonly lockPath: string;
  readonly operation: OutputLockOperation;
  readonly cause: unknown;
}> {
  public override get message(): string {
    return `Failed to ${this.operation} output lock at '${this.lockPath}': ${formatCause(this.cause)}`;
  }
}
