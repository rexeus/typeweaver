import fs from "node:fs";
import path from "node:path";
import { ReservedCoordinationPathError } from "../../errors/ReservedCoordinationPathError.js";
import { UnsafeSharedTempDirectoryError } from "../../errors/UnsafeSharedTempDirectoryError.js";
import { canonicalizePathForContainment } from "./canonicalPath.js";
import { isExpectedNodeSystemError } from "./nodeFsErrors.js";

const POSIX_HOST_TEMP = "/tmp";
const WINDOWS_HOST_TEMP = "\\\\?\\GLOBALROOT\\SystemRoot\\Temp";
const STICKY_BIT = 0o1000;
const WORLD_WRITABLE_BIT = 0o002;

export type HostTempPlatform = "win32" | "posix";

/**
 * Coordination names created directly under the trusted host temp root. A
 * configured output or project source that matches one of these names would
 * collide with lock, fence, or staging state and is rejected. Matching uses
 * the exact generated shape rather than a bare prefix so an ordinary project
 * directory that merely starts with `typeweaver-` is not reserved. The legacy
 * shared-root and staging-root names are reserved so an upgrade cannot reuse a
 * directory created by an older CLI.
 */
const RESERVED_EXACT_NAMES = new Set([
  "typeweaver-output-locks",
  "typeweaver-staging",
]);

const RESERVED_ARTIFACT_SHAPES = [
  { prefix: ".typeweaver-output-lock-", suffix: /^[0-9a-f]{64}$/ },
  {
    prefix: ".typeweaver-output-lock-",
    suffix: /^[0-9a-f]{64}\.fence-[0-9a-f]{24}$/,
  },
  { prefix: "typeweaver-check-", suffix: /^[A-Za-z0-9]{6}$/ },
  { prefix: "typeweaver-validate-", suffix: /^[A-Za-z0-9]{6}$/ },
] as const;

const isReservedCoordinationEntryName = (entryName: string): boolean => {
  // Match fully case-insensitively so an uppercase hex lock or fence name is
  // reserved on case-insensitive filesystems too.
  const folded = entryName.toLowerCase();
  if (RESERVED_EXACT_NAMES.has(folded)) {
    return true;
  }
  return RESERVED_ARTIFACT_SHAPES.some(({ prefix, suffix }) => {
    if (!folded.startsWith(prefix)) {
      return false;
    }
    return suffix.test(folded.slice(prefix.length));
  });
};

/**
 * Environment-independent fixed host temp path. POSIX is always `/tmp`.
 * Windows uses the Object Manager's `SystemRoot` alias, so it reaches the
 * installed Windows directory even when that directory is not on `C:`. It
 * deliberately does not read `TEMP`, `TMP`, `windir`, `SystemRoot`, or
 * `SystemDrive`, so every process on a machine agrees on one root. Windows
 * relies on the inherited ACL of that system directory rather than POSIX mode
 * bits.
 */
export const fixedHostTempPath = (platform: HostTempPlatform): string =>
  platform === "win32" ? WINDOWS_HOST_TEMP : POSIX_HOST_TEMP;

const hostPathFs = {
  exists: (probePath: string): boolean => fs.existsSync(probePath),
  realPath: (probePath: string): string => fs.realpathSync.native(probePath),
};

const readHostTempStats = (directory: string): fs.Stats => {
  try {
    return fs.lstatSync(directory);
  } catch (cause) {
    if (isExpectedNodeSystemError(cause)) {
      throw new UnsafeSharedTempDirectoryError({
        directory,
        reason: "not-created",
        cause,
      });
    }
    throw cause;
  }
};

/**
 * Resolves the fixed host temp path to its physical form. A failure to
 * canonicalize is typed, never a silent fallback to an environment-varying
 * location.
 */
