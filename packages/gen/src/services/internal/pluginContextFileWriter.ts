import fs from "node:fs";
import path from "node:path";
import {
  ATOMIC_WRITE_TEMP_DIRECTORY_PREFIX,
  coordinationArtifactMarkerSource,
  TYPEWEAVER_COORDINATION_MARKER_FILE,
} from "../../helpers/coordinationArtifact.js";
import type { SafeGeneratedFilePath } from "../../helpers/pathSafety.js";

/**
 * Per-call tracker over the set of generated file paths. Each
 * `createPluginContextBuilder` invocation gets its own tracker so concurrent
 * generation runs cannot observe one another's state.
 *
 * `drainPendingWriteLogs` returns (and clears) the paths written via
 * `writeFile` since the previous drain. The Effect-native orchestrator
 * flushes this queue through `Effect.logInfo` after each plugin's
 * `generate` stage — the sync write callback itself runs outside any
 * Effect runtime, so it cannot log through the configured logger directly.
 */
export type GeneratedFilesTracker = {
  readonly add: (filePath: string) => void;
  readonly recordWrite: (filePath: string) => void;
  readonly snapshot: () => readonly string[];
  readonly drainPendingWriteLogs: () => readonly string[];
};
export const createGeneratedFilesTracker = (): GeneratedFilesTracker => {
  const generatedFiles = new Set<string>();
  let pendingWriteLogs: string[] = [];
  return {
    add: filePath => generatedFiles.add(filePath),
    recordWrite: filePath => {
      generatedFiles.add(filePath);
      pendingWriteLogs.push(filePath);
    },
    snapshot: () => Array.from(generatedFiles).sort(),
    drainPendingWriteLogs: () => {
      const drained = pendingWriteLogs;
      pendingWriteLogs = [];
      return drained;
    },
  };
};
/**
 * Narrow sync filesystem port for the contractually synchronous plugin writer.
 * It stays internal to `@rexeus/typeweaver-gen`: plugin authors continue to
 * consume only `GeneratorContext.writeFile`.
 */
export type SyncAtomicFileSystem = {
  readonly getExistingFileMode: (absolutePath: string) => number | undefined;
  readonly makeTempDirectory: (prefixPath: string) => string;
  readonly writeFileExclusive: (
    filePath: string,
    content: string,
    mode: number
  ) => void;
  readonly chmod: (filePath: string, mode: number) => void;
  readonly rename: (oldPath: string, newPath: string) => void;
  readonly removeDirectory: (dirPath: string) => void;
};
export const liveSyncAtomicFileSystem: SyncAtomicFileSystem = {
  getExistingFileMode: absolutePath => {
    let pathStats: fs.Stats;
    try {
      pathStats = fs.lstatSync(absolutePath);
    } catch (error) {
      if (
        error instanceof Error &&
        "code" in error &&
        (error.code === "ENOENT" || error.code === "ENOTDIR")
      )
        return undefined;
      throw error;
    }
    return pathStats.isFile() ? pathStats.mode & 0o777 : undefined;
  },
  makeTempDirectory: prefixPath => fs.mkdtempSync(prefixPath),
  writeFileExclusive: (filePath, content, mode) =>
    fs.writeFileSync(filePath, content, { flag: "wx", mode }),
  chmod: (filePath, mode) => fs.chmodSync(filePath, mode),
  rename: (oldPath, newPath) => fs.renameSync(oldPath, newPath),
  removeDirectory: dirPath =>
    fs.rmSync(dirPath, { recursive: true, force: true }),
};
/**
 * Publishes a generated file through a temporary sibling directory and rename.
 * The destination is revalidated immediately before publication, preserving
 * path-safety checks across the unavoidable pathname-based rename race. The
 * narrow filesystem port keeps mode preservation and cleanup injectable.
 *
 * Sync twin of `writeFileViaTempReplaceEffect` for the contractually sync
 * plugin-author surface (ADR 0003/0004). Same atomic-replace pattern (mkdtemp
 * + write + chmod preservation + rename). Every plugin write still funnels
 * through `pathSafety.validateGeneratedPath(...)`, so path traversal cannot
 * reach this surface.
 */
export const writeFileViaTempReplaceWith = (
  fileSystem: SyncAtomicFileSystem,
  config: {
    readonly content: string;
    readonly revalidateDestination: () => SafeGeneratedFilePath;
    readonly onCommit: (generatedPath: string) => void;
  }
): void => {
  const stagingPath = config.revalidateDestination();
  const existingFileMode = fileSystem.getExistingFileMode(stagingPath.fullPath);
  const destinationDir = path.dirname(stagingPath.fullPath);
  const tempDir = fileSystem.makeTempDirectory(
    path.join(destinationDir, ATOMIC_WRITE_TEMP_DIRECTORY_PREFIX)
  );
  const tempFile = path.join(tempDir, "generated.tmp");
  try {
    fileSystem.writeFileExclusive(
      path.join(tempDir, TYPEWEAVER_COORDINATION_MARKER_FILE),
      coordinationArtifactMarkerSource("atomic-write-temp"),
      0o600
    );
    fileSystem.writeFileExclusive(
      tempFile,
      config.content,
      existingFileMode ?? 0o666
    );
    if (existingFileMode !== undefined)
      fileSystem.chmod(tempFile, existingFileMode);
    // Re-probe immediately before publication. This rejects ancestor symlink
    // swaps visible at check time and narrows the unavoidable race window of
    // Node's pathname-based rename API.
    const publishPath = config.revalidateDestination();
    // Both operations are synchronous: once rename publishes the destination,
    // record the write before any fallible cleanup can run. A cleanup-only
    // failure may still be reported, but it cannot leave a committed file
    // absent from the generated-file tracker and pending log queue.
    fileSystem.rename(tempFile, publishPath.fullPath);
    config.onCommit(publishPath.generatedPath);
  } catch (operationError) {
    try {
      fileSystem.removeDirectory(tempDir);
    } catch {
      // Preserve the writer's original failure: a cleanup error is secondary
      // and must not erase the rename/write defect callers need to diagnose.
    }
    throw operationError;
  }
  fileSystem.removeDirectory(tempDir);
};
