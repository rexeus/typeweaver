import fs from "node:fs";
import path from "node:path";
import { UnsafeCleanTargetError } from "../generators/errors/UnsafeCleanTargetError.js";

const findProtectedWorkspaceRoot = (
  startDirectory: string
): string | undefined => {
  let currentDirectory = startDirectory;

  while (true) {
    if (hasWorkspaceMarker(currentDirectory)) {
      return currentDirectory;
    }

    const parentDirectory = path.dirname(currentDirectory);
    if (parentDirectory === currentDirectory) {
      return undefined;
    }

    currentDirectory = parentDirectory;
  }
};

const hasWorkspaceMarker = (directory: string): boolean => {
  return ["pnpm-workspace.yaml", ".git"].some(marker =>
    fs.existsSync(path.join(directory, marker))
  );
};

const canonicalizePathForContainment = (targetPath: string): string => {
  const remainingSegments: string[] = [];
  let nearestExistingPath = path.resolve(targetPath);

  while (!fs.existsSync(nearestExistingPath)) {
    const parentPath = path.dirname(nearestExistingPath);
    if (parentPath === nearestExistingPath) {
      break;
    }

    remainingSegments.unshift(path.basename(nearestExistingPath));
    nearestExistingPath = parentPath;
  }

  const canonicalExistingPath = fs.realpathSync.native(nearestExistingPath);

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
 * Guard the destructive clean step against catastrophic targets:
 *   - empty / whitespace-only paths
 *   - filesystem root
 *   - the current working directory itself
 *   - an inferred workspace root (`.git` or `pnpm-workspace.yaml`)
 *   - any ancestor of the current working directory within the workspace
 *
 * Symlinks are resolved before comparison so a symlinked output directory
 * pointing at a protected location is still rejected.
 */
export const assertSafeCleanTarget = (
  outputDir: string,
  currentWorkingDirectory: string
): void => {
  const trimmedOutputDir = outputDir.trim();
  if (trimmedOutputDir.length === 0) {
    throw new UnsafeCleanTargetError({
      outputDir,
      reason: "empty-path",
    });
  }

  const resolvedWorkingDirectory = path.resolve(currentWorkingDirectory);
  const canonicalWorkingDirectory = fs.realpathSync.native(
    resolvedWorkingDirectory
  );
  const resolvedOutputDir = path.resolve(
    resolvedWorkingDirectory,
    trimmedOutputDir
  );
  const canonicalOutputDir = canonicalizePathForContainment(resolvedOutputDir);
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
    resolvedWorkingDirectory
  );
  const canonicalProtectedWorkspaceRoot = findProtectedWorkspaceRoot(
    canonicalWorkingDirectory
  );
  const protectedWorkspaceRoots = [
    logicalProtectedWorkspaceRoot,
    canonicalProtectedWorkspaceRoot,
  ].filter((root): root is string => root !== undefined);
  const protectedWorkspaceRootTarget = protectedWorkspaceRoots.find(
    protectedWorkspaceRoot =>
      resolvedOutputDir === protectedWorkspaceRoot ||
      canonicalOutputDir === fs.realpathSync.native(protectedWorkspaceRoot)
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
};
