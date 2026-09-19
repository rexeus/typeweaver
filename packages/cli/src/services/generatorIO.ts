import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { FileSystem } from "@effect/platform";
import { Effect } from "effect";
import {
  CleanTargetInspectionError,
  ConcurrentGenerationError,
  LegacyOutputLockError,
  OutputCleanError,
  OutputLockError,
  UnsafeCleanTargetError,
  UnsafeSharedTempDirectoryError,
} from "../errors/index.js";
import {
  assertSafeCleanTarget,
  assertSafeCleanTargetWith,
} from "./cleanTargetGuard.js";
import {
  errnoCode,
  isExpectedNodeSystemError,
} from "./internal/nodeFsErrors.js";
import {
  canonicalOutputPath,
  canonicalHostTempDirectory,
  ensureTrustedHostTempDirectory,
  hasCoordinationArtifactMarker,
  inspectLegacyOutputLock,
  isLiveLegacyOutputLock,
  isProcessAlive,
  LEGACY_OUTPUT_LOCK_DIRECTORY,
  OUTPUT_LOCK_INFO_FILE,
  outputLockDirectory,
  readOutputLockInfo,
} from "./internal/outputCoordinationArtifact.js";
import type { CleanTargetFs } from "./cleanTargetGuard.js";
import type { OutputLockInfo } from "./internal/outputCoordinationArtifact.js";

/**
 * Effect-wrapped output-target check. Safety violations and expected Node
 * filesystem probe errors are surfaced on the failure channel; unexpected
 * throws remain defects. Pass `inputFile` only when the clean step will
 * run — the containment rule guards against cleaning the spec source, and
 * does not apply to no-clean runs.
 *
 * The guard's filesystem probes (`exists`, `realpathSync.native`) stay on
 * `node:fs` rather than the Effect-native `FileSystem` service because the
 * algorithm is sync top-to-bottom and `@effect/platform`'s `FileSystem`
 * surface is async-Effect — `Effect.runSync` over its `exists` raises an
 * `AsyncFiberException`. The probes are well-audited and isolated; the
 * deps-injection seam on `assertSafeCleanTargetWith` keeps the door open
 * for test substitution without paying the async tax in production.
 */
export const assertSafeCleanTargetEffect = (
  outputDir: string,
  currentWorkingDirectory: string,
  inputFile?: string
): Effect.Effect<void, UnsafeCleanTargetError | CleanTargetInspectionError> =>
  Effect.try({
    try: () =>
      assertSafeCleanTarget(outputDir, currentWorkingDirectory, inputFile),
    catch: error => {
      if (error instanceof UnsafeCleanTargetError) {
        return error;
      }
      if (isExpectedNodeSystemError(error)) {
        return new CleanTargetInspectionError({ outputDir, cause: error });
      }
      throw error;
    },
  });

export const assertSafeCleanTargetEffectWith = (
  outputDir: string,
  currentWorkingDirectory: string,
  fileSystem: CleanTargetFs,
  inputFile?: string
): Effect.Effect<void, UnsafeCleanTargetError | CleanTargetInspectionError> =>
  Effect.try({
    try: () =>
      assertSafeCleanTargetWith(
        outputDir,
        currentWorkingDirectory,
        fileSystem,
        inputFile
      ),
    catch: error => {
      if (error instanceof UnsafeCleanTargetError) {
        return error;
      }
      if (isExpectedNodeSystemError(error)) {
        return new CleanTargetInspectionError({ outputDir, cause: error });
      }
      throw error;
    },
  });

export const removeOutputDir = (outputDir: string) =>
  Effect.gen(function* () {
    const fileSystem = yield* FileSystem.FileSystem;
    const exists = yield* fileSystem.exists(outputDir);
    if (!exists) {
      return;
    }
    yield* fileSystem.remove(outputDir, { recursive: true, force: true });
  });

/**
 * Clean every entry inside `outputDir`, preserving only a proven legacy
 * `.typeweaver-lock` directory that a live process still owns. Dead complete
 * locks, malformed locks, fence-shaped files/directories, and all lookalikes
 * are removed so a following `generate --check` can report a remediable tree.
 * Current coordination locks live out of band. Idempotent — a missing
 * `outputDir` is a no-op.
 *
 * Filesystem failures (e.g. `EACCES` on a read-only entry) surface as a
 * typed `OutputCleanError` rather than a defect: the operator can act on
 * them (fix permissions, close the file handle) and the run must abort
 * either way before generation writes into a half-cleaned target.
 */
export const cleanOutputDirPreservingLock = (
  outputDir: string
): Effect.Effect<void, OutputCleanError> =>
  Effect.try({
    try: () => {
      if (!fs.existsSync(outputDir)) {
        return;
      }
      const entries = fs.readdirSync(outputDir, { withFileTypes: true });
      for (const entry of entries) {
        const entryPath = path.join(outputDir, entry.name);
        // Preserve only a proven legacy lock that a live process still owns.
        // Dead or malformed legacy entries, fence-shaped files/directories, and
        // all lookalikes are removed so reported drift is remediable.
        if (
          entry.isDirectory() &&
          isLiveLegacyOutputLock(entryPath, entry.name)
        ) {
          continue;
        }
        fs.rmSync(entryPath, {
          recursive: true,
          force: true,
        });
      }
    },
    catch: cause => {
      if (isExpectedNodeSystemError(cause)) {
        return new OutputCleanError({ outputDir, cause });
      }
      throw cause;
    },
  });

