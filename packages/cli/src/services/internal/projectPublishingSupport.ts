import path from "node:path";
import { Effect, FileSystem } from "effect";
import { fileSystemError } from "./projectPublishingTypes.js";
import type { ProjectInitFileSystemError } from "../../errors/ProjectInitError.js";
import type {
  CommittedFile,
  PlannedInitFile,
} from "./projectPublishingTypes.js";

export const findNearestExistingDirectory = (
  fileSystem: FileSystem.FileSystem,
  startPath: string
): Effect.Effect<string, ProjectInitFileSystemError> =>
  Effect.gen(function* () {
    let candidate = startPath;
    while (true) {
      if (
        yield* fileSystem
          .exists(candidate)
          .pipe(Effect.mapError(fileSystemError("exists", candidate)))
      ) {
        return candidate;
      }
      const parent = path.dirname(candidate);
      if (parent === candidate) return candidate;
      candidate = parent;
    }
  });

export const writeStagingTree = (
  fileSystem: FileSystem.FileSystem,
  stagingDir: string,
  plan: readonly PlannedInitFile[]
): Effect.Effect<void, ProjectInitFileSystemError> =>
  Effect.forEach(
    plan,
    file => {
      const stagedPath = path.join(stagingDir, "new", file.path);
      const stagedDirectory = path.dirname(stagedPath);
      return fileSystem
        .makeDirectory(stagedDirectory, { recursive: true })
        .pipe(
          Effect.mapError(fileSystemError("makeDirectory", stagedDirectory)),
          Effect.andThen(
            fileSystem
              .writeFileString(stagedPath, file.content, { flag: "wx" })
              .pipe(Effect.mapError(fileSystemError("writeFile", stagedPath)))
          )
        );
    },
    { concurrency: 1, discard: true }
  );

export const collectMissingDirectories = (
  fileSystem: FileSystem.FileSystem,
  targetDir: string,
  plan: readonly PlannedInitFile[]
): Effect.Effect<readonly string[], ProjectInitFileSystemError> =>
  Effect.gen(function* () {
    const candidates = new Set<string>();
    for (const file of plan) {
      let candidate = path.dirname(path.join(targetDir, file.path));
      while (candidate.startsWith(targetDir)) {
        candidates.add(candidate);
        if (candidate === targetDir) break;
        candidate = path.dirname(candidate);
      }
    }
    let ancestor = path.dirname(targetDir);
    while (true) {
      const exists = yield* fileSystem
        .exists(ancestor)
        .pipe(Effect.mapError(fileSystemError("exists", ancestor)));
      if (exists) break;
      candidates.add(ancestor);
      const parent = path.dirname(ancestor);
      if (parent === ancestor) break;
      ancestor = parent;
    }
    const missing = yield* Effect.filter(
      [...candidates],
      candidate =>
        fileSystem.exists(candidate).pipe(
          Effect.map(exists => !exists),
          Effect.mapError(fileSystemError("exists", candidate))
        ),
      { concurrency: 1 }
    );
    return missing.sort((left, right) => right.length - left.length);
  });

export const rollbackFiles = (
  fileSystem: FileSystem.FileSystem,
  committedFiles: readonly CommittedFile[],
  missingDirectories: readonly string[]
): Effect.Effect<void, ProjectInitFileSystemError> =>
  Effect.gen(function* () {
    for (const file of [...committedFiles].reverse()) {
      yield* fileSystem
        .remove(file.targetPath, { force: true })
        .pipe(Effect.mapError(fileSystemError("remove", file.targetPath)));
      if (file.backupPath !== undefined) {
        yield* fileSystem
          .rename(file.backupPath, file.targetPath)
          .pipe(Effect.mapError(fileSystemError("rename", file.targetPath)));
      }
    }
    for (const directory of missingDirectories) {
      if (
        !(yield* fileSystem
          .exists(directory)
          .pipe(Effect.mapError(fileSystemError("exists", directory))))
      ) {
        continue;
      }
      const entries = yield* fileSystem
        .readDirectory(directory)
        .pipe(Effect.mapError(fileSystemError("readDirectory", directory)));
      if (entries.length === 0) {
        yield* fileSystem
          .remove(directory)
          .pipe(Effect.mapError(fileSystemError("remove", directory)));
      }
    }
  });
