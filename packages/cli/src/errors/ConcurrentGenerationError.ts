import { Data } from "effect";

/**
 * Surfaced when `Generator.generate` attempts to acquire the per-output
 * lock and finds another live `typeweaver` process already holds it.
 *
 * The lock takes the form of a `.typeweaver-lock/` directory inside the
 * output directory. The acquire path treats a `mkdir` `EEXIST` as
 * contention, reads the `info.json` left by the previous run, and probes
 * the recorded PID via `process.kill(pid, 0)`. A dead PID indicates a
 * crashed run and the stale lock is reclaimed; a live PID raises this
 * error so the operator can intervene rather than have two generations
 * race destructively on the same target.
 */
export class ConcurrentGenerationError extends Data.TaggedError(
  "ConcurrentGenerationError"
)<{
  readonly outputDir: string;
  readonly holderPid: number;
  readonly holderStartedAt: string;
}> {
  public override get message(): string {
    return (
      `Another typeweaver generate is running against '${this.outputDir}' ` +
      `(PID ${this.holderPid}, started at ${this.holderStartedAt}). ` +
      `Wait for it to finish or remove the stale lock at ` +
      `'${this.outputDir}/.typeweaver-lock' if you are sure the prior run crashed.`
    );
  }
}
