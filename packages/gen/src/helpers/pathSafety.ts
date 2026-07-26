import fs from "node:fs";
import path from "node:path";
import { GeneratedPathProbeError } from "../errors/GeneratedPathProbeError.js";
import { UnsafeGeneratedPathError } from "../errors/UnsafeGeneratedPathError.js";
import type { UnsafeGeneratedPathReason } from "../errors/UnsafeGeneratedPathError.js";

export type SafeGeneratedFilePath = {
  readonly fullPath: string;
  readonly generatedPath: string;
};

/**
 * Filesystem probe used for symlink rejection. The guard normalizes
 * ENOENT/ENOTDIR to `undefined` (the path simply does not exist yet). Tests
 * and the Effect-native `PathSafety` service can substitute fakes.
 */
export type PathSafetyStat = {
  readonly isSymbolicLink: () => boolean;
  readonly isDirectory: () => boolean;
};

export type PathSafetyFs = {
  readonly lstat: (absolutePath: string) => PathSafetyStat | undefined;
};

const WINDOWS_DRIVE_PREFIX_PATTERN = /^[a-zA-Z]:/;
const MISSING_PATH_ERROR_CODES = ["ENOENT", "ENOTDIR"];

const pathContainsParentTraversal = (projectPath: string): boolean =>
  projectPath.split("/").includes("..");

const pathEndsWithDirectorySeparator = (projectPath: string): boolean =>
  projectPath.endsWith("/");

const pathNamesCurrentDirectory = (projectPath: string): boolean =>
  projectPath === "." || projectPath.endsWith("/.");

const isAbsoluteGeneratedPath = (
  requestedPath: string,
  projectPath: string
): boolean =>
  path.isAbsolute(requestedPath) ||
  path.posix.isAbsolute(projectPath) ||
  path.win32.isAbsolute(requestedPath) ||
  path.win32.isAbsolute(projectPath) ||
  WINDOWS_DRIVE_PREFIX_PATTERN.test(requestedPath);

const getLexicalPathViolation = (
  requestedPath: string,
  projectPath: string
): UnsafeGeneratedPathReason | undefined => {
  if (requestedPath.length === 0) return "empty-path";
  if (requestedPath.includes("\0")) return "nul-byte";
  if (isAbsoluteGeneratedPath(requestedPath, projectPath))
    return "absolute-path";
  if (pathContainsParentTraversal(projectPath)) return "parent-traversal";
  if (pathEndsWithDirectorySeparator(projectPath)) return "trailing-separator";
  if (pathNamesCurrentDirectory(projectPath)) return "current-directory";
  return undefined;
};

const getNormalizedPathViolation = (
  generatedPath: string
): UnsafeGeneratedPathReason | undefined => {
  if (generatedPath === ".") return "current-directory";
  if (pathContainsParentTraversal(generatedPath)) return "parent-traversal";
  return undefined;
};

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

type NodeSystemError = Error & {
  readonly code: string;
  readonly errno?: number;
  readonly syscall?: string;
};

const isNodeSystemError = (error: unknown): error is NodeSystemError =>
  error instanceof Error &&
  "code" in error &&
  typeof error.code === "string" &&
  (("syscall" in error && typeof error.syscall === "string") ||
    ("errno" in error && typeof error.errno === "number"));

const isMissingPathError = (error: NodeSystemError): boolean =>
  MISSING_PATH_ERROR_CODES.some(code => code === error.code);

const defaultPathSafetyFs: PathSafetyFs = {
  lstat: absolutePath => {
    const stats = fs.lstatSync(absolutePath);
    return {
      isSymbolicLink: () => stats.isSymbolicLink(),
      isDirectory: () => stats.isDirectory(),
    };
  },
};

const probePath = (config: {
  readonly absolutePath: string;
  readonly requestedPath: string;
  readonly fileSystem: PathSafetyFs;
}): PathSafetyStat | undefined => {
  try {
    return config.fileSystem.lstat(config.absolutePath);
  } catch (error) {
    if (!isNodeSystemError(error)) {
      throw error;
    }

    if (isMissingPathError(error)) {
      return undefined;
    }

    throw new GeneratedPathProbeError({
      operation: "lstat",
      requestedPath: config.requestedPath,
      probedPath: config.absolutePath,
      code: error.code,
      cause: error,
    });
  }
};

const assertPathStatsIsNotSymlink = (
  pathStats: PathSafetyStat,
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
  requestedPath: string,
  fileSystem: PathSafetyFs
): void => {
  const pathStats = probePath({
    absolutePath,
    requestedPath,
    fileSystem,
  });
  if (pathStats === undefined) {
    return;
  }
  assertPathStatsIsNotSymlink(pathStats, requestedPath);
};

const assertGeneratedPathHasNoSymlinkComponents = (config: {
  readonly outputRoot: string;
  readonly generatedPath: string;
  readonly requestedPath: string;
  readonly fileSystem: PathSafetyFs;
}): void => {
  assertExistingPathIsNotSymlink(
    config.outputRoot,
    config.requestedPath,
    config.fileSystem
  );

  let currentPath = config.outputRoot;

  for (const segment of config.generatedPath.split("/")) {
    currentPath = path.join(currentPath, segment);

    const pathStats = probePath({
      absolutePath: currentPath,
      requestedPath: config.requestedPath,
      fileSystem: config.fileSystem,
    });

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
 * on success; throws `UnsafeGeneratedPathError` on any policy violation and
 * `GeneratedPathProbeError` for recognized Node system failures encountered
 * while inspecting existing path components.
 *
 * Security-critical: every plugin write must funnel through this guard.
 * Filesystem probes are routed through the injectable `fileSystem` deps so
 * tests can substitute fakes; production callers (via the `PathSafety`
 * Effect service) use the real Node `fs.lstatSync` implementation.
 */
export const resolveSafeGeneratedFilePath = (
  outputDir: string,
  requestedPath: string,
  fileSystem: PathSafetyFs = defaultPathSafetyFs
): SafeGeneratedFilePath => {
  const projectPath = requestedPath.replace(/\\/g, "/");
  const lexicalViolation = getLexicalPathViolation(requestedPath, projectPath);
  if (lexicalViolation !== undefined) {
    throw new UnsafeGeneratedPathError({
      requestedPath,
      reason: lexicalViolation,
    });
  }

  const generatedPath = path.posix.normalize(projectPath);
  const normalizedViolation = getNormalizedPathViolation(generatedPath);
  if (normalizedViolation !== undefined) {
    throw new UnsafeGeneratedPathError({
      requestedPath,
      reason: normalizedViolation,
    });
  }

  const outputRoot = path.resolve(outputDir);
  const fullPath = path.resolve(outputRoot, toNativePath(generatedPath));

  if (!isStrictlyInsidePath(fullPath, outputRoot)) {
    // Defense-in-depth — currently unreachable from the public API because
    // the earlier `absolute-path` and `parent-traversal` guards short-circuit
    // every input that could otherwise resolve outside `outputRoot`.
    throw new UnsafeGeneratedPathError({
      requestedPath,
      reason: "escapes-output",
    });
  }

  assertGeneratedPathHasNoSymlinkComponents({
    outputRoot,
    generatedPath,
    requestedPath,
    fileSystem,
  });

  return { fullPath, generatedPath };
};
