import fs from "node:fs";
import path from "node:path";
import { FileSystem } from "@effect/platform";
import { Effect } from "effect";
import {
  CleanTargetInspectionError,
  OutputCleanError,
  OutputLockError,
  UnsafeCleanTargetError,
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
  hasCoordinationArtifactMarker,
  isLiveLegacyOutputLock,
  readOutputLockInfo,
} from "./internal/outputCoordinationArtifact.js";
import {
  acquireOutputLock,
  acquireOutputLockWith,
  forgetFailedOutputLockRelease,
  lockFencePath,
  rememberFailedOutputLockRelease,
  sameLockInfo,
} from "./internal/outputLockAcquisition.js";
import type { CleanTargetFs } from "./cleanTargetGuard.js";
import type { OutputLock } from "./internal/outputLockAcquisition.js";

export type { OutputLock };
export { acquireOutputLock, acquireOutputLockWith };

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
