import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { Effect } from "effect";
import {
  ConcurrentGenerationError,
  LegacyOutputLockError,
  OutputLockError,
  UnsafeSharedTempDirectoryError,
} from "../../errors/index.js";
import { errnoCode, isExpectedNodeSystemError } from "./nodeFsErrors.js";
import {
  canonicalHostTempDirectory,
  canonicalOutputPath,
  ensureTrustedHostTempDirectory,
  inspectLegacyOutputLock,
  isProcessAlive,
  LEGACY_OUTPUT_LOCK_DIRECTORY,
  OUTPUT_LOCK_INFO_FILE,
  outputLockDirectory,
  readOutputLockInfo,
} from "./outputCoordinationArtifact.js";
import type { OutputLockInfo } from "./outputCoordinationArtifact.js";

export type OutputLock = {
  readonly path: string;
  readonly outputDir: string;
  readonly ownerToken: string;
};

/**
 * A long-lived runtime can survive a transient release failure while the
 * on-disk lock still names its live PID. Remember only the exact ownership
 * token whose finalizer release failed so a later acquisition in this process
 * can distinguish that abandoned lock from a genuinely active concurrent run.
 */
const failedOutputLockReleases = new Map<string, string>();

const outputLockReleaseKey = (lockPath: string): string =>
  path.resolve(lockPath);

export const rememberFailedOutputLockRelease = (lock: OutputLock): void => {
  failedOutputLockReleases.set(
    outputLockReleaseKey(lock.path),
    lock.ownerToken
  );
};

export const forgetFailedOutputLockRelease = (lock: OutputLock): void => {
  const key = outputLockReleaseKey(lock.path);
  if (failedOutputLockReleases.get(key) === lock.ownerToken) {
    failedOutputLockReleases.delete(key);
  }
};

const forgetFailedOutputLockReleaseAt = (lockPath: string): void => {
  failedOutputLockReleases.delete(outputLockReleaseKey(lockPath));
};

const isFailedOutputLockRelease = (
  lockPath: string,
  holder: OutputLockInfo
): boolean =>
  holder.pid === process.pid &&
  holder.ownerToken !== undefined &&
  failedOutputLockReleases.get(outputLockReleaseKey(lockPath)) ===
    holder.ownerToken;

const isActiveOutputLock = (
  lockPath: string,
  holder: OutputLockInfo
): boolean =>
  !isFailedOutputLockRelease(lockPath, holder) && isProcessAlive(holder.pid);

export type OutputLockAcquisitionHooks = {
  readonly onLockDirectoryCreated: (lockDir: string) => void;
  readonly onBeforeStaleLockMove: (lockDir: string) => void;
};

const NO_OUTPUT_LOCK_HOOKS: OutputLockAcquisitionHooks = {
  onLockDirectoryCreated: () => undefined,
  onBeforeStaleLockMove: () => undefined,
};

export const sameLockInfo = (
  left: OutputLockInfo,
  right: OutputLockInfo
): boolean =>
  left.pid === right.pid &&
  left.startedAt === right.startedAt &&
  left.ownerToken === right.ownerToken;

export const lockFencePath = (
  lockDir: string,
  info: OutputLockInfo
): string => {
  const identity =
    info.ownerToken ??
    `${info.pid}\u0000${info.startedAt}\u0000${info.inputFile}`;
  const digest = createHash("sha256")
    .update(identity)
    .digest("hex")
    .slice(0, 24);
  return `${lockDir}.fence-${digest}`;
};

const writeLockInfo = (lockDir: string, info: OutputLockInfo): void => {
  const candidatePath = path.join(lockDir, `.${String(info.ownerToken)}.json`);
  try {
    fs.writeFileSync(candidatePath, JSON.stringify(info, null, 2), {
      flag: "wx",
      // Owner-only metadata; the lock directory is already 0o700.
      mode: 0o600,
    });
    fs.renameSync(candidatePath, path.join(lockDir, OUTPUT_LOCK_INFO_FILE));
  } finally {
    fs.rmSync(candidatePath, { force: true });
  }
};

const tryCreateLockDir = (lockDir: string): boolean => {
  try {
    // Explicit private mode so a permissive umask cannot expose lock metadata
    // to other users on the shared trusted temp root.
    fs.mkdirSync(lockDir, { mode: 0o700 });
    return true;
  } catch (error) {
    if (errnoCode(error) === "EEXIST") {
      return false;
    }
    throw error;
  }
};

