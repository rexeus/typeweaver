import { Data } from "effect";

export type OutputLockHolder =
  | {
      readonly _tag: "Known";
      readonly pid: number;
      readonly startedAt: string;
    }
  | {
      readonly _tag: "Unknown";
    };

/**
 * Surfaced when `Generator.generate` attempts to acquire the per-output
 * lock and finds that another process may already hold it.
 *
 * The lock takes the form of a `.typeweaver-lock/` directory inside the
 * output directory. The acquire path treats a `mkdir` `EEXIST` as
 * contention. Complete ownership metadata is used to distinguish a live
 * holder from a crashed run. Missing or malformed metadata is treated as
 * active acquisition rather than reclaimed, because exclusive generation
 * is safer than guessing that an incompletely published lock is stale.
 */
export class ConcurrentGenerationError extends Data.TaggedError(
  "ConcurrentGenerationError"
)<{
  readonly outputDir: string;
  readonly holder: OutputLockHolder;
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

    return (
      `Another typeweaver generate is running against '${this.outputDir}' ` +
      `(${holderDescription}). ` +
      `Wait for it to finish or remove the stale lock at ` +
      `'${this.outputDir}/.typeweaver-lock' if you are sure the prior run crashed.`
    );
  }
}