export const canonicalHostTempDirectory = (): string => {
  const candidate = fixedHostTempPath(
    process.platform === "win32" ? "win32" : "posix"
  );
  try {
    return canonicalizePathForContainment(candidate, hostPathFs);
  } catch (cause) {
    if (isExpectedNodeSystemError(cause)) {
      throw new UnsafeSharedTempDirectoryError({
        directory: candidate,
        reason: "not-created",
        cause,
      });
    }
    throw cause;
  }
};

/**
 * Verifies the fixed host temp directory satisfies the platform trust policy.
 * POSIX requires a root-owned sticky, world-writable directory so unrelated
 * users can create their own flat lock/stage entries without being able to
 * rename another user's. Windows only verifies the fixed system temp is a
 * writable directory, since ACLs there are not expressible as POSIX mode bits.
 */
export const ensureTrustedHostTempDirectory = (directory: string): void => {
  const stats = readHostTempStats(directory);
  if (!stats.isDirectory()) {
    throw new UnsafeSharedTempDirectoryError({
      directory,
      reason: "not-directory",
    });
  }

  if (process.platform === "win32") {
    try {
      fs.accessSync(directory, fs.constants.W_OK);
    } catch (cause) {
      if (isExpectedNodeSystemError(cause)) {
        throw new UnsafeSharedTempDirectoryError({
          directory,
          reason: "unwritable",
          cause,
        });
      }
      throw cause;
    }
    return;
  }

  const trusted =
    stats.uid === 0 &&
    (stats.mode & STICKY_BIT) !== 0 &&
    (stats.mode & WORLD_WRITABLE_BIT) !== 0;
  if (!trusted) {
    throw new UnsafeSharedTempDirectoryError({
      directory,
      reason: "untrusted",
    });
  }
};

/**
 * True when `candidate` equals the trusted temp root or its first path
 * component under that root is a reserved coordination artifact name.
 * `trustedTemp` and `candidate` must be canonicalized. `pathApi` is injectable
 * so Windows path semantics are testable on any host.
 */
export const isReservedCoordinationPath = (
  candidate: string,
  trustedTemp: string,
  pathApi: typeof path = path
): boolean => {
  const relative = pathApi.relative(trustedTemp, candidate);
  if (relative === "") {
    return true;
  }
  if (relative.startsWith("..") || pathApi.isAbsolute(relative)) {
    return false;
  }
  const firstComponent = relative.split(pathApi.sep)[0] ?? "";
  return isReservedCoordinationEntryName(firstComponent);
};

/**
 * Returns the reserved name that `candidate` reserves (the temp root basename
 * when the root itself is the target), otherwise `undefined`.
 */
export const reservedCoordinationName = (
  candidate: string,
  trustedTemp: string,
  pathApi: typeof path = path
): string | undefined => {
  if (!isReservedCoordinationPath(candidate, trustedTemp, pathApi)) {
    return undefined;
  }
  const relative = pathApi.relative(trustedTemp, candidate);
  return relative === ""
    ? pathApi.basename(trustedTemp)
    : (relative.split(pathApi.sep)[0] ?? pathApi.basename(trustedTemp));
};

/**
 * Rejects a canonical path that equals the trusted temp root or overlaps the
 * reserved coordination namespace before any lock or stage is created.
 */
export const assertPathNotReservedForCoordination = (
  candidate: string
): void => {
  const trustedTemp = canonicalHostTempDirectory();
  let canonical: string;
  try {
    canonical = canonicalizePathForContainment(candidate, hostPathFs);
  } catch (cause) {
    if (isExpectedNodeSystemError(cause)) {
      throw new ReservedCoordinationPathError({
        path: candidate,
        tempRoot: trustedTemp,
        reason: "inspection-failed",
        cause,
      });
    }
    throw cause;
  }

  const conflictingName = reservedCoordinationName(canonical, trustedTemp);
  if (conflictingName !== undefined) {
    throw new ReservedCoordinationPathError({
      path: canonical,
      tempRoot: trustedTemp,
      reason: "reserved-name",
      conflictingName,
    });
  }
};
