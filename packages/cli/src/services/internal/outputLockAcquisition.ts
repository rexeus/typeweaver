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
