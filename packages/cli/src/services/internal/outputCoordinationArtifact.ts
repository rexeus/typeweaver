import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  coordinationArtifactKindForTempDirectoryName,
  matchesCoordinationArtifactMarker,
  TYPEWEAVER_COORDINATION_MARKER_FILE,
} from "@rexeus/typeweaver-gen";
import { canonicalizePathForContainment } from "./canonicalPath.js";
import { canonicalHostTempDirectory } from "./hostTemp.js";
import { errnoCode } from "./nodeFsErrors.js";
import { OUTPUT_LOCK_INFO_FILE, readOutputLockInfo } from "./outputLockInfo.js";
import { isProcessAlive } from "./processLiveness.js";
import type { OutputLockInfo } from "./outputLockInfo.js";

export {
  assertPathNotReservedForCoordination,
  canonicalHostTempDirectory,
  ensureTrustedHostTempDirectory,
} from "./hostTemp.js";
export { isProcessAlive } from "./processLiveness.js";
export { OUTPUT_LOCK_INFO_FILE, readOutputLockInfo } from "./outputLockInfo.js";
export type { OutputLockInfo } from "./outputLockInfo.js";

export const LEGACY_OUTPUT_LOCK_DIRECTORY = ".typeweaver-lock";
const OUTPUT_LOCK_NAME_PREFIX = ".typeweaver-output-lock-";

const hostPathFs = {
  exists: (probePath: string): boolean => fs.existsSync(probePath),
  realPath: (probePath: string): string => fs.realpathSync.native(probePath),
};

/**
 * Normalizes an output directory into a stable identity for cross-process
 * coordination. The nearest existing ancestor is realpath-resolved (so symlink
 * aliases converge), the unresolved suffix is appended, and the entire
 * canonical identity is case-folded on every platform. Folding the whole path
 * keeps the identity stable when a missing directory is later created with a
 * different case (`Generated/Output` versus `generated/output`), at the cost of
 * conservative false contention between case-variant names on case-sensitive
 * filesystems. False contention is safe; two locks for one physical output are
 * not.
 */
export const normalizeOutputPathForLock = (outputDir: string): string =>
  canonicalizePathForContainment(
    path.resolve(outputDir),
    hostPathFs
  ).toLowerCase();

/**
 * Deterministic flat lock directory directly under the trusted host temp root.
 * The SHA-256 digest of the canonical output identity keeps the namespace flat
 * so no CLI user owns a shared parent that could rename another user's lock.
 */
export const outputLockDirectory = (outputDir: string): string => {
  const digest = createHash("sha256")
    .update(normalizeOutputPathForLock(outputDir))
    .digest("hex");
  return path.join(
    canonicalHostTempDirectory(),
    `${OUTPUT_LOCK_NAME_PREFIX}${digest}`
  );
};

/**
 * Confirms that `directoryPath` is a Typeweaver coordination artifact by
 * checking both the `mkdtemp`-shaped name and the exact versioned marker file.
 * The name alone is never evidence of ownership, so a user directory that
 * merely resembles a staging name is preserved/compared instead.
 */
export const hasCoordinationArtifactMarker = (
  directoryPath: string,
  entryName: string
): boolean => {
  const kind = coordinationArtifactKindForTempDirectoryName(entryName);
  if (kind === undefined) {
    return false;
  }

  const markerPath = path.join(
    directoryPath,
    TYPEWEAVER_COORDINATION_MARKER_FILE
  );
  try {
    if (!fs.lstatSync(markerPath).isFile()) {
      return false;
    }
    return matchesCoordinationArtifactMarker(
      fs.readFileSync(markerPath, "utf8"),
      kind
    );
  } catch (error) {
    const code = errnoCode(error);
    if (code === "ENOENT" || code === "ENOTDIR") {
      return false;
    }
    throw error;
  }
};

