import fs from "node:fs";
import { Effect } from "effect";
import { OutputLockError } from "../../errors/index.js";
import { isExpectedNodeSystemError } from "./nodeFsErrors.js";
import {
  forgetFailedOutputLockRelease,
  lockFencePath,
  rememberFailedOutputLockRelease,
  sameLockInfo,
} from "./outputLockAcquisition.js";
import { readOutputLockInfo } from "./outputLockInfo.js";
import type { OutputLock } from "./outputLockAcquisition.js";

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
  if (!fs.existsSync(lock.path)) fs.renameSync(fencePath, lock.path);
  return { _tag: "OwnershipChanged" };
};

const removeDetachedOutputLock = (
  fencePath: string
): OutputLockReleaseStatus => {
  try {
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
