import { Data } from "effect";

export type UnsafeStagingRootReason = "not-disjoint" | "inspection-failed";

const formatCause = (cause: unknown): string =>
  cause instanceof Error ? cause.message : String(cause);

/**
 * Raised before a staging directory is created when the staging root overlaps
 * the configured output, the project source, or the spec input directory.
 * Generating into an overlapping stage could mutate the very tree a
 * read-only check promises to leave untouched, so the operation fails closed.
 */
export class UnsafeStagingRootError extends Data.TaggedError(
  "UnsafeStagingRootError"
)<{
  readonly stagingRoot: string;
  readonly reason: UnsafeStagingRootReason;
  readonly conflictingPath?: string;
  readonly cause?: unknown;
}> {
  public override get message(): string {
    if (this.reason === "inspection-failed") {
      return `Failed to inspect staging root '${this.stagingRoot}': ${formatCause(this.cause)}`;
    }
    return `Refusing to stage generated output because staging root '${this.stagingRoot}' overlaps '${String(this.conflictingPath)}'. Choose a temporary directory outside the project and its configured output.`;
  }
}
