import path from "node:path";
import { Effect, FileSystem } from "effect";
import { publishProject } from "./projectPublishingCommit.js";
import {
  findNearestExistingDirectory,
  writeStagingTree,
} from "./projectPublishingSupport.js";
import { fileSystemError } from "./projectPublishingTypes.js";
import type { ProjectInitFailure } from "../../errors/ProjectInitError.js";
import type { PlannedInitFile } from "./projectPublishingTypes.js";

export type { PlannedInitFile };
export { fileSystemError };

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
