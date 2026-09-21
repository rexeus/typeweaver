import fs from "node:fs";
import path from "node:path";
import { Effect } from "effect";
import { OutputCleanError } from "../../errors/index.js";
import { isExpectedNodeSystemError, errnoCode } from "./nodeFsErrors.js";
import {
  hasCoordinationArtifactMarker,
  isLiveLegacyOutputLock,
} from "./outputCoordinationArtifact.js";

export const cleanOutputDirPreservingLock = (
  outputDir: string
): Effect.Effect<void, OutputCleanError> =>
  Effect.try({
    try: () => {
      if (!fs.existsSync(outputDir)) return;
      for (const entry of fs.readdirSync(outputDir, { withFileTypes: true })) {
        const entryPath = path.join(outputDir, entry.name);
        if (
          entry.isDirectory() &&
          isLiveLegacyOutputLock(entryPath, entry.name)
        ) {
          continue;
        }
        fs.rmSync(entryPath, { recursive: true, force: true });
      }
    },
    catch: cause => {
      if (isExpectedNodeSystemError(cause)) {
        return new OutputCleanError({ outputDir, cause });
      }
      throw cause;
    },
  });

export const sweepOrphanTempdirs = (outputDir: string): Effect.Effect<void> =>
  Effect.try(() => {
    if (fs.existsSync(outputDir)) sweepOrphanTempdirsAt(outputDir);
  }).pipe(
    Effect.catch(failure =>
      Effect.logWarning(
        `Failed to sweep orphan tempdirs under '${outputDir}': ${failure.message}`
      )
    )
  );

const sweepOrphanTempdirsAt = (directory: string): void => {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(directory, { withFileTypes: true });
  } catch (error) {
    if (errnoCode(error) === "ENOENT") return;
    throw error;
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const entryPath = path.join(directory, entry.name);
    if (isLiveLegacyOutputLock(entryPath, entry.name)) continue;
    if (hasCoordinationArtifactMarker(entryPath, entry.name)) {
      fs.rmSync(entryPath, { recursive: true, force: true });
      continue;
    }
    sweepOrphanTempdirsAt(entryPath);
  }
};
