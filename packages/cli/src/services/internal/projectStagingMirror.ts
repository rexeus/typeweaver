import fs from "node:fs";
import path from "node:path";
import { Effect, FileSystem } from "effect";
import { linkDirectory, withStagedProject } from "./projectStagingCore.js";
import type {
  ReservedCoordinationPathError,
  UnsafeSharedTempDirectoryError,
  UnsafeStagingRootError,
} from "../../errors/index.js";
import type { PlatformError } from "effect/PlatformError";

type AncestorNodeModulesLevel = {
  readonly level: number;
  readonly nodeModulesDirectory: string;
};

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
    if (parentDirectory === directory) break;
    directory = parentDirectory;
    level += 1;
  }
  return levels;
};

const ancestorAtLevel = (startPath: string, level: number): string => {
  let current = startPath;
  for (let index = 0; index < level; index += 1)
    current = path.dirname(current);
  return current;
};

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
        yield* linkDirectory(fileSystem, nodeModulesDirectory, linkPath);
      }
    }
    return stagedOutputDir;
  });

export type MirroredStage = {
  readonly stageRoot: string;
  readonly stagedOutputDir: string;
};

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
