import fs from "node:fs";
import path from "node:path";
import { UnsafeCleanTargetError } from "../generators/errors/UnsafeCleanTargetError.js";

/**
 * Filesystem probes the clean-target guard depends on. Kept narrow so tests
 * and Effect-native callers can substitute fakes (the FileSystem service)
 * without dragging in unrelated `fs` surface.
 */
export type CleanTargetFs = {
  readonly exists: (probePath: string) => boolean;
  readonly realPath: (probePath: string) => string;
};

const defaultCleanTargetFs: CleanTargetFs = {
  exists: probePath => fs.existsSync(probePath),
  realPath: probePath => fs.realpathSync.native(probePath),
};

const findProtectedWorkspaceRoot = (
  startDirectory: string,
  fileSystem: CleanTargetFs
): string | undefined => {
  let currentDirectory = startDirectory;

  while (true) {
    if (hasWorkspaceMarker(currentDirectory, fileSystem)) {
      return currentDirectory;
    }

    const parentDirectory = path.dirname(currentDirectory);
    if (parentDirectory === currentDirectory) {
      return undefined;
    }

    currentDirectory = parentDirectory;
  }
};

const fileOnlyWorkspaceMarkers = [
  ".git",
  "pnpm-workspace.yaml",
  "lerna.json",
  "nx.json",
  "turbo.json",
  "rush.json",
] as const;

const hasWorkspacesField = (packageJsonPath: string): boolean => {
  try {
    const contents = fs.readFileSync(packageJsonPath, "utf8");
    const parsed: unknown = JSON.parse(contents);
    if (typeof parsed !== "object" || parsed === null) {
      return false;
    }

    return Boolean((parsed as { workspaces?: unknown }).workspaces);
  } catch {
    // A malformed package.json does not make a directory a workspace root
    // for the purposes of this guard. Treat parse failure as "no marker".
    return false;
  }
};

const hasWorkspaceMarker = (
  directory: string,
  fileSystem: CleanTargetFs
): boolean => {
  const hasFileMarker = fileOnlyWorkspaceMarkers.some(marker =>
    fileSystem.exists(path.join(directory, marker))
  );
  if (hasFileMarker) {
    return true;
  }

  const packageJsonPath = path.join(directory, "package.json");
  if (!fileSystem.exists(packageJsonPath)) {
    return false;
  }

  return hasWorkspacesField(packageJsonPath);
};

const canonicalizePathForContainment = (
  targetPath: string,
  fileSystem: CleanTargetFs
): string => {
  const remainingSegments: string[] = [];
  let nearestExistingPath = path.resolve(targetPath);

  while (!fileSystem.exists(nearestExistingPath)) {
    const parentPath = path.dirname(nearestExistingPath);
    if (parentPath === nearestExistingPath) {
      break;
    }

    remainingSegments.unshift(path.basename(nearestExistingPath));
    nearestExistingPath = parentPath;
  }

  const canonicalExistingPath = fileSystem.realPath(nearestExistingPath);

  return path.join(canonicalExistingPath, ...remainingSegments);
};

const isSameOrDescendantOf = (directory: string, ancestor: string): boolean => {
  const relativePath = path.relative(ancestor, directory);
  const parentTraversalPrefix = `..${path.sep}`;
  const escapesAncestor =
    relativePath === ".." || relativePath.startsWith(parentTraversalPrefix);

  return (
    relativePath === "" || (!escapesAncestor && !path.isAbsolute(relativePath))
  );
};

/**
 * Guard the destructive clean step against catastrophic targets. Inject
 * filesystem probes via `fileSystem` to keep the algorithm pure-core:
 *   - empty / whitespace-only paths
 *   - filesystem root
 *   - the current working directory itself
 *   - an inferred workspace root (`.git`, `pnpm-workspace.yaml`, `lerna.json`,
 *     `nx.json`, `turbo.json`, `rush.json`, or a `package.json` declaring
 *     workspaces)
 *   - any ancestor of the current working directory within the workspace
 *
 * Symlinks are resolved before comparison so a symlinked output directory
 * pointing at a protected location is still rejected.
 */
