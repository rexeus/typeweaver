import fs from "node:fs";
import path from "node:path";
import { Effect, FileSystem } from "effect";
import { badArgument, systemError } from "effect/PlatformError";
import {
  ReservedCoordinationPathError,
  UnsafeSharedTempDirectoryError,
  UnsafeStagingRootError,
} from "../../errors/index.js";
import {
  areDisjointPaths,
  canonicalizePathForContainment,
  isSameOrDescendantOf,
} from "./canonicalPath.js";
import {
  assertPathNotReservedForCoordination,
  canonicalHostTempDirectory,
  ensureTrustedHostTempDirectory,
} from "./hostTemp.js";
import { errnoCode, isExpectedNodeSystemError } from "./nodeFsErrors.js";
import type { PlatformError, SystemErrorTag } from "effect/PlatformError";
const hostPathFs = {
  exists: (probePath: string): boolean => fs.existsSync(probePath),
  realPath: (probePath: string): string => fs.realpathSync.native(probePath),
};

const systemErrorReason = (cause: unknown): SystemErrorTag => {
  switch (errnoCode(cause)) {
    case "ENOENT":
      return "NotFound";
    case "EACCES":
    case "EPERM":
      return "PermissionDenied";
    case "EEXIST":
      return "AlreadyExists";
    case "EISDIR":
    case "ENOTDIR":
    case "ELOOP":
      return "BadResource";
    case "EBUSY":
      return "Busy";
    case undefined:
      return "Unknown";
    default:
      return "Unknown";
  }
};

const mapNodeSymlinkError = (
  cause: unknown,
  linkPath: string
): PlatformError => {
  if (!isExpectedNodeSystemError(cause)) {
    return badArgument({
      module: "FileSystem",
      method: "symlink",
      cause,
    });
  }

  const syscall =
    "syscall" in cause && typeof cause.syscall === "string"
      ? cause.syscall
      : undefined;
  return systemError({
    _tag: systemErrorReason(cause),
    module: "FileSystem",
    method: "symlink",
    pathOrDescriptor: linkPath,
    ...(syscall === undefined ? {} : { syscall }),
    description: cause.message,
    cause,
  });
};

/**
 * Windows directory symlinks require a privilege that junctions do not. The
 * staging targets are existing absolute directories, so junctions preserve
 * dependency lookup without requiring Developer Mode or elevation.
 */
export const linkDirectory = (
  fileSystem: FileSystem.FileSystem,
  targetPath: string,
  linkPath: string,
  platform: NodeJS.Platform = process.platform
): Effect.Effect<void, PlatformError> =>
  platform === "win32"
    ? Effect.tryPromise({
        try: () => fs.promises.symlink(targetPath, linkPath, "junction"),
        catch: cause => mapNodeSymlinkError(cause, linkPath),
      })
    : fileSystem.symlink(targetPath, linkPath);

/**
 * Links the nearest `node_modules` directory at or above
 * `dependencyDirectory` into `temporaryDirectory`.
 *
 * Bundling a user's spec and importing the resulting module resolves bare
 * dependencies (for example `zod` or `@rexeus/typeweaver-core`) relative to
 * the staged project. A directory under host temp has no project ancestor, so
 * the dependency tree is materialized explicitly. Walking upward mirrors
 * Node's own module resolution.
 */
export const linkNearestNodeModules = (
  fileSystem: FileSystem.FileSystem,
  dependencyDirectory: string,
  temporaryDirectory: string
): Effect.Effect<void, PlatformError> =>
  Effect.gen(function* () {
    let searchDirectory = path.resolve(dependencyDirectory);
    while (true) {
      const nodeModulesDirectory = path.join(searchDirectory, "node_modules");
      if (yield* fileSystem.exists(nodeModulesDirectory)) {
        yield* linkDirectory(
          fileSystem,
          nodeModulesDirectory,
          path.join(temporaryDirectory, "node_modules")
        );
        return;
      }

      const parentDirectory = path.dirname(searchDirectory);
      if (parentDirectory === searchDirectory) {
        return;
      }
      searchDirectory = parentDirectory;
    }
  });

