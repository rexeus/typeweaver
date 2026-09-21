import { defaultCleanTargetFs } from "./cleanTargetTypes.js";
import { assertSafeCleanTargetWith } from "./cleanTargetValidation.js";
import type { CleanTargetFs } from "./cleanTargetTypes.js";

export type { CleanTargetFs };
export { assertSafeCleanTargetWith };

/** Guard destructive output operations against catastrophic targets. */
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
