import fs from "node:fs";
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
 */
export const assertSafeCleanTargetEffect = (
  outputDir: string,
  currentWorkingDirectory: string
): Effect.Effect<void, UnsafeCleanTargetError> =>
  Effect.try({
    try: () => assertSafeCleanTarget(outputDir, currentWorkingDirectory),
    catch: error => {
      if (isUnsafeCleanTargetError(error)) {
        return error;
      }
      throw error;
    },
  });

export const removeOutputDir = (outputDir: string): Effect.Effect<void> =>
  Effect.sync(() => {
    fs.rmSync(outputDir, { recursive: true, force: true });
  });

export const ensureOutputDirectories = (params: {
  readonly outputDir: string;
  readonly responsesOutputDir: string;
  readonly specOutputDir: string;
}): Effect.Effect<void> =>
  Effect.sync(() => {
    fs.mkdirSync(params.outputDir, { recursive: true });
    fs.mkdirSync(params.responsesOutputDir, { recursive: true });
    fs.mkdirSync(params.specOutputDir, { recursive: true });
  });
