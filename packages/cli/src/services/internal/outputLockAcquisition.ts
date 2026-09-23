import path from "node:path";
import { Effect } from "effect";
import {
  ConcurrentGenerationError,
  LegacyOutputLockError,
  OutputLockError,
  UnsafeSharedTempDirectoryError,
} from "../../errors/index.js";
import { canonicalHostTempDirectory } from "./hostTemp.js";
import { isExpectedNodeSystemError } from "./nodeFsErrors.js";
import {
  canonicalOutputPath,
  inspectLegacyOutputLock,
  LEGACY_OUTPUT_LOCK_DIRECTORY,
  outputLockDirectory,
} from "./outputCoordinationArtifact.js";
import {
  acquireOrReclaimOutputLock,
  lockFencePath,
  sameLockInfo,
} from "./outputLockOperations.js";
import {
  forgetFailedOutputLockRelease,
  rememberFailedOutputLockRelease,
} from "./outputLockState.js";
import type {
  OutputLock,
  OutputLockAcquisitionHooks,
} from "./outputLockOperations.js";

export type { OutputLock, OutputLockAcquisitionHooks };
export { lockFencePath, sameLockInfo };
export { forgetFailedOutputLockRelease, rememberFailedOutputLockRelease };

const NO_OUTPUT_LOCK_HOOKS: OutputLockAcquisitionHooks = {
  onLockDirectoryCreated: () => undefined,
  onBeforeStaleLockMove: () => undefined,
};

const assertNoLiveLegacyLock = (outputDir: string): void => {
  let legacy;
  try {
    legacy = inspectLegacyOutputLock(outputDir);
  } catch (error) {
    if (isExpectedNodeSystemError(error)) {
      throw new LegacyOutputLockError({
        outputDir,
        lockPath: path.join(outputDir, LEGACY_OUTPUT_LOCK_DIRECTORY),
        reason: "ownership-uncertain",
        cause: error,
      });
    }
    throw error;
  }
  if (legacy._tag !== "Held") return;
  throw new LegacyOutputLockError({
    outputDir,
    lockPath: legacy.lockPath,
    reason: legacy.reason,
    ...(legacy.holder === undefined
      ? {}
      : {
          holderPid: legacy.holder.pid,
          holderStartedAt: legacy.holder.startedAt,
        }),
  });
};

const mapAcquireOutputLockError = (
  error: unknown,
  params: { readonly outputDir: string },
  lockPath: string | undefined
):
  | ConcurrentGenerationError
  | LegacyOutputLockError
  | OutputLockError
  | UnsafeSharedTempDirectoryError => {
  if (
    error instanceof ConcurrentGenerationError ||
    error instanceof LegacyOutputLockError ||
    error instanceof UnsafeSharedTempDirectoryError
  ) {
    return error;
  }
  if (isExpectedNodeSystemError(error)) {
    return new OutputLockError({
      outputDir: params.outputDir,
      lockPath: lockPath ?? canonicalHostTempDirectory(),
      operation: "acquire",
      cause: error,
    });
  }
  throw error;
};

/**
 * Acquire an exclusive lock on `outputDir`. The lock is a flat directory
 * directly under the trusted host temp root, named deterministically from the
 * physical output identity (`outputLockDirectory`); `mkdir` is atomic and
 * fails with `EEXIST` if the lock already exists. Keeping the coordination
 * tree out of configured output lets read-only checks hold the same lock
 * without transiently mutating output.
 *
 * Before acquiring, a legacy in-output `.typeweaver-lock` is inspected: a live
 * holder or malformed/ownership-uncertain metadata fails closed because the
 * current CLI cannot write that legacy lock to coordinate with an older
 * process. Complete metadata owned by a dead process is stale and does not
 * block.
 *
 * Ownership metadata is published atomically and contains a unique token.
 * Missing or malformed metadata fails closed so another process cannot reclaim
 * a lock while its owner is still publishing it. If complete metadata belongs
 * to a dead PID, the stale lock is reclaimed only while those metadata remain
 * unchanged.
 *
 * Pair via `Effect.acquireRelease`: release verifies the ownership token,
 * so a delayed finalizer cannot remove a replacement owner's lock.
 */
export const acquireOutputLockWith = (
  params: { readonly outputDir: string; readonly inputFile: string },
  hooks: OutputLockAcquisitionHooks
): Effect.Effect<
  OutputLock,
  | ConcurrentGenerationError
  | LegacyOutputLockError
  | OutputLockError
  | UnsafeSharedTempDirectoryError
> => {
  let lockPath: string | undefined;
  return Effect.try({
    try: () => {
      const lockedParams = {
        ...params,
        outputDir: canonicalOutputPath(params.outputDir),
      };
      assertNoLiveLegacyLock(lockedParams.outputDir);
      const lockDir = outputLockDirectory(lockedParams.outputDir);
      lockPath = lockDir;
      return acquireOrReclaimOutputLock(lockedParams, lockDir, hooks);
    },
    catch: error => mapAcquireOutputLockError(error, params, lockPath),
  });
};

export const acquireOutputLock = (params: {
  readonly outputDir: string;
  readonly inputFile: string;
}): Effect.Effect<
  OutputLock,
  | ConcurrentGenerationError
  | LegacyOutputLockError
  | OutputLockError
  | UnsafeSharedTempDirectoryError
> => acquireOutputLockWith(params, NO_OUTPUT_LOCK_HOOKS);