const moveStaleLockToFence = (
  lockDir: string,
  expected: OutputLockInfo,
  hooks: OutputLockAcquisitionHooks
): boolean => {
  const current = readOutputLockInfo(lockDir);
  if (current === undefined || !sameLockInfo(current, expected)) {
    return false;
  }
  const fencePath = lockFencePath(lockDir, expected);
  hooks.onBeforeStaleLockMove(lockDir);
  try {
    fs.renameSync(lockDir, fencePath);
  } catch (error) {
    const code = errnoCode(error);
    if (code === "EEXIST" || code === "ENOTEMPTY" || code === "ENOENT") {
      return false;
    }
    throw error;
  }

  const fenced = readOutputLockInfo(fencePath);
  if (fenced === undefined || !sameLockInfo(fenced, expected)) {
    if (!fs.existsSync(lockDir)) {
      fs.renameSync(fencePath, lockDir);
    }
    return false;
  }
  return true;
};

const rollbackLockAcquisition = (lockDir: string, ownerToken: string): void => {
  const current = readOutputLockInfo(lockDir);
  if (current !== undefined && current.ownerToken !== ownerToken) {
    return;
  }
  fs.rmSync(lockDir, { recursive: true, force: true });
};

const tryAcquireNewOutputLock = (
  params: {
    readonly outputDir: string;
    readonly inputFile: string;
  },
  hooks: OutputLockAcquisitionHooks
): OutputLock | undefined => {
  // The lock is a flat entry directly under the trusted system temp root, so
  // no CLI user owns a shared parent that could rename another user's lock.
  ensureTrustedHostTempDirectory(canonicalHostTempDirectory());
  const lockDir = outputLockDirectory(params.outputDir);
  if (!tryCreateLockDir(lockDir)) {
    return undefined;
  }

  const ownerToken = randomUUID();
  try {
    hooks.onLockDirectoryCreated(lockDir);
    writeLockInfo(lockDir, {
      pid: process.pid,
      startedAt: new Date().toISOString(),
      inputFile: params.inputFile,
      ownerToken,
    });
    return { path: lockDir, outputDir: params.outputDir, ownerToken };
  } catch (error) {
    rollbackLockAcquisition(lockDir, ownerToken);
    throw error;
  }
};

type LockHolder = ConcurrentGenerationError["holder"];

const knownHolder = (info: OutputLockInfo): LockHolder => ({
  _tag: "Known",
  pid: info.pid,
  startedAt: info.startedAt,
});

const concurrentFailure = (
  outputDir: string,
  lockPath: string | undefined,
  holder: LockHolder
): ConcurrentGenerationError =>
  new ConcurrentGenerationError({ outputDir, lockPath, holder });

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
  if (legacy._tag !== "Held") {
    return;
  }
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

const holderOrUnknown = (holder: OutputLockInfo | undefined): LockHolder =>
  holder === undefined ? { _tag: "Unknown" } : knownHolder(holder);

const acquireOrReclaimOutputLock = (
  lockedParams: {
    readonly outputDir: string;
    readonly inputFile: string;
  },
  lockDir: string,
  hooks: OutputLockAcquisitionHooks
): OutputLock => {
  const acquired = tryAcquireNewOutputLock(lockedParams, hooks);
  if (acquired !== undefined) {
    forgetFailedOutputLockReleaseAt(lockDir);
    return acquired;
  }

  const holder = readOutputLockInfo(lockDir);
  if (holder === undefined) {
    throw concurrentFailure(lockedParams.outputDir, lockDir, {
      _tag: "Unknown",
    });
  }
  if (isActiveOutputLock(lockDir, holder)) {
    throw concurrentFailure(
      lockedParams.outputDir,
      lockDir,
      knownHolder(holder)
    );
  }

  if (!moveStaleLockToFence(lockDir, holder, hooks)) {
    const reHolder = readOutputLockInfo(lockDir);
    if (reHolder?.ownerToken !== holder.ownerToken) {
      forgetFailedOutputLockReleaseAt(lockDir);
    }
    throw concurrentFailure(
      lockedParams.outputDir,
      lockDir,
      holderOrUnknown(reHolder)
    );
  }
  forgetFailedOutputLockReleaseAt(lockDir);

  const reclaimed = tryAcquireNewOutputLock(lockedParams, hooks);
  if (reclaimed !== undefined) {
    return reclaimed;
  }
  throw concurrentFailure(
    lockedParams.outputDir,
    lockDir,
    holderOrUnknown(readOutputLockInfo(lockDir))
  );
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
 * Acquire an exclusive lock on `outputDir`. The lock is a `lock` directory
 * under a deterministic host-temp coordination path derived from the physical
 * output identity; `mkdir` is atomic and fails with `EEXIST` if the lock
 * already exists. Keeping the coordination tree out of configured output lets
 * read-only checks hold the same lock without transiently mutating output.
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
  params: {
    readonly outputDir: string;
    readonly inputFile: string;
  },
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
