import { defaultCleanTargetFs } from "./cleanTargetTypes.js";
import { assertSafeCleanTargetWith } from "./cleanTargetValidation.js";
import type { CleanTargetFs } from "./cleanTargetTypes.js";

export type { CleanTargetFs };
export { assertSafeCleanTargetWith };

/**
 * Guard destructive output operations against catastrophic targets.
 * Convenience wrapper over `assertSafeCleanTargetWith` that uses the real Node
 * filesystem; see it for the rejected targets.
 */
export const assertSafeCleanTarget = (
  outputDir: string,
  currentWorkingDirectory: string,
  inputFile?: string
): void =>
  assertSafeCleanTargetWith(
    outputDir,
    currentWorkingDirectory,
    defaultCleanTargetFs satisfies CleanTargetFs,
    inputFile
  );
