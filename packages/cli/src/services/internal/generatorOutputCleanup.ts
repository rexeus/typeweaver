import fs from "node:fs";
import path from "node:path";
import { Effect } from "effect";
import { OutputCleanError } from "../../errors/index.js";
import { isExpectedNodeSystemError, errnoCode } from "./nodeFsErrors.js";
import {
  hasCoordinationArtifactMarker,
  isLiveLegacyOutputLock,
} from "./outputCoordinationArtifact.js";

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
      if (!fs.existsSync(outputDir)) return;
      for (const entry of fs.readdirSync(outputDir, { withFileTypes: true })) {
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
        fs.rmSync(entryPath, { recursive: true, force: true });
      }
    },
    catch: cause => {
      if (isExpectedNodeSystemError(cause)) {
        return new OutputCleanError({ outputDir, cause });
      }
      throw cause;
    },
  });

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
    if (fs.existsSync(outputDir)) sweepOrphanTempdirsAt(outputDir);
  }).pipe(
    Effect.catch(failure =>
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
    if (errnoCode(error) === "ENOENT") return;
    throw error;
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const entryPath = path.join(directory, entry.name);
    // Never descend into a live legacy lock; clean owns dead/unproven removal.
    if (isLiveLegacyOutputLock(entryPath, entry.name)) continue;
    if (hasCoordinationArtifactMarker(entryPath, entry.name)) {
      fs.rmSync(entryPath, { recursive: true, force: true });
      continue;
    }
    sweepOrphanTempdirsAt(entryPath);
  }
};
