import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { FileSystem } from "@effect/platform";
import { Effect } from "effect";
import { ConcurrentGenerationError } from "../errors/ConcurrentGenerationError.js";
import { OutputCleanError } from "../errors/OutputCleanError.js";
import { UnsafeCleanTargetError } from "../errors/UnsafeCleanTargetError.js";
import { assertSafeCleanTarget } from "./cleanTargetGuard.js";
import type { PlatformError } from "@effect/platform/Error";

const isUnsafeCleanTargetError = (
  error: unknown
): error is UnsafeCleanTargetError =>
  typeof error === "object" &&
  error !== null &&
  (error as { readonly _tag?: unknown })._tag === "UnsafeCleanTargetError";

/**
 * Effect-wrapped output-target check. Tagged `UnsafeCleanTargetError` is
 * surfaced on the failure channel; any other thrown error escapes as a
 * defect (programming bug). Pass `inputFile` only when the clean step will
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
): Effect.Effect<void, UnsafeCleanTargetError> =>
  Effect.try({
    try: () =>
      assertSafeCleanTarget(outputDir, currentWorkingDirectory, inputFile),
    catch: error => {
      if (isUnsafeCleanTargetError(error)) {
        return error;
      }
      throw error;
    },
  });

export const removeOutputDir = (
  outputDir: string
): Effect.Effect<void, PlatformError, FileSystem.FileSystem> =>
  Effect.gen(function* () {
    const fileSystem = yield* FileSystem.FileSystem;
    const exists = yield* fileSystem.exists(outputDir);
    if (!exists) {
      return;
    }
    yield* fileSystem.remove(outputDir, { recursive: true, force: true });
  });

/**
 * Clean every entry inside `outputDir` except the active lock and stale
 * ownership fences. The fences prevent a delayed stale-lock reclaimer
 * from moving or deleting a replacement owner's lock. Idempotent — a
 * missing `outputDir` is a no-op.
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
        if (isOutputLockArtifact(entry.name)) {
          continue;
        }
        fs.rmSync(path.join(outputDir, entry.name), {
          recursive: true,
          force: true,
        });
      }
    },
    catch: cause => new OutputCleanError({ outputDir, cause }),
  });

export const ensureOutputDirectories = (params: {
  readonly outputDir: string;
  readonly responsesOutputDir: string;
  readonly specOutputDir: string;
}): Effect.Effect<void, PlatformError, FileSystem.FileSystem> =>
  Effect.gen(function* () {
    const fileSystem = yield* FileSystem.FileSystem;
    yield* fileSystem.makeDirectory(params.outputDir, { recursive: true });
    yield* fileSystem.makeDirectory(params.responsesOutputDir, {
      recursive: true,
    });
    yield* fileSystem.makeDirectory(params.specOutputDir, { recursive: true });
  });

const LOCK_DIR_NAME = ".typeweaver-lock";
const LOCK_FENCE_PREFIX = `${LOCK_DIR_NAME}.fence-`;
const LOCK_INFO_FILE = "info.json";

type LockInfo = {
  readonly pid: number;
  readonly startedAt: string;
  readonly inputFile: string;
  readonly ownerToken?: string;
};

export type OutputLock = {
  readonly path: string;
  readonly ownerToken: string;
};

type OutputLockReleaseStatus =
  | { readonly _tag: "Released" }
  | { readonly _tag: "AlreadyAbsent" }
  | { readonly _tag: "OwnershipChanged" };

type OutputLockAcquisitionHooks = {
  readonly onLockDirectoryCreated: (lockDir: string) => void;
  readonly onBeforeStaleLockMove: (lockDir: string) => void;
};

const NO_OUTPUT_LOCK_HOOKS: OutputLockAcquisitionHooks = {
  onLockDirectoryCreated: () => undefined,
  onBeforeStaleLockMove: () => undefined,
};

const isOutputLockArtifact = (entryName: string): boolean =>
  entryName === LOCK_DIR_NAME || entryName.startsWith(LOCK_FENCE_PREFIX);

const errnoCode = (error: unknown): string | undefined =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  typeof error.code === "string"
    ? error.code
    : undefined;

const isProcessAlive = (pid: number): boolean => {
  try {
    // Signal 0 performs error checking without sending a signal. Returns
    // true if the process exists and the caller has permission to signal
    // it. Node abstracts the POSIX/Windows difference.
    process.kill(pid, 0);
    return true;
  } catch (error) {
    // EPERM means the process exists but is owned by another user — still
    // alive, just not signal-able. ESRCH means the PID has no live process.
    return errnoCode(error) === "EPERM";
  }
};

const readLockInfo = (lockDir: string): LockInfo | undefined => {
  try {
    const raw = fs.readFileSync(path.join(lockDir, LOCK_INFO_FILE), "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      typeof (parsed as { pid?: unknown }).pid !== "number" ||
      typeof (parsed as { startedAt?: unknown }).startedAt !== "string"
    ) {
      return undefined;
    }
    const { pid, startedAt, inputFile, ownerToken } = parsed as {
      pid: number;
      startedAt: string;
      inputFile?: unknown;
      ownerToken?: unknown;
    };
    if (ownerToken !== undefined && typeof ownerToken !== "string") {
      return undefined;
    }
    return {
      pid,
      startedAt,
      inputFile: typeof inputFile === "string" ? inputFile : "",
      ...(ownerToken === undefined ? {} : { ownerToken }),
    };
  } catch {
    return undefined;
  }
};

const writeLockInfo = (lockDir: string, info: LockInfo): void => {
  const candidatePath = path.join(lockDir, `.${info.ownerToken}.json`);
  try {
    fs.writeFileSync(candidatePath, JSON.stringify(info, null, 2), {
      flag: "wx",
    });
    fs.renameSync(candidatePath, path.join(lockDir, LOCK_INFO_FILE));
  } finally {
    fs.rmSync(candidatePath, { force: true });
  }
};

const tryCreateLockDir = (lockDir: string): boolean => {
  try {
    fs.mkdirSync(lockDir);
    return true;
  } catch (error) {
    if (errnoCode(error) === "EEXIST") {
      return false;
    }
    throw error;
  }
};

const sameLockInfo = (left: LockInfo, right: LockInfo): boolean =>
  left.pid === right.pid &&
  left.startedAt === right.startedAt &&
  left.ownerToken === right.ownerToken;

const lockFencePath = (lockDir: string, info: LockInfo): string => {
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
  expected: LockInfo,
  hooks: OutputLockAcquisitionHooks
): boolean => {
  const current = readLockInfo(lockDir);
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

  const fenced = readLockInfo(fencePath);
  if (fenced === undefined || !sameLockInfo(fenced, expected)) {
    if (!fs.existsSync(lockDir)) {
      fs.renameSync(fencePath, lockDir);
    }
    return false;
  }
  return true;
};

const rollbackLockAcquisition = (lockDir: string, ownerToken: string): void => {
  const current = readLockInfo(lockDir);
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
  const lockDir = path.join(params.outputDir, LOCK_DIR_NAME);
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
    return { path: lockDir, ownerToken };
  } catch (error) {
    rollbackLockAcquisition(lockDir, ownerToken);
    throw error;
  }
};

/**
 * Acquire an exclusive lock on `outputDir` by creating a `.typeweaver-lock/`
 * directory. `mkdir` is atomic and fails with `EEXIST` if the directory
 * already exists. Ownership metadata is published atomically and contains
 * a unique token. Missing or malformed metadata fails closed so another
 * process cannot reclaim a lock while its owner is still publishing it.
 * If complete metadata belongs to a dead PID, the stale lock is reclaimed
 * only while those metadata remain unchanged.
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
): Effect.Effect<OutputLock, ConcurrentGenerationError> =>
  Effect.try({
    try: () => {
      const lockDir = path.join(params.outputDir, LOCK_DIR_NAME);

      const acquired = tryAcquireNewOutputLock(params, hooks);
      if (acquired !== undefined) {
        return acquired;
      }

      const holder = readLockInfo(lockDir);
      if (holder === undefined) {
        throw new ConcurrentGenerationError({
          outputDir: params.outputDir,
          holder: { _tag: "Unknown" },
        });
      }
      if (isProcessAlive(holder.pid)) {
        throw new ConcurrentGenerationError({
          outputDir: params.outputDir,
          holder: {
            _tag: "Known",
            pid: holder.pid,
            startedAt: holder.startedAt,
          },
        });
      }

      if (!moveStaleLockToFence(lockDir, holder, hooks)) {
        const reHolder = readLockInfo(lockDir);
        throw new ConcurrentGenerationError({
          outputDir: params.outputDir,
          holder:
            reHolder === undefined
              ? { _tag: "Unknown" }
              : {
                  _tag: "Known",
                  pid: reHolder.pid,
                  startedAt: reHolder.startedAt,
                },
        });
      }

      const reclaimed = tryAcquireNewOutputLock(params, hooks);
      if (reclaimed !== undefined) {
        return reclaimed;
      }
      const reHolder = readLockInfo(lockDir);
      throw new ConcurrentGenerationError({
        outputDir: params.outputDir,
        holder:
          reHolder === undefined
            ? { _tag: "Unknown" }
            : {
                _tag: "Known",
                pid: reHolder.pid,
                startedAt: reHolder.startedAt,
              },
      });
    },
    catch: error => {
      if (error instanceof ConcurrentGenerationError) {
        return error;
      }
      throw error;
    },
  });

export const acquireOutputLock = (params: {
  readonly outputDir: string;
  readonly inputFile: string;
}): Effect.Effect<OutputLock, ConcurrentGenerationError> =>
  acquireOutputLockWith(params, NO_OUTPUT_LOCK_HOOKS);

/**
 * Release the lock created by `acquireOutputLock`. Idempotent — a missing
 * lock directory (e.g. removed by a clean step run during the lifetime of
 * the lock) is a no-op rather than a failure.
 *
 * Release removes the directory only when its published token still
 * matches the acquired handle. A failing release is demoted to a WARN log
 * instead of masking the pipeline's own outcome.
 */
