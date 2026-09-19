import { Data } from "effect";

export type UnsafeSharedTempDirectoryReason =
  | "not-created"
  | "not-directory"
  | "untrusted"
  | "unwritable";

const formatCause = (cause: unknown): string =>
  cause instanceof Error ? cause.message : String(cause);

/**
 * Raised when the host temp directory used for output locks and staging is
 * missing, is not a directory, or fails the platform trust policy. On POSIX it
 * must be a root-owned sticky, world-writable directory so one CLI user cannot
 * rename another user's locks or stages. Windows relies on the fixed system
 * temp directory ACL, which is only checked for writability. Generation fails
 * closed rather than coordinating through an untrusted location.
 */
export class UnsafeSharedTempDirectoryError extends Data.TaggedError(
  "UnsafeSharedTempDirectoryError"
)<{
  readonly directory: string;
  readonly reason: UnsafeSharedTempDirectoryReason;
  readonly cause?: unknown;
}> {
  public override get message(): string {
    const suffix =
      this.reason === "not-created"
        ? `it is missing or inaccessible: ${formatCause(this.cause)}`
        : this.reason === "not-directory"
          ? "it exists but is not a directory"
          : this.reason === "untrusted"
            ? "it is not a root-owned sticky, world-writable directory"
            : `it is not writable: ${formatCause(this.cause)}`;
    return `Refusing to coordinate through host temp directory '${this.directory}' because ${suffix}.`;
  }
}