export const assertSafeCleanTargetWith = (
  outputDir: string,
  currentWorkingDirectory: string,
  fileSystem: CleanTargetFs,
  inputFile?: string
): void => {
  const trimmedOutputDir = outputDir.trim();
  if (trimmedOutputDir.length === 0) {
    throw new UnsafeCleanTargetError({
      outputDir,
      reason: "empty-path",
    });
  }

  const resolvedWorkingDirectory = path.resolve(currentWorkingDirectory);
  const canonicalWorkingDirectory = fileSystem.realPath(
    resolvedWorkingDirectory
  );
  const resolvedOutputDir = path.resolve(
    resolvedWorkingDirectory,
    trimmedOutputDir
  );
  const canonicalOutputDir = canonicalizePathForContainment(
    resolvedOutputDir,
    fileSystem
  );
  const filesystemRoot = path.parse(canonicalOutputDir).root;

  if (canonicalOutputDir === filesystemRoot) {
    throw new UnsafeCleanTargetError({
      outputDir,
      reason: "filesystem-root",
      resolvedOutputDir,
      currentWorkingDirectory: resolvedWorkingDirectory,
      filesystemRoot,
    });
  }

  if (
    resolvedOutputDir === resolvedWorkingDirectory ||
    canonicalOutputDir === canonicalWorkingDirectory
  ) {
    throw new UnsafeCleanTargetError({
      outputDir,
      reason: "current-working-directory",
      resolvedOutputDir,
      currentWorkingDirectory: resolvedWorkingDirectory,
    });
  }

  const logicalProtectedWorkspaceRoot = findProtectedWorkspaceRoot(
    resolvedWorkingDirectory,
    fileSystem
  );
  const canonicalProtectedWorkspaceRoot = findProtectedWorkspaceRoot(
    canonicalWorkingDirectory,
    fileSystem
  );
  const protectedWorkspaceRoots = [
    logicalProtectedWorkspaceRoot,
    canonicalProtectedWorkspaceRoot,
  ].filter((root): root is string => root !== undefined);
  const protectedWorkspaceRootTarget = protectedWorkspaceRoots.find(
    protectedWorkspaceRoot =>
      resolvedOutputDir === protectedWorkspaceRoot ||
      canonicalOutputDir === fileSystem.realPath(protectedWorkspaceRoot)
  );

  if (protectedWorkspaceRootTarget !== undefined) {
    throw new UnsafeCleanTargetError({
      outputDir,
      reason: "workspace-root",
      resolvedOutputDir,
      currentWorkingDirectory: resolvedWorkingDirectory,
      protectedWorkspaceRoot: protectedWorkspaceRootTarget,
    });
  }

  if (
    protectedWorkspaceRoots.length > 0 &&
    (isSameOrDescendantOf(resolvedWorkingDirectory, resolvedOutputDir) ||
      isSameOrDescendantOf(canonicalWorkingDirectory, canonicalOutputDir))
  ) {
    throw new UnsafeCleanTargetError({
      outputDir,
      reason: "ancestor-of-current-working-directory",
      resolvedOutputDir,
      currentWorkingDirectory: resolvedWorkingDirectory,
    });
  }

  // Reject when the spec input file lives inside the clean target. Without
  // this check, `typeweaver generate --input spec/index.ts --output spec`
  // deletes the source before bundling runs.
  if (inputFile !== undefined) {
    const canonicalInputFile = canonicalizePathForContainment(
      path.resolve(resolvedWorkingDirectory, inputFile),
      fileSystem
    );
    if (isSameOrDescendantOf(canonicalInputFile, canonicalOutputDir)) {
      throw new UnsafeCleanTargetError({
        outputDir,
        reason: "contains-input-file",
        resolvedOutputDir,
        currentWorkingDirectory: resolvedWorkingDirectory,
        inputFile: canonicalInputFile,
      });
    }
  }

  // Defense in depth: a target outside the workspace inferred from cwd is
  // not necessarily safe. If the target directory itself carries a workspace
  // marker, cleaning it would destroy a workspace — reject before any rm
  // runs.
  if (hasWorkspaceMarker(canonicalOutputDir, fileSystem)) {
    throw new UnsafeCleanTargetError({
      outputDir,
      reason: "target-carries-workspace-marker",
      resolvedOutputDir,
      currentWorkingDirectory: resolvedWorkingDirectory,
      protectedWorkspaceRoot: canonicalOutputDir,
    });
  }
};

/**
 * Convenience wrapper that uses the real Node filesystem. Preferred by
 * unit tests that exercise the guard against real on-disk fixtures.
 */
export const assertSafeCleanTarget = (
  outputDir: string,
  currentWorkingDirectory: string,
  inputFile?: string
): void =>
  assertSafeCleanTargetWith(
    outputDir,
    currentWorkingDirectory,
    defaultCleanTargetFs,
    inputFile
  );