export type StagedProjectParams = {
  readonly prefix: string;
  /** Canonical-or-resolvable paths the stage must not overlap. */
  readonly forbiddenRoots: readonly string[];
};

const canonicalizeOrThrow = (targetPath: string): string => {
  try {
    return canonicalizePathForContainment(targetPath, hostPathFs);
  } catch (cause) {
    if (isExpectedNodeSystemError(cause)) {
      throw new UnsafeStagingRootError({
        stagingRoot: targetPath,
        reason: "inspection-failed",
        cause,
      });
    }
    throw cause;
  }
};

/**
 * Proves that creating stage directories directly under `stagingParent` cannot
 * mutate the configured output, the project source, or the spec input
 * directory. A forbidden root that is an ancestor of (or equal to) the parent
 * would contain every stage, so it fails closed before any stage is created.
 */
export const assertStagingParentSafe = (
  stagingParent: string,
  forbiddenRoots: readonly string[]
): void => {
  const canonicalParent = canonicalizeOrThrow(stagingParent);
  for (const forbiddenRoot of forbiddenRoots) {
    const canonicalForbidden = canonicalizeOrThrow(forbiddenRoot);
    if (isSameOrDescendantOf(canonicalParent, canonicalForbidden)) {
      throw new UnsafeStagingRootError({
        stagingRoot: canonicalParent,
        reason: "not-disjoint",
        conflictingPath: canonicalForbidden,
      });
    }
  }
};

const prepareStagingParent = (forbiddenRoots: readonly string[]): string => {
  for (const forbiddenRoot of forbiddenRoots) {
    assertPathNotReservedForCoordination(forbiddenRoot);
  }
  const stagingParent = canonicalHostTempDirectory();
  ensureTrustedHostTempDirectory(stagingParent);
  assertStagingParentSafe(stagingParent, forbiddenRoots);
  return stagingParent;
};

/**
 * Runs `use` against a scoped project directory created directly under the
 * trusted system temp root. The stage is disjoint from the configured output
 * and project source and is removed on success, typed failure, defect, and
 * interruption through `makeTempDirectoryScoped`. The `FileSystem` instance is
 * passed in explicitly so service construction resolves it once and service
 * methods keep `R = never`.
 */
export const withStagedProject = <A, E, R>(
  fileSystem: FileSystem.FileSystem,
  params: StagedProjectParams,
  use: (temporaryDirectory: string) => Effect.Effect<A, E, R>
): Effect.Effect<
  A,
  | E
  | PlatformError
  | ReservedCoordinationPathError
  | UnsafeSharedTempDirectoryError
  | UnsafeStagingRootError,
  R
> =>
  Effect.scoped(
    Effect.gen(function* () {
      const stagingParent = yield* Effect.try({
        try: () => prepareStagingParent(params.forbiddenRoots),
        catch: error => {
          if (
            error instanceof ReservedCoordinationPathError ||
            error instanceof UnsafeSharedTempDirectoryError ||
            error instanceof UnsafeStagingRootError
          ) {
            return error;
          }
          throw error;
        },
      });

      const temporaryDirectory = yield* fileSystem.makeTempDirectoryScoped({
        directory: stagingParent,
        prefix: params.prefix,
      });
      for (const forbiddenRoot of params.forbiddenRoots) {
        const canonicalForbidden = canonicalizeOrThrow(forbiddenRoot);
        if (
          !areDisjointPaths(
            canonicalizeOrThrow(temporaryDirectory),
            canonicalForbidden
          )
        ) {
          throw new UnsafeStagingRootError({
            stagingRoot: temporaryDirectory,
            reason: "not-disjoint",
            conflictingPath: canonicalForbidden,
          });
        }
      }

      return yield* use(temporaryDirectory);
    })
  );