export const ensureOutputDirectories = (params: {
  readonly outputDir: string;
  readonly responsesOutputDir: string;
  readonly specOutputDir: string;
}) =>
  Effect.gen(function* () {
    const fileSystem = yield* FileSystem.FileSystem;
    yield* fileSystem.makeDirectory(params.outputDir, { recursive: true });
    yield* fileSystem.makeDirectory(params.responsesOutputDir, {
      recursive: true,
    });
    yield* fileSystem.makeDirectory(params.specOutputDir, { recursive: true });
  });

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

const rememberFailedOutputLockRelease = (lock: OutputLock): void => {
  failedOutputLockReleases.set(
    outputLockReleaseKey(lock.path),
    lock.ownerToken
  );
};

const forgetFailedOutputLockRelease = (lock: OutputLock): void => {
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

type OutputLockAcquisitionHooks = {
  readonly onLockDirectoryCreated: (lockDir: string) => void;
  readonly onBeforeStaleLockMove: (lockDir: string) => void;
};

const NO_OUTPUT_LOCK_HOOKS: OutputLockAcquisitionHooks = {
  onLockDirectoryCreated: () => undefined,
  onBeforeStaleLockMove: () => undefined,
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

const sameLockInfo = (left: OutputLockInfo, right: OutputLockInfo): boolean =>
  left.pid === right.pid &&
  left.startedAt === right.startedAt &&
  left.ownerToken === right.ownerToken;

const lockFencePath = (lockDir: string, info: OutputLockInfo): string => {
  const identity =
    info.ownerToken ??
    `${info.pid}\u0000${info.startedAt}\u0000${info.inputFile}`;
  const digest = createHash("sha256")
    .update(identity)
    .digest("hex")
    .slice(0, 24);
  return `${lockDir}.fence-${digest}`;
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

      const acquired = tryAcquireNewOutputLock(lockedParams, hooks);
      if (acquired !== undefined) {
        forgetFailedOutputLockReleaseAt(lockDir);
        return acquired;
      }

      const holder = readOutputLockInfo(lockDir);
      if (holder === undefined) {
        throw concurrentFailure(lockedParams.outputDir, lockPath, {
          _tag: "Unknown",
        });
      }
      if (isActiveOutputLock(lockDir, holder)) {
        throw concurrentFailure(
          lockedParams.outputDir,
          lockPath,
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
          lockPath,
          reHolder === undefined ? { _tag: "Unknown" } : knownHolder(reHolder)
        );
      }
      forgetFailedOutputLockReleaseAt(lockDir);

      const reclaimed = tryAcquireNewOutputLock(lockedParams, hooks);
      if (reclaimed !== undefined) {
        return reclaimed;
      }
      const reHolder = readOutputLockInfo(lockDir);
      throw concurrentFailure(
        lockedParams.outputDir,
        lockPath,
        reHolder === undefined ? { _tag: "Unknown" } : knownHolder(reHolder)
      );
    },
    catch: error => {
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
    },
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
  if (!fs.existsSync(lock.path)) {
    fs.renameSync(fencePath, lock.path);
  }
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
    Effect.tap(() =>
      Effect.sync(() => {
        forgetFailedOutputLockRelease(lock);
      })
    ),
    Effect.catchTag("OutputLockError", failure =>
      Effect.sync(() => {
        rememberFailedOutputLockRelease(lock);
      }).pipe(
        Effect.zipRight(
          Effect.logWarning(
            `Failed to release output lock at '${lock.path}': ${failure.message}`
          )
        )
      )
    )
  );

/**
 * Sweep orphaned `.typeweaver-*` tempdirs from a prior run that was killed
 * before its `try/finally` could clean up. With `--no-clean`, these dirs
 * would otherwise accrete and the formatter would walk into them and
 * rewrite their in-flight `.tmp` content.
 *
 * Cheap and idempotent: if the output directory does not exist (first run)
 * or contains no orphans, the sweep is a no-op. A live proven legacy lock is
 * skipped; only the atomic-write (`.typeweaver-XXXXXX`) and spec-bundler
 * staging (`.typeweaver-spec-loader-XXXXXX`) artifacts with an exact,
 * versioned ownership marker are pruned. A matching name without that marker
 * is user-owned and preserved.
 *
 * Best-effort: a failing `rm` (e.g. `EACCES` on crash debris owned by
 * another user) is demoted to a WARN log — an unremovable orphan must not
 * block generation. The formatter independently recognizes the same
 * name-plus-marker contract and skips only confirmed coordination artifacts.
 */
export const sweepOrphanTempdirs = (outputDir: string): Effect.Effect<void> =>
  Effect.try(() => {
    if (!fs.existsSync(outputDir)) {
      return;
    }
    sweepOrphanTempdirsAt(outputDir);
  }).pipe(
    Effect.catchAll(failure =>
      Effect.logWarning(
        `Failed to sweep orphan tempdirs under '${outputDir}': ${failure.message}`
      )
    )
  );

const sweepOrphanTempdirsAt = (directory: string): void => {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(directory, { withFileTypes: true });
  } catch (error) {
    if (errnoCode(error) === "ENOENT") {
      return;
    }
    throw error;
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }
    const entryPath = path.join(directory, entry.name);
    // Never descend into a live legacy lock; clean owns dead/unproven removal.
    if (isLiveLegacyOutputLock(entryPath, entry.name)) {
      continue;
    }
    if (hasCoordinationArtifactMarker(entryPath, entry.name)) {
      fs.rmSync(entryPath, { recursive: true, force: true });
      continue;
    }
    sweepOrphanTempdirsAt(entryPath);
  }
};
