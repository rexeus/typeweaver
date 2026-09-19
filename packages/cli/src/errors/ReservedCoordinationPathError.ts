import { Data } from "effect";

export type ReservedCoordinationPathReason =
  | "reserved-name"
  | "untrusted-authority"
  | "inspection-failed";

const formatCause = (cause: unknown): string =>
  cause instanceof Error ? cause.message : String(cause);

/**
 * Raised when a configured output or project source path equals the trusted
 * host temp root or overlaps the flat coordination namespace reserved directly
 * beneath it (lock directories, fences, and staging directories). Such a path
 * could be renamed, staged over, or deleted by coordination cleanup, so it is
 * rejected before any lock or stage is created. Ordinary project outputs
 * elsewhere under the temp root (for example `<temp>/project/generated`) are
 * not reserved.
 */
export class ReservedCoordinationPathError extends Data.TaggedError(
  "ReservedCoordinationPathError"
)<{
  readonly path: string;
  readonly tempRoot: string;
  readonly reason: ReservedCoordinationPathReason;
  readonly conflictingName?: string;
  readonly cause?: unknown;
}> {
  public override get message(): string {
    if (this.reason === "inspection-failed") {
      return `Failed to inspect path '${this.path}' against coordination root '${this.tempRoot}': ${formatCause(this.cause)}`;
    }
    if (this.reason === "untrusted-authority") {
      return `Refusing to generate into '${this.path}' because the staging authority is not valid. Only the CLI check pipeline may stage output under '${this.tempRoot}'.`;
    }
    const detail =
      this.conflictingName === undefined
        ? "it overlaps the reserved coordination namespace"
        : `it reserves the coordination name '${this.conflictingName}'`;
    return `Refusing to use '${this.path}' because ${detail} under '${this.tempRoot}'. Choose an output or project directory outside the coordination namespace.`;
  }
}
