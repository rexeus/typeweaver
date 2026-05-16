import { FileSystem } from "@effect/platform";
import type { PlatformError } from "@effect/platform/Error";
import { Effect } from "effect";
import { UnsafeCleanTargetError } from "../generators/errors/UnsafeCleanTargetError.js";
import { assertSafeCleanTarget } from "./cleanTargetGuard.js";

const isUnsafeCleanTargetError = (
  error: unknown
): error is UnsafeCleanTargetError =>
  typeof error === "object" &&
  error !== null &&
  (error as { readonly _tag?: unknown })._tag === "UnsafeCleanTargetError";

/**
 * Effect-wrapped clean-target check. Tagged `UnsafeCleanTargetError` is
 * surfaced on the failure channel; any other thrown error escapes as a
 * defect (programming bug).
 *
 * The guard's filesystem probes (`exists`, `realpathSync.native`) stay on
 * `node:fs` rather than the Effect-native `FileSystem` service because the
 * algorithm is sync top-to-bottom and `@effect/platform`'s `FileSystem`
 * surface is async-Effect — `Effect.runSync` over its `exists` raises an
 * `AsyncFiberException`. The probes are well-audited and isolated; the
 * deps-injection seam on `assertSafeCleanTargetWith` keeps the door open
 * for test substitution without paying the async tax in production.
 */
export const assertSafeCleanTargetEffect = (
  outputDir: string,
  currentWorkingDirectory: string
): Effect.Effect<void, UnsafeCleanTargetError> =>
  Effect.try({
    try: () => assertSafeCleanTarget(outputDir, currentWorkingDirectory),
    catch: (error) => {
      if (isUnsafeCleanTargetError(error)) {
        return error;
      }
      throw error;
    },
  });

export const removeOutputDir = (
  outputDir: string
): Effect.Effect<void, PlatformError, FileSystem.FileSystem> =>
  Effect.gen(function* () {
    const fileSystem = yield* FileSystem.FileSystem;
    const exists = yield* fileSystem.exists(outputDir);
    if (!exists) {
      return;
    }
    yield* fileSystem.remove(outputDir, { recursive: true, force: true });
  });

export const ensureOutputDirectories = (params: {
  readonly outputDir: string;
  readonly responsesOutputDir: string;
  readonly specOutputDir: string;
}): Effect.Effect<void, PlatformError, FileSystem.FileSystem> =>
  Effect.gen(function* () {
    const fileSystem = yield* FileSystem.FileSystem;
    yield* fileSystem.makeDirectory(params.outputDir, { recursive: true });
    yield* fileSystem.makeDirectory(params.responsesOutputDir, {
      recursive: true,
    });
    yield* fileSystem.makeDirectory(params.specOutputDir, { recursive: true });
  });

