import { Data } from "effect";

export type LegacyOutputLockReason =
  | "held"
  | "malformed"
  | "ownership-uncertain";

const formatCause = (cause: unknown): string =>
  cause instanceof Error ? cause.message : String(cause);

/**
 * Raised when an in-output `.typeweaver-lock` left by an older CLI version
 * blocks generation or checking before any clean runs.
 *
 * The current CLI coordinates through an out-of-band lock and cannot write the
 * legacy lock, so full bidirectional compatibility with an older process is
 * impossible. A provably live holder or malformed/ownership-uncertain metadata
 * fails closed and requires manual removal after confirming no older process is
 * running; only complete metadata owned by a dead process is treated as stale.
 * Mixed CLI versions must not run generation concurrently.
 */
export class LegacyOutputLockError extends Data.TaggedError(
  "LegacyOutputLockError"
)<{
  readonly outputDir: string;
  readonly lockPath: string;
  readonly reason: LegacyOutputLockReason;
  readonly holderPid?: number;
  readonly holderStartedAt?: string;
  readonly cause?: unknown;
}> {
  public override get message(): string {
    const holderDescription =
      this.holderPid === undefined
        ? "the owner is unknown"
        : `PID ${String(this.holderPid)} started at ${String(this.holderStartedAt)}`;
    const detail =
      this.reason === "held"
        ? `an older typeweaver process still holds it (${holderDescription})`
        : this.reason === "malformed"
          ? "its ownership metadata is malformed"
          : `it could not be inspected: ${formatCause(this.cause)}`;
    const remediation =
      this.reason === "held"
        ? "Wait for that process to finish, or confirm it is no longer running and remove the lock directory manually."
        : "Confirm no older typeweaver process is running, then remove the lock directory manually.";
    return `A legacy in-output lock was found at '${this.lockPath}' for '${this.outputDir}', and ${detail}. ${remediation} Mixed CLI versions must not run generation concurrently.`;
  }
}
