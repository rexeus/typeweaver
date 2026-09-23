import fs from "node:fs";
import { Effect } from "effect";
import { OutputLockError } from "../../errors/index.js";
import { isExpectedNodeSystemError } from "./nodeFsErrors.js";
import { readOutputLockInfo } from "./outputLockInfo.js";
import { lockFencePath, sameLockInfo } from "./outputLockOperations.js";
import {
  forgetFailedOutputLockRelease,
  rememberFailedOutputLockRelease,
} from "./outputLockState.js";
import type { OutputLock } from "./outputLockOperations.js";

type OutputLockDetachStatus =
  | { readonly _tag: "Detached"; readonly fencePath: string }
  | { readonly _tag: "AlreadyAbsent" }
  | { readonly _tag: "OwnershipChanged" };

type OutputLockReleaseStatus =
  | { readonly _tag: "Released" }
  | { readonly _tag: "AlreadyAbsent" }
  | { readonly _tag: "OwnershipChanged" }
  | {
      readonly _tag: "FenceCleanupFailed";
      readonly fencePath: string;
      readonly cause: Error;
    };

const detachOutputLock = (lock: OutputLock): OutputLockDetachStatus => {
  if (fs.lstatSync(lock.path, { throwIfNoEntry: false }) === undefined) {
    return { _tag: "AlreadyAbsent" };
  }
  const holder = readOutputLockInfo(lock.path);
  if (holder?.ownerToken !== lock.ownerToken) {
    return { _tag: "OwnershipChanged" };
  }
  const fencePath = lockFencePath(lock.path, holder);
  fs.renameSync(lock.path, fencePath);
  const fenced = readOutputLockInfo(fencePath);
  if (fenced !== undefined && sameLockInfo(fenced, holder)) {
    return { _tag: "Detached", fencePath };
  }
  // A replacement raced with the detach. Restore it when the canonical lock
  // name is still free and never remove a fence whose ownership is uncertain.
  if (!fs.existsSync(lock.path)) fs.renameSync(fencePath, lock.path);
  return { _tag: "OwnershipChanged" };
};

const removeDetachedOutputLock = (
  fencePath: string
): OutputLockReleaseStatus => {
  try {
    // The fence is a flat sibling of the lock directly under the trusted temp
    // root, so removing it fully releases the deterministic coordination name.
    fs.rmSync(fencePath, { recursive: true, force: true });
    return { _tag: "Released" };
  } catch (cause) {
    if (isExpectedNodeSystemError(cause)) {
      return { _tag: "FenceCleanupFailed", fencePath, cause };
    }
    throw cause;
  }
};

const releaseOutputLockSync = (lock: OutputLock): OutputLockReleaseStatus => {
  const detached = detachOutputLock(lock);
  return detached._tag === "Detached"
    ? removeDetachedOutputLock(detached.fencePath)
    : detached;
};

const logOutputLockReleaseStatus = (
  lock: OutputLock,
  status: OutputLockReleaseStatus
): Effect.Effect<void> => {
  switch (status._tag) {
    case "OwnershipChanged":
      return Effect.logWarning(
        `Skipped release of output lock at '${lock.path}' because its ownership changed.`
      );
    case "FenceCleanupFailed":
      return Effect.logWarning(
        `Detached output lock at '${lock.path}', but failed to remove fence '${status.fencePath}': ${status.cause.message}`
      );
    case "AlreadyAbsent":
    case "Released":
      return Effect.void;
  }
};

/**
 * Release the lock created by `acquireOutputLock`. Idempotent — a missing
 * lock directory (e.g. removed by a clean step run during the lifetime of
 * the lock) is a no-op rather than a failure.
 *
 * Release first atomically detaches the canonical directory into its
 * token-bound fence, then removes that fence best-effort. A cleanup failure
 * cannot leave the live PID blocking the canonical lock path; detach failures
 * remain typed `OutputLockError`s so the finalizer can remember the exact
 * abandoned token for a later retry.
 */
export const releaseOutputLockStrict = (
  lock: OutputLock
): Effect.Effect<void, OutputLockError> =>
  Effect.try({
    try: () => releaseOutputLockSync(lock),
    catch: cause => {
      if (isExpectedNodeSystemError(cause)) {
        return new OutputLockError({
          outputDir: lock.outputDir,
          lockPath: lock.path,
          operation: "release",
          cause,
        });
      }
      throw cause;
    },
  }).pipe(Effect.flatMap(status => logOutputLockReleaseStatus(lock, status)));

/**
 * Finalizer-safe release policy. Generator cleanup cannot add a typed error
 * channel, so the strict operation is deliberately downgraded to a warning
 * here rather than masking the pipeline's own outcome.
 */
export const releaseOutputLock = (lock: OutputLock): Effect.Effect<void> =>
  releaseOutputLockStrict(lock).pipe(
    Effect.tap(() => Effect.sync(() => forgetFailedOutputLockRelease(lock))),
    Effect.catchTag("OutputLockError", failure =>
      Effect.sync(() => rememberFailedOutputLockRelease(lock)).pipe(
        Effect.andThen(
          Effect.logWarning(
            `Failed to release output lock at '${lock.path}': ${failure.message}`
          )
        )
      )
    )
  );
