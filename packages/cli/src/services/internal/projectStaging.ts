import fs from "node:fs";
import path from "node:path";
import { FileSystem } from "@effect/platform";
import { Effect } from "effect";
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
import { isExpectedNodeSystemError } from "./nodeFsErrors.js";
import type { PlatformError } from "@effect/platform/Error";

const hostPathFs = {
  exists: (probePath: string): boolean => fs.existsSync(probePath),
  realPath: (probePath: string): string => fs.realpathSync.native(probePath),
};

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
        yield* fileSystem.symlink(
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
  /**
   * When set, links the nearest `node_modules` from this directory into the
   * stage root (validation's pre-PR behavior). Omit for callers that build
   * their own dependency topology.
   */
  readonly dependencyDirectory?: string;
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

      if (params.dependencyDirectory !== undefined) {
        yield* linkNearestNodeModules(
          fileSystem,
          params.dependencyDirectory,
          temporaryDirectory
        );
      }
      return yield* use(temporaryDirectory);
    })
  );

type AncestorNodeModulesLevel = {
  readonly level: number;
  readonly nodeModulesDirectory: string;
};

/**
 * Finds every `node_modules` directory at or above the configured output,
 * excluding the output directory itself (level 0). Normal generation removes
 * `node_modules` inside the output when cleaning, and a `clean: false`
 * snapshot preserves that level verbatim, so it is never mirrored.
 */
const scanAncestorNodeModules = (
  configuredOutputDir: string
): readonly AncestorNodeModulesLevel[] => {
  const levels: AncestorNodeModulesLevel[] = [];
  let directory = path.resolve(configuredOutputDir);
  let level = 0;
  while (true) {
    if (level >= 1) {
      const nodeModulesDirectory = path.join(directory, "node_modules");
      if (fs.existsSync(nodeModulesDirectory)) {
        levels.push({ level, nodeModulesDirectory });
      }
    }
    const parentDirectory = path.dirname(directory);
    if (parentDirectory === directory) {
      break;
    }
    directory = parentDirectory;
    level += 1;
  }
  return levels;
};

const ancestorAtLevel = (startPath: string, level: number): string => {
  let current = startPath;
  for (let index = 0; index < level; index += 1) {
    current = path.dirname(current);
  }
  return current;
};

/**
 * Builds a nested staged output path and mirrors the original
 * `<configuredOutput>/spec/spec.js` ancestor lookup topology: every
 * `node_modules` directory Node would consult above the configured output is
 * symlinked at the corresponding staged ancestor level. This preserves lookup
 * order (including fallback past a partial nearer `node_modules`) instead of
 * resolving only the nearest directory.
 */
export const prepareMirroredOutput = (
  fileSystem: FileSystem.FileSystem,
  stageRoot: string,
  configuredOutputDir: string
): Effect.Effect<string, PlatformError> =>
  Effect.gen(function* () {
    const levels = scanAncestorNodeModules(configuredOutputDir);
    const deepestLevel = levels.reduce(
      (deepest, entry) => Math.max(deepest, entry.level),
      0
    );
    const mirrorSegments =
      deepestLevel <= 1
        ? []
        : Array.from(
            { length: deepestLevel - 1 },
            (_value, index) => `mirror-${String(index + 1)}`
          );
    const stagedOutputDir = path.join(stageRoot, ...mirrorSegments, "output");
    yield* fileSystem.makeDirectory(stagedOutputDir, { recursive: true });

    for (const { level, nodeModulesDirectory } of levels) {
      const linkPath = path.join(
        ancestorAtLevel(stagedOutputDir, level),
        "node_modules"
      );
      if (!(yield* fileSystem.exists(linkPath))) {
        yield* fileSystem.symlink(nodeModulesDirectory, linkPath);
      }
    }
    return stagedOutputDir;
  });

export type MirroredStage = {
  readonly stageRoot: string;
  readonly stagedOutputDir: string;
};

/**
 * Check-specific staging: a scoped stage plus a nested output whose ancestor
 * `node_modules` topology mirrors the configured output.
 */
export const withMirroredOutputStage = <A, E, R>(
  fileSystem: FileSystem.FileSystem,
  params: {
    readonly configuredOutputDir: string;
    readonly forbiddenRoots: readonly string[];
  },
  use: (stage: MirroredStage) => Effect.Effect<A, E, R>
): Effect.Effect<
  A,
  | E
  | PlatformError
  | ReservedCoordinationPathError
  | UnsafeSharedTempDirectoryError
  | UnsafeStagingRootError,
  R
> =>
  withStagedProject(
    fileSystem,
    {
      prefix: "typeweaver-check-",
      forbiddenRoots: params.forbiddenRoots,
    },
    stageRoot =>
      Effect.gen(function* () {
        const stagedOutputDir = yield* prepareMirroredOutput(
          fileSystem,
          stageRoot,
          params.configuredOutputDir
        );
        return yield* use({ stageRoot, stagedOutputDir });
      })
  );
