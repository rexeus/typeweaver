import path from "node:path";
import { Effect, FileSystem, Result } from "effect";
import {
  InitFileConflictError,
  ProjectInitRollbackError,
} from "../../errors/ProjectInitError.js";
import {
  collectMissingDirectories,
  rollbackFiles,
} from "./projectPublishingSupport.js";
import { fileSystemError } from "./projectPublishingTypes.js";
import type { ProjectInitFailure } from "../../errors/ProjectInitError.js";
import type {
  CommittedFile,
  PlannedInitFile,
  PublishProjectParams,
} from "./projectPublishingTypes.js";

const restoreCurrentFile = (
  fileSystem: FileSystem.FileSystem,
  targetPath: string,
  backupPath: string
) =>
  fileSystem
    .rename(backupPath, targetPath)
    .pipe(Effect.mapError(fileSystemError("rename", targetPath)));

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

const rememberCommittedFile = (
  committedFiles: CommittedFile[],
  committedFile: CommittedFile
): Effect.Effect<void> =>
  Effect.sync(() => {
    committedFiles.push(committedFile);
  });

export const publishProject = (
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
        commitFile(fileSystem, { ...params, file }).pipe(
          Effect.tap(committedFile =>
            rememberCommittedFile(committedFiles, committedFile)
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
