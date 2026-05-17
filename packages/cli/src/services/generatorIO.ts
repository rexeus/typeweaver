import fs from "node:fs";
import path from "node:path";
import { FileSystem } from "@effect/platform";
import { Effect } from "effect";
import { ConcurrentGenerationError } from "../errors/ConcurrentGenerationError.js";
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
 * Effect-wrapped clean-target check. Tagged `UnsafeCleanTargetError` is
 * surfaced on the failure channel; any other thrown error escapes as a
 * defect (programming bug).
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
 * Clean every entry inside `outputDir` except the lockfile sentinel.
 * Used by the run-time clean step so the per-process lock survives the
 * destructive sweep. Idempotent — a missing `outputDir` is a no-op.
 */
export const cleanOutputDirPreservingLock = (
  outputDir: string
): Effect.Effect<void> =>
  Effect.sync(() => {
    if (!fs.existsSync(outputDir)) {
      return;
    }
    const entries = fs.readdirSync(outputDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === LOCK_DIR_NAME) {
        continue;
      }
      fs.rmSync(path.join(outputDir, entry.name), {
        recursive: true,
        force: true,
      });
    }
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
const LOCK_INFO_FILE = "info.json";

type LockInfo = {
  readonly pid: number;
  readonly startedAt: string;
  readonly inputFile: string;
};

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
    const code = (error as NodeJS.ErrnoException).code;
    return code === "EPERM";
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
    const { pid, startedAt, inputFile } = parsed as {
      pid: number;
      startedAt: string;
      inputFile?: unknown;
    };
    return {
      pid,
      startedAt,
      inputFile: typeof inputFile === "string" ? inputFile : "",
    };
  } catch {
    return undefined;
  }
};

const writeLockInfo = (lockDir: string, info: LockInfo): void => {
  fs.writeFileSync(
    path.join(lockDir, LOCK_INFO_FILE),
    JSON.stringify(info, null, 2)
  );
};

const tryCreateLockDir = (lockDir: string): boolean => {
  try {
    fs.mkdirSync(lockDir);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") {
      return false;
    }
    throw error;
  }
};

/**
 * Acquire an exclusive lock on `outputDir` by creating a `.typeweaver-lock/`
 * directory. `mkdir` is atomic and fails with `EEXIST` if the directory
 * already exists, so it doubles as a lockfile primitive without an extra
 * dependency. If the lock is held by a dead PID (crashed prior run), the
 * stale lock is reclaimed and the acquire is retried once.
 *
 * Pair via `Effect.acquireRelease`: the release step removes the lock dir
 * unconditionally, so a SIGINT or interrupt during generation does not
 * leave the lock behind for the next run to trip over.
 */
export const acquireOutputLock = (params: {
  readonly outputDir: string;
  readonly inputFile: string;
}): Effect.Effect<string, ConcurrentGenerationError> =>
  Effect.try({
    try: () => {
      const lockDir = path.join(params.outputDir, LOCK_DIR_NAME);

      if (tryCreateLockDir(lockDir)) {
        writeLockInfo(lockDir, {
          pid: process.pid,
          startedAt: new Date().toISOString(),
          inputFile: params.inputFile,
        });
        return lockDir;
      }

      const holder = readLockInfo(lockDir);
      if (holder !== undefined && isProcessAlive(holder.pid)) {
        throw new ConcurrentGenerationError({
          outputDir: params.outputDir,
          holderPid: holder.pid,
          holderStartedAt: holder.startedAt,
        });
      }

      // Stale lock: prior holder is dead (or the info.json is unreadable —
      // treat both as crash debris). Reclaim and retry once.
      fs.rmSync(lockDir, { recursive: true, force: true });
      if (!tryCreateLockDir(lockDir)) {
        // Lost the race against another process that re-acquired between
        // our cleanup and re-create. Surface it with whatever metadata we
        // can read from the new holder.
        const reHolder = readLockInfo(lockDir);
        throw new ConcurrentGenerationError({
          outputDir: params.outputDir,
          holderPid: reHolder?.pid ?? -1,
          holderStartedAt: reHolder?.startedAt ?? new Date().toISOString(),
        });
      }
      writeLockInfo(lockDir, {
        pid: process.pid,
        startedAt: new Date().toISOString(),
        inputFile: params.inputFile,
      });
      return lockDir;
    },
    catch: error => {
      if (error instanceof ConcurrentGenerationError) {
        return error;
      }
      throw error;
    },
  });

/**
 * Release the lock created by `acquireOutputLock`. Idempotent — a missing
 * lock directory (e.g. removed by a clean step run during the lifetime of
 * the lock) is a no-op rather than a failure.
 */
export const releaseOutputLock = (lockDir: string): Effect.Effect<void> =>
  Effect.sync(() => {
    fs.rmSync(lockDir, { recursive: true, force: true });
  });

/**
 * Sweep orphaned `.typeweaver-*` tempdirs from a prior run that was killed
 * before its `try/finally` could clean up. With `--no-clean`, these dirs
 * would otherwise accrete and the formatter would walk into them and
 * rewrite their in-flight `.tmp` content.
 *
 * Cheap and idempotent: if the output directory does not exist (first run)
 * or contains no orphans, the sweep is a no-op. The current lock dir
 * (`.typeweaver-lock`) is preserved — only the atomic-write artifacts
 * (`.typeweaver-XXXX`) are pruned.
 */
export const sweepOrphanTempdirs = (outputDir: string): Effect.Effect<void> =>
  Effect.sync(() => {
    if (!fs.existsSync(outputDir)) {
      return;
    }
    sweepOrphanTempdirsAt(outputDir);
  });

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
    if (entry.name === LOCK_DIR_NAME) {
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
