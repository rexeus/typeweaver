import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { FileSystem } from "@effect/platform";
import { Effect } from "effect";
import {
  CleanTargetInspectionError,
  ConcurrentGenerationError,
  OutputCleanError,
  OutputLockError,
  UnsafeCleanTargetError,
} from "../errors/index.js";
import {
  assertSafeCleanTarget,
  assertSafeCleanTargetWith,
} from "./cleanTargetGuard.js";
import type { CleanTargetFs } from "./cleanTargetGuard.js";
import type { PlatformError } from "@effect/platform/Error";

const isExpectedNodeSystemError = (error: unknown): boolean => {
  const code = errnoCode(error);
  if (code === undefined || !(error instanceof Error)) {
    return false;
  }

  // Node filesystem errors carry the failing syscall and/or a numeric errno.
  // This structural check covers platform-specific libuv codes (for example
  // EISDIR) without misclassifying arbitrary application errors that merely
  // happen to expose a string `code`.
  return (
    ("syscall" in error && typeof error.syscall === "string") ||
    ("errno" in error && typeof error.errno === "number")
  );
};

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
const TEMP_DIR_PREFIX = ".typeweaver-";
const SPEC_BUNDLER_TEMP_DIR_PREFIX = ".typeweaver-spec-loader-";
const TEMP_DIR_RANDOM_SUFFIX_LENGTH = 6;

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

const isAsciiAlphaNumeric = (character: string): boolean => {
  const code = character.charCodeAt(0);
  return (
    (code >= 48 && code <= 57) ||
    (code >= 65 && code <= 90) ||
    (code >= 97 && code <= 122)
  );
};

const hasNodeTempDirectoryShape = (
  entryName: string,
  prefix: string
): boolean => {
  if (
    !entryName.startsWith(prefix) ||
    entryName.length !== prefix.length + TEMP_DIR_RANDOM_SUFFIX_LENGTH
  ) {
    return false;
  }

  for (const character of entryName.slice(prefix.length)) {
    if (!isAsciiAlphaNumeric(character)) {
      return false;
    }
  }
  return true;
};

const isOwnedTempDirectory = (entryName: string): boolean =>
  hasNodeTempDirectoryShape(entryName, TEMP_DIR_PREFIX) ||
  hasNodeTempDirectoryShape(entryName, SPEC_BUNDLER_TEMP_DIR_PREFIX);

const errnoCode = (error: unknown): string | undefined =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  typeof error.code === "string"
    ? error.code
    : undefined;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isProcessAlive = (pid: number): boolean => {
  try {
    // Signal 0 performs error checking without sending a signal. Returns
    // true if the process exists and the caller has permission to signal
    // it. Node abstracts the POSIX/Windows difference.
    process.kill(pid, 0);
    return true;
  } catch (error) {
    // EPERM means the process exists but is owned by another user — still
    // alive, just not signal-able. Only ESRCH proves that the PID has no live
    // process. Unknown platform errors are treated conservatively as alive.
    return errnoCode(error) !== "ESRCH";
  }
};

const decodeLockInfo = (parsed: unknown): LockInfo | undefined => {
  if (!isRecord(parsed)) {
    return undefined;
  }

  const candidate = parsed;
  if (
    typeof candidate.pid !== "number" ||
    typeof candidate.startedAt !== "string"
  ) {
    return undefined;
  }
  if (
    candidate.ownerToken !== undefined &&
    typeof candidate.ownerToken !== "string"
  ) {
    return undefined;
  }

  return {
    pid: candidate.pid,
    startedAt: candidate.startedAt,
    inputFile:
      typeof candidate.inputFile === "string" ? candidate.inputFile : "",
    ...(candidate.ownerToken === undefined
      ? {}
      : { ownerToken: candidate.ownerToken }),
  };
};

const isUnavailableLockInfo = (error: unknown): boolean =>
  error instanceof SyntaxError ||
  errnoCode(error) === "ENOENT" ||
  errnoCode(error) === "ENOTDIR";

const readLockInfo = (lockDir: string): LockInfo | undefined => {
  try {
    const raw = fs.readFileSync(path.join(lockDir, LOCK_INFO_FILE), "utf8");
    return decodeLockInfo(JSON.parse(raw) as unknown);
  } catch (error) {
    if (isUnavailableLockInfo(error)) {
      return undefined;
    }
    throw error;
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
): Effect.Effect<OutputLock, ConcurrentGenerationError | OutputLockError> =>
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
      if (isExpectedNodeSystemError(error)) {
        return new OutputLockError({
          outputDir: params.outputDir,
          lockPath: path.join(params.outputDir, LOCK_DIR_NAME),
          operation: "acquire",
          cause: error,
        });
      }
      throw error;
    },
  });

export const acquireOutputLock = (params: {
  readonly outputDir: string;
  readonly inputFile: string;
}): Effect.Effect<OutputLock, ConcurrentGenerationError | OutputLockError> =>
  acquireOutputLockWith(params, NO_OUTPUT_LOCK_HOOKS);

/**
 * Release the lock created by `acquireOutputLock`. Idempotent — a missing
 * lock directory (e.g. removed by a clean step run during the lifetime of
 * the lock) is a no-op rather than a failure.
 *
 * Release removes the directory only when its published token still
 * matches the acquired handle. This strict operation retains expected
 * filesystem failures as `OutputLockError`.
 */
export const releaseOutputLockStrict = (
  lock: OutputLock
): Effect.Effect<void, OutputLockError> =>
  Effect.try({
    try: () => {
      if (!fs.existsSync(lock.path)) {
        return { _tag: "AlreadyAbsent" } as const;
      }
      const holder = readLockInfo(lock.path);
      if (holder?.ownerToken !== lock.ownerToken) {
        return { _tag: "OwnershipChanged" } as const;
      }
      fs.rmSync(lock.path, { recursive: true, force: true });
      return { _tag: "Released" } as const;
    },
    catch: cause => {
      if (isExpectedNodeSystemError(cause)) {
        return new OutputLockError({
          outputDir: path.dirname(lock.path),
          lockPath: lock.path,
          operation: "release",
          cause,
        });
      }
      throw cause;
    },
  }).pipe(
    Effect.flatMap((status: OutputLockReleaseStatus) =>
      status._tag === "OwnershipChanged"
        ? Effect.logWarning(
            `Skipped release of output lock at '${lock.path}' because its ownership changed.`
          )
        : Effect.void
    )
  );

/**
 * Finalizer-safe release policy. Generator cleanup cannot add a typed error
 * channel, so the strict operation is deliberately downgraded to a warning
 * here rather than masking the pipeline's own outcome.
 */
export const releaseOutputLock = (lock: OutputLock): Effect.Effect<void> =>
  releaseOutputLockStrict(lock).pipe(
    Effect.catchAll(failure =>
      Effect.logWarning(
        `Failed to release output lock at '${lock.path}': ${failure.message}`
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
 * atomic-write (`.typeweaver-XXXXXX`) and spec-bundler staging
 * (`.typeweaver-spec-loader-XXXXXX`) artifacts are pruned.
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
    if (isOutputLockArtifact(entry.name)) {
      continue;
    }
    const entryPath = path.join(directory, entry.name);
    if (isOwnedTempDirectory(entry.name)) {
      fs.rmSync(entryPath, { recursive: true, force: true });
      continue;
    }
    sweepOrphanTempdirsAt(entryPath);
  }
};
