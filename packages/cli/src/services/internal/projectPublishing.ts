import path from "node:path";
import { Effect, FileSystem, Result } from "effect";
import {
  InitFileConflictError,
  ProjectInitFileSystemError,
  ProjectInitRollbackError,
} from "../../errors/ProjectInitError.js";
import type {
  ProjectInitFailure,
  ProjectInitFileSystemOperation,
} from "../../errors/ProjectInitError.js";
import type { PlatformError } from "effect/PlatformError";

/**
 * File publication, staging-tree writing, and rollback helpers for project
 * initialization. Split from `ProjectInitializer` so each module stays within
 * the repository file-length budget.
 */

export type PlannedInitFile = {
  readonly path: string;
  readonly content: string;
};

type CommittedFile = {
  readonly targetPath: string;
  readonly backupPath?: string;
};
type PublishProjectParams = {
  readonly targetDir: string;
  readonly stagingDir: string;
  readonly plan: readonly PlannedInitFile[];
  readonly force: boolean;
};

export const fileSystemError =
  (operation: ProjectInitFileSystemOperation, targetPath: string) =>
  (cause: PlatformError): ProjectInitFileSystemError =>
    new ProjectInitFileSystemError({
      operation,
      path: targetPath,
      cause,
    });

const findNearestExistingDirectory = (
  fileSystem: FileSystem.FileSystem,
  startPath: string
): Effect.Effect<string, ProjectInitFileSystemError> =>
  Effect.gen(function* () {
    let candidate = startPath;
    while (true) {
      const exists = yield* fileSystem
        .exists(candidate)
        .pipe(Effect.mapError(fileSystemError("exists", candidate)));
      if (exists) return candidate;
      const parent = path.dirname(candidate);
      if (parent === candidate) return candidate;
      candidate = parent;
    }
  });

