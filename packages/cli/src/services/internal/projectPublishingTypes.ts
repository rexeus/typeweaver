import { ProjectInitFileSystemError } from "../../errors/ProjectInitError.js";
import type { ProjectInitFileSystemOperation } from "../../errors/ProjectInitError.js";
import type { PlatformError } from "effect/PlatformError";

export type PlannedInitFile = {
  readonly path: string;
  readonly content: string;
};

export type CommittedFile = {
  readonly targetPath: string;
  readonly backupPath?: string;
};

export type PublishProjectParams = {
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