export const releaseOutputLock = (lock: OutputLock): Effect.Effect<void> =>
  Effect.try(() => {
    if (!fs.existsSync(lock.path)) {
      return { _tag: "AlreadyAbsent" } as const;
    }
    const holder = readLockInfo(lock.path);
    if (holder?.ownerToken !== lock.ownerToken) {
      return { _tag: "OwnershipChanged" } as const;
    }
    fs.rmSync(lock.path, { recursive: true, force: true });
    return { _tag: "Released" } as const;
  }).pipe(
    Effect.flatMap((status: OutputLockReleaseStatus) =>
      status._tag === "OwnershipChanged"
        ? Effect.logWarning(
            `Skipped release of output lock at '${lock.path}' because its ownership changed.`
          )
        : Effect.void
    ),
    Effect.catchAll(failure =>
      Effect.logWarning(
        `Failed to release output lock at '${lock.path}': ${failure.message}.`
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
 * or contains no orphans, the sweep is a no-op. The current lock dir
 * (`.typeweaver-lock`) and stale-ownership fences are preserved — only the
 * atomic-write artifacts (`.typeweaver-XXXX`) are pruned.
 *
 * Best-effort: a failing `rm` (e.g. `EACCES` on crash debris owned by
 * another user) is demoted to a WARN log — an unremovable orphan must not
 * block generation, and the formatter skips `.typeweaver-*` entries anyway.
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
  } catch {
    return;
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }
    if (isOutputLockArtifact(entry.name)) {
      continue;
    }
    const entryPath = path.join(directory, entry.name);
    if (entry.name.startsWith(".typeweaver-")) {
      fs.rmSync(entryPath, { recursive: true, force: true });
      continue;
    }
    sweepOrphanTempdirsAt(entryPath);
  }
};
