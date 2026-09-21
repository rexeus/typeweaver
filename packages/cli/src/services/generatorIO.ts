import { Effect, FileSystem } from "effect";
import {
  CleanTargetInspectionError,
  UnsafeCleanTargetError,
} from "../errors/index.js";
import {
  assertSafeCleanTarget,
  assertSafeCleanTargetWith,
} from "./cleanTargetGuard.js";
import {
  cleanOutputDirPreservingLock,
  sweepOrphanTempdirs,
} from "./internal/generatorOutputCleanup.js";
import {
  releaseOutputLock,
  releaseOutputLockStrict,
} from "./internal/generatorOutputLocks.js";
import { isExpectedNodeSystemError } from "./internal/nodeFsErrors.js";
import {
  acquireOutputLock,
  acquireOutputLockWith,
} from "./internal/outputLockAcquisition.js";
import type { CleanTargetFs } from "./cleanTargetGuard.js";
import type { OutputLock } from "./internal/outputLockAcquisition.js";

export type { OutputLock };
export { acquireOutputLock, acquireOutputLockWith };
export {
  cleanOutputDirPreservingLock,
  releaseOutputLock,
  releaseOutputLockStrict,
  sweepOrphanTempdirs,
};

export const assertSafeCleanTargetEffect = (
  outputDir: string,
  currentWorkingDirectory: string,
  inputFile?: string
): Effect.Effect<void, UnsafeCleanTargetError | CleanTargetInspectionError> =>
  Effect.try({
    try: () =>
      assertSafeCleanTarget(outputDir, currentWorkingDirectory, inputFile),
    catch: error => {
      if (error instanceof UnsafeCleanTargetError) return error;
      if (isExpectedNodeSystemError(error)) {
        return new CleanTargetInspectionError({ outputDir, cause: error });
      }
      throw error;
    },
  });

export const assertSafeCleanTargetEffectWith = (
  outputDir: string,
  currentWorkingDirectory: string,
  fileSystem: CleanTargetFs,
  inputFile?: string
): Effect.Effect<void, UnsafeCleanTargetError | CleanTargetInspectionError> =>
  Effect.try({
    try: () =>
      assertSafeCleanTargetWith(
        outputDir,
        currentWorkingDirectory,
        fileSystem,
        inputFile
      ),
    catch: error => {
      if (error instanceof UnsafeCleanTargetError) return error;
      if (isExpectedNodeSystemError(error)) {
        return new CleanTargetInspectionError({ outputDir, cause: error });
      }
      throw error;
    },
  });

export const removeOutputDir = (outputDir: string) =>
  Effect.gen(function* () {
    const fileSystem = yield* FileSystem.FileSystem;
    if (yield* fileSystem.exists(outputDir)) {
      yield* fileSystem.remove(outputDir, { recursive: true, force: true });
    }
  });

export const ensureOutputDirectories = (params: {
  readonly outputDir: string;
  readonly responsesOutputDir: string;
  readonly specOutputDir: string;
}) =>
  Effect.gen(function* () {
    const fileSystem = yield* FileSystem.FileSystem;
    yield* fileSystem.makeDirectory(params.outputDir, { recursive: true });
    yield* fileSystem.makeDirectory(params.responsesOutputDir, {
      recursive: true,
    });
    yield* fileSystem.makeDirectory(params.specOutputDir, { recursive: true });
  });
