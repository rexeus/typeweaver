import fs from "node:fs";
import path from "node:path";
import { UnsafeGeneratedPathError } from "../errors/UnsafeGeneratedPathError.js";

export type SafeGeneratedFilePath = {
  readonly fullPath: string;
  readonly generatedPath: string;
};

type FileSystemError = Error & {
  readonly code?: string;
};

const WINDOWS_DRIVE_PREFIX_PATTERN = /^[a-zA-Z]:/;

const pathContainsParentTraversal = (projectPath: string): boolean =>
  projectPath.split("/").includes("..");

const pathEndsWithDirectorySeparator = (projectPath: string): boolean =>
  projectPath.endsWith("/");

const pathNamesCurrentDirectory = (projectPath: string): boolean =>
  projectPath === "." || projectPath.endsWith("/.");

const toNativePath = (projectPath: string): string =>
  projectPath.split("/").join(path.sep);

const isStrictlyInsidePath = (
  childPath: string,
  parentPath: string
): boolean => {
  const relativePath = path.relative(parentPath, childPath);

  return (
    relativePath !== "" &&
    relativePath !== ".." &&
    !relativePath.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relativePath)
  );
};

const isMissingPathError = (error: unknown): boolean => {
  if (!(error instanceof Error)) {
    return false;
  }
  return ["ENOENT", "ENOTDIR"].includes((error as FileSystemError).code ?? "");
};

const getExistingPathStats = (absolutePath: string): fs.Stats | undefined => {
  try {
    return fs.lstatSync(absolutePath);
  } catch (error) {
    if (isMissingPathError(error)) {
      return undefined;
    }
    throw error;
  }
};

const assertPathStatsIsNotSymlink = (
  pathStats: fs.Stats,
  requestedPath: string
): void => {
  if (pathStats.isSymbolicLink()) {
    throw new UnsafeGeneratedPathError({
      requestedPath,
      reason: "symlink-component",
    });
  }
};

const assertExistingPathIsNotSymlink = (
  absolutePath: string,
  requestedPath: string
): void => {
  const pathStats = getExistingPathStats(absolutePath);
  if (pathStats === undefined) {
    return;
  }
  assertPathStatsIsNotSymlink(pathStats, requestedPath);
};

const assertGeneratedPathHasNoSymlinkComponents = (config: {
  readonly outputRoot: string;
  readonly generatedPath: string;
  readonly requestedPath: string;
}): void => {
  assertExistingPathIsNotSymlink(config.outputRoot, config.requestedPath);

  let currentPath = config.outputRoot;

  for (const segment of config.generatedPath.split("/")) {
    currentPath = path.join(currentPath, segment);

    const pathStats = getExistingPathStats(currentPath);

    if (pathStats === undefined) {
      return;
    }

    assertPathStatsIsNotSymlink(pathStats, config.requestedPath);

    if (!pathStats.isDirectory()) {
      return;
    }
  }
};

/**
 * Validate a generated file path against path-traversal, absolute-path, and
 * symlink-escape attacks. Returns the resolved absolute and normalized paths
 * on success; throws `UnsafeGeneratedPathError` on any policy violation.
 *
 * Security-critical: every plugin write must funnel through this guard.
 */
export const resolveSafeGeneratedFilePath = (
  outputDir: string,
  requestedPath: string
): SafeGeneratedFilePath => {
  if (requestedPath.length === 0) {
    throw new UnsafeGeneratedPathError({ requestedPath, reason: "empty-path" });
  }

  const projectPath = requestedPath.replace(/\\/g, "/");

  if (
    path.isAbsolute(requestedPath) ||
    path.posix.isAbsolute(projectPath) ||
    path.win32.isAbsolute(requestedPath) ||
    path.win32.isAbsolute(projectPath) ||
    WINDOWS_DRIVE_PREFIX_PATTERN.test(requestedPath)
  ) {
    throw new UnsafeGeneratedPathError({
      requestedPath,
      reason: "absolute-path",
    });
  }

  if (pathContainsParentTraversal(projectPath)) {
    throw new UnsafeGeneratedPathError({
      requestedPath,
      reason: "parent-traversal",
    });
  }

  if (pathEndsWithDirectorySeparator(projectPath)) {
    throw new UnsafeGeneratedPathError({
      requestedPath,
      reason: "trailing-separator",
    });
  }

  if (pathNamesCurrentDirectory(projectPath)) {
    throw new UnsafeGeneratedPathError({
      requestedPath,
      reason: "current-directory",
    });
  }

  const generatedPath = path.posix.normalize(projectPath);

  if (generatedPath === ".") {
    throw new UnsafeGeneratedPathError({
      requestedPath,
      reason: "current-directory",
    });
  }

  if (pathContainsParentTraversal(generatedPath)) {
    throw new UnsafeGeneratedPathError({
      requestedPath,
      reason: "parent-traversal",
    });
  }

  const outputRoot = path.resolve(outputDir);
  const fullPath = path.resolve(outputRoot, toNativePath(generatedPath));

  if (!isStrictlyInsidePath(fullPath, outputRoot)) {
    throw new UnsafeGeneratedPathError({
      requestedPath,
      reason: "escapes-output",
    });
  }

  assertGeneratedPathHasNoSymlinkComponents({
    outputRoot,
    generatedPath,
    requestedPath,
  });

  return { fullPath, generatedPath };
};
