import { Data } from "effect";
import { outputLockDirectory } from "../services/internal/outputCoordinationArtifact.js";

export type OutputLockHolder =
  | {
      readonly _tag: "Known";
      readonly pid: number;
      readonly startedAt: string;
    }
  | {
      readonly _tag: "Unknown";
    };

const resolveLockPath = (
  outputDir: string,
  lockPath: string | undefined
): string | undefined => {
  if (lockPath !== undefined) {
    return lockPath;
  }
  try {
    return outputLockDirectory(outputDir);
  } catch {
    return undefined;
  }
};

/**
 * Surfaced when `Generator.generate` attempts to acquire the per-output
 * lock and finds that another process may already hold it.
 *
 * The lock is a deterministic directory under a fixed host-temp coordination
 * tree keyed by the physical output path, so no lock artifact is ever written
 * into configured output. The acquire path treats a `mkdir` `EEXIST` as
 * contention. Complete ownership metadata is used to distinguish a live holder
 * from a crashed run. Missing or malformed metadata is treated as active
 * acquisition rather than reclaimed, because exclusive generation is safer
 * than guessing that an incompletely published lock is stale.
 */
export class ConcurrentGenerationError extends Data.TaggedError(
  "ConcurrentGenerationError"
)<{
  readonly outputDir: string;
  readonly holder: OutputLockHolder;
  readonly lockPath?: string;
}> {
  public get holderPid(): number | undefined {
    return this.holder._tag === "Known" ? this.holder.pid : undefined;
  }

  public get holderStartedAt(): string | undefined {
    return this.holder._tag === "Known" ? this.holder.startedAt : undefined;
  }

  public override get message(): string {
    const holderDescription =
      this.holder._tag === "Known"
        ? `PID ${this.holder.pid}, started at ${this.holder.startedAt}`
        : "ownership metadata is not available yet";
    const lockPath = resolveLockPath(this.outputDir, this.lockPath);
    const lockHint =
      lockPath === undefined
        ? ""
        : ` Wait for it to finish or remove the stale lock at '${lockPath}' if you are sure the prior run crashed.`;

    return (
      `Another typeweaver generate is running against '${this.outputDir}' ` +
      `(${holderDescription}).${lockHint}`
    );
  }
}