const statIfDirectory = (entryPath: string): fs.Stats | undefined => {
  const stats = fs.lstatSync(entryPath);
  return stats.isDirectory() ? stats : undefined;
};

/**
 * Reads legacy lock metadata without following links. The `info.json` entry
 * must be a regular file: a symlink, directory, or other entry type is
 * unsupported and classified as malformed rather than followed.
 */
const readLegacyLockInfo = (
  lockDirectory: string
): OutputLockInfo | undefined => {
  const infoPath = path.join(lockDirectory, OUTPUT_LOCK_INFO_FILE);
  let stats: fs.Stats;
  try {
    stats = fs.lstatSync(infoPath);
  } catch (error) {
    const code = errnoCode(error);
    if (code === "ENOENT" || code === "ENOTDIR") {
      return undefined;
    }
    throw error;
  }
  if (!stats.isFile()) {
    return undefined;
  }
  return readOutputLockInfo(lockDirectory);
};

/**
 * True only for a real `.typeweaver-lock` directory holding complete regular
 * metadata. A regular file with the name, a fence-named entry, a directory
 * with malformed metadata, or a symlinked `info.json` is not a proven legacy
 * lock and must be compared or cleaned rather than excluded.
 */
export const isCompleteLegacyOutputLock = (
  directoryPath: string,
  entryName: string
): boolean => {
  if (entryName !== LEGACY_OUTPUT_LOCK_DIRECTORY) {
    return false;
  }
  if (statIfDirectory(directoryPath) === undefined) {
    return false;
  }
  return readLegacyLockInfo(directoryPath) !== undefined;
};

/**
 * True only when a proven legacy lock directory is still owned by a live
 * process. The exact `.typeweaver-lock` basename is required first, so an
 * ordinary directory that merely contains a lock-shaped `info.json` is clean
 * and comparison content, not coordination state. Clean and orphan-sweep
 * preserve live locks; dead and unproven entries are removed so reported drift
 * stays remediable.
 */
export const isLiveLegacyOutputLock = (
  directoryPath: string,
  entryName: string
): boolean => {
  if (entryName !== LEGACY_OUTPUT_LOCK_DIRECTORY) {
    return false;
  }
  if (statIfDirectory(directoryPath) === undefined) {
    return false;
  }
  const holder = readLegacyLockInfo(directoryPath);
  return holder !== undefined && isProcessAlive(holder.pid);
};

export type LegacyOutputLockState =
  | { readonly _tag: "None" }
  | {
      readonly _tag: "Held";
      readonly lockPath: string;
      readonly reason: "held" | "malformed";
      readonly holder?: OutputLockInfo;
    }
  | { readonly _tag: "Stale"; readonly lockPath: string };

/**
 * Inspects the in-output legacy `.typeweaver-lock` before acquiring the
 * out-of-band lock. Fence leftovers are not locks and are ignored here.
 *
 * A complete metadata file owned by a live process is held; malformed or
 * unreadable metadata is ownership-uncertain; only complete metadata whose PID
 * is provably dead is stale. A missing output directory has no legacy lock and
 * never causes a write.
 */
export const inspectLegacyOutputLock = (
  outputDir: string
): LegacyOutputLockState => {
  const lockPath = path.join(outputDir, LEGACY_OUTPUT_LOCK_DIRECTORY);
  let stats: fs.Stats;
  try {
    stats = fs.lstatSync(lockPath);
  } catch (error) {
    if (errnoCode(error) === "ENOENT" || errnoCode(error) === "ENOTDIR") {
      return { _tag: "None" };
    }
    throw error;
  }
  if (!stats.isDirectory()) {
    return { _tag: "None" };
  }

  const holder = readLegacyLockInfo(lockPath);
  if (holder === undefined) {
    return { _tag: "Held", lockPath, reason: "malformed" };
  }
  if (isProcessAlive(holder.pid)) {
    return { _tag: "Held", lockPath, reason: "held", holder };
  }
  return { _tag: "Stale", lockPath };
};