const writeStagingTree = (
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

const collectMissingDirectories = (
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

const restoreCurrentFile = (
  fileSystem: FileSystem.FileSystem,
  targetPath: string,
  backupPath: string
): Effect.Effect<void, ProjectInitFileSystemError> =>
  fileSystem
    .rename(backupPath, targetPath)
    .pipe(Effect.mapError(fileSystemError("rename", targetPath)));

const commitFile = (
  fileSystem: FileSystem.FileSystem,
  params: Omit<PublishProjectParams, "plan"> & {
    readonly file: PlannedInitFile;
  }
): Effect.Effect<CommittedFile, ProjectInitFailure> =>
  Effect.gen(function* () {
    const targetPath = path.join(params.targetDir, params.file.path);
    const stagedPath = path.join(params.stagingDir, "new", params.file.path);
    const targetExists = yield* fileSystem
      .exists(targetPath)
      .pipe(Effect.mapError(fileSystemError("exists", targetPath)));
    if (targetExists && !params.force) {
      return yield* new InitFileConflictError({ filePath: targetPath });
    }

    yield* fileSystem
      .makeDirectory(path.dirname(targetPath), { recursive: true })
      .pipe(
        Effect.mapError(
          fileSystemError("makeDirectory", path.dirname(targetPath))
        )
      );
    if (!targetExists) {
      yield* fileSystem
        .rename(stagedPath, targetPath)
        .pipe(Effect.mapError(fileSystemError("rename", targetPath)));
      return { targetPath };
    }

    return yield* overwriteExistingFile(
      fileSystem,
      params,
      targetPath,
      stagedPath
    );
  });

const overwriteExistingFile = (
  fileSystem: FileSystem.FileSystem,
  params: Omit<PublishProjectParams, "plan"> & {
    readonly file: PlannedInitFile;
  },
  targetPath: string,
  stagedPath: string
): Effect.Effect<CommittedFile, ProjectInitFailure> =>
  Effect.gen(function* () {
    const backupPath = path.join(params.stagingDir, "backup", params.file.path);
    yield* fileSystem
      .makeDirectory(path.dirname(backupPath), { recursive: true })
      .pipe(
        Effect.mapError(
          fileSystemError("makeDirectory", path.dirname(backupPath))
        )
      );
    yield* fileSystem
      .rename(targetPath, backupPath)
      .pipe(Effect.mapError(fileSystemError("rename", targetPath)));
    const published = yield* fileSystem
      .rename(stagedPath, targetPath)
      .pipe(
        Effect.mapError(fileSystemError("rename", targetPath)),
        Effect.result
      );
    if (Result.isFailure(published)) {
      const restored = yield* restoreCurrentFile(
        fileSystem,
        targetPath,
        backupPath
      ).pipe(Effect.result);
      if (Result.isFailure(restored)) {
        return yield* new ProjectInitRollbackError({
          targetDir: params.targetDir,
          originalCause: published.failure,
          rollbackCause: restored.failure,
          recoveryPath: backupPath,
        });
      }
      return yield* published.failure;
    }
    return { targetPath, backupPath };
  });

const rollbackFiles = (
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
      const exists = yield* fileSystem
        .exists(directory)
        .pipe(Effect.mapError(fileSystemError("exists", directory)));
      if (!exists) continue;
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

const pushCommittedFile = (
  committedFiles: CommittedFile[],
  committedFile: CommittedFile
): Effect.Effect<void> =>
  Effect.sync(() => {
    committedFiles.push(committedFile);
  });

const publishProject = (
  fileSystem: FileSystem.FileSystem,
  params: PublishProjectParams
): Effect.Effect<void, ProjectInitFailure> =>
  Effect.gen(function* () {
    const missingDirectories = yield* collectMissingDirectories(
      fileSystem,
      params.targetDir,
      params.plan
    );
    const committedFiles: CommittedFile[] = [];
    const committed = yield* Effect.forEach(
      params.plan,
      file =>
        commitFile(fileSystem, {
          targetDir: params.targetDir,
          stagingDir: params.stagingDir,
          file,
          force: params.force,
        }).pipe(
          Effect.tap(committedFile =>
            pushCommittedFile(committedFiles, committedFile)
          )
        ),
      { concurrency: 1, discard: true }
    ).pipe(Effect.result);
    if (Result.isSuccess(committed)) return;

    const rolledBack = yield* rollbackFiles(
      fileSystem,
      committedFiles,
      missingDirectories
    ).pipe(Effect.result);
    if (Result.isFailure(rolledBack)) {
      return yield* new ProjectInitRollbackError({
        targetDir: params.targetDir,
        originalCause: committed.failure,
        rollbackCause: rolledBack.failure,
        recoveryPath: path.join(params.stagingDir, "backup"),
      });
    }
    return yield* committed.failure;
  }).pipe(Effect.uninterruptible);

export const executePlan = (
  fileSystem: FileSystem.FileSystem,
  targetDir: string,
  plan: readonly PlannedInitFile[],
  force: boolean
): Effect.Effect<void, ProjectInitFailure> =>
  Effect.gen(function* () {
    const stagingParent = yield* findNearestExistingDirectory(
      fileSystem,
      path.dirname(targetDir)
    );
    let preserveStaging = false;
    const preserveStagingOnRollback = (): void => {
      preserveStaging = true;
    };
    yield* Effect.acquireUseRelease(
      fileSystem
        .makeTempDirectory({
          directory: stagingParent,
          prefix: `.typeweaver-init-${path.basename(targetDir)}-`,
        })
        .pipe(
          Effect.mapError(fileSystemError("makeTempDirectory", stagingParent))
        ),
      stagingDir =>
        writeStagingTree(fileSystem, stagingDir, plan).pipe(
          Effect.andThen(
            publishProject(fileSystem, {
              targetDir,
              stagingDir,
              plan,
              force,
            })
          ),
          Effect.tapError(failure =>
            failure._tag === "ProjectInitRollbackError"
              ? Effect.sync(preserveStagingOnRollback)
              : Effect.void
          )
        ),
      stagingDir =>
        preserveStaging
          ? Effect.void
          : fileSystem
              .remove(stagingDir, { recursive: true, force: true })
              .pipe(
                Effect.mapError(fileSystemError("remove", stagingDir)),
                Effect.orDie
              )
    );
  });
