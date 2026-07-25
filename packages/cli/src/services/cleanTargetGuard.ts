import fs from "node:fs";
import path from "node:path";
import { UnsafeCleanTargetError } from "../errors/UnsafeCleanTargetError.js";

/**
 * Filesystem probes the clean-target guard depends on. Kept narrow so tests
 * and Effect-native callers can substitute fakes (the FileSystem service)
 * without dragging in unrelated `fs` surface.
 */
export type CleanTargetFs = {
  readonly exists: (probePath: string) => boolean;
  readonly readFileString: (probePath: string) => string;
  readonly realPath: (probePath: string) => string;
};

const defaultCleanTargetFs: CleanTargetFs = {
  exists: probePath => fs.existsSync(probePath),
  readFileString: probePath => fs.readFileSync(probePath, "utf8"),
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

const hasWorkspacesField = (
  packageJsonPath: string,
  fileSystem: CleanTargetFs
): boolean => {
  try {
    const contents = fileSystem.readFileString(packageJsonPath);
    const parsed: unknown = JSON.parse(contents);
    if (typeof parsed !== "object" || parsed === null) {
      return false;
    }

    return Boolean((parsed as { workspaces?: unknown }).workspaces);
  } catch (error) {
    // A malformed package.json does not make a directory a workspace root
    // for the purposes of this guard. Treat parse failure as "no marker".
    if (error instanceof SyntaxError) {
      return false;
    }
    throw error;
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

  return hasWorkspacesField(packageJsonPath, fileSystem);
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

type CleanTargetContext = {
  readonly outputDir: string;
  readonly fileSystem: CleanTargetFs;
  readonly resolvedWorkingDirectory: string;
  readonly canonicalWorkingDirectory: string;
  readonly resolvedOutputDir: string;
  readonly canonicalOutputDir: string;
  readonly filesystemRoot: string;
};

const resolveCleanTargetContext = (
  outputDir: string,
  currentWorkingDirectory: string,
  fileSystem: CleanTargetFs
): CleanTargetContext => {
  const trimmedOutputDir = outputDir.trim();
  if (trimmedOutputDir.length === 0) {
    throw new UnsafeCleanTargetError({
      outputDir,
      details: { reason: "empty-path" },
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

  return {
    outputDir,
    fileSystem,
    resolvedWorkingDirectory,
    canonicalWorkingDirectory,
    resolvedOutputDir,
    canonicalOutputDir,
    filesystemRoot: path.parse(canonicalOutputDir).root,
  };
};

const assertNotFilesystemRoot = (context: CleanTargetContext): void => {
  if (context.canonicalOutputDir !== context.filesystemRoot) {
    return;
  }
  throw new UnsafeCleanTargetError({
    outputDir: context.outputDir,
    details: {
      reason: "filesystem-root",
      resolvedOutputDir: context.resolvedOutputDir,
      currentWorkingDirectory: context.resolvedWorkingDirectory,
      filesystemRoot: context.filesystemRoot,
    },
  });
};

const assertNotWorkingDirectory = (context: CleanTargetContext): void => {
  const isWorkingDirectory =
    context.resolvedOutputDir === context.resolvedWorkingDirectory ||
    context.canonicalOutputDir === context.canonicalWorkingDirectory;
  if (!isWorkingDirectory) {
    return;
  }
  throw new UnsafeCleanTargetError({
    outputDir: context.outputDir,
    details: {
      reason: "current-working-directory",
      resolvedOutputDir: context.resolvedOutputDir,
      currentWorkingDirectory: context.resolvedWorkingDirectory,
    },
  });
};

const getProtectedWorkspaceRoots = (
  context: CleanTargetContext
): readonly string[] =>
  [
    findProtectedWorkspaceRoot(
      context.resolvedWorkingDirectory,
      context.fileSystem
    ),
    findProtectedWorkspaceRoot(
      context.canonicalWorkingDirectory,
      context.fileSystem
    ),
  ].filter((root): root is string => root !== undefined);

const assertNotWorkspaceRoot = (
  context: CleanTargetContext,
  protectedWorkspaceRoots: readonly string[]
): void => {
  const target = protectedWorkspaceRoots.find(
    protectedWorkspaceRoot =>
      context.resolvedOutputDir === protectedWorkspaceRoot ||
      context.canonicalOutputDir ===
        context.fileSystem.realPath(protectedWorkspaceRoot)
  );
  if (target === undefined) {
    return;
  }
  throw new UnsafeCleanTargetError({
    outputDir: context.outputDir,
    details: {
      reason: "workspace-root",
      resolvedOutputDir: context.resolvedOutputDir,
      currentWorkingDirectory: context.resolvedWorkingDirectory,
      protectedWorkspaceRoot: target,
    },
  });
};

const assertNotAncestorOfWorkingDirectory = (
  context: CleanTargetContext,
  protectedWorkspaceRoots: readonly string[]
): void => {
  const isProtectedAncestor =
    protectedWorkspaceRoots.length > 0 &&
    (isSameOrDescendantOf(
      context.resolvedWorkingDirectory,
      context.resolvedOutputDir
    ) ||
      isSameOrDescendantOf(
        context.canonicalWorkingDirectory,
        context.canonicalOutputDir
      ));
  if (!isProtectedAncestor) {
    return;
  }
  throw new UnsafeCleanTargetError({
    outputDir: context.outputDir,
    details: {
      reason: "ancestor-of-current-working-directory",
      resolvedOutputDir: context.resolvedOutputDir,
      currentWorkingDirectory: context.resolvedWorkingDirectory,
    },
  });
};

const assertDoesNotContainInputFile = (
  context: CleanTargetContext,
  inputFile: string | undefined
): void => {
  if (inputFile === undefined) {
    return;
  }
  const canonicalInputFile = canonicalizePathForContainment(
    path.resolve(context.resolvedWorkingDirectory, inputFile),
    context.fileSystem
  );
  if (!isSameOrDescendantOf(canonicalInputFile, context.canonicalOutputDir)) {
    return;
  }
  throw new UnsafeCleanTargetError({
    outputDir: context.outputDir,
    details: {
      reason: "contains-input-file",
      resolvedOutputDir: context.resolvedOutputDir,
      currentWorkingDirectory: context.resolvedWorkingDirectory,
      inputFile: canonicalInputFile,
    },
  });
};

const assertTargetHasNoWorkspaceMarker = (
  context: CleanTargetContext
): void => {
  if (!hasWorkspaceMarker(context.canonicalOutputDir, context.fileSystem)) {
    return;
  }
  throw new UnsafeCleanTargetError({
    outputDir: context.outputDir,
    details: {
      reason: "target-carries-workspace-marker",
      resolvedOutputDir: context.resolvedOutputDir,
      currentWorkingDirectory: context.resolvedWorkingDirectory,
      protectedWorkspaceRoot: context.canonicalOutputDir,
    },
  });
};

/**
 * Guard every destructive or filesystem-touching use of the output
 * directory against catastrophic targets. `Generator.generate` runs this
 * before anything writes to or deletes from `outputDir` — including with
 * `--no-clean`, where the orphan-tempdir sweep and directory creation
 * still apply (the input-file containment rule is clean-specific and only
 * checked when `inputFile` is passed). Inject filesystem probes via
 * `fileSystem` to keep the algorithm pure-core:
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
  const context = resolveCleanTargetContext(
    outputDir,
    currentWorkingDirectory,
    fileSystem
  );
  assertNotFilesystemRoot(context);
  assertNotWorkingDirectory(context);

  const protectedWorkspaceRoots = getProtectedWorkspaceRoots(context);
  assertNotWorkspaceRoot(context, protectedWorkspaceRoots);
  assertNotAncestorOfWorkingDirectory(context, protectedWorkspaceRoots);

  // Reject when the spec input file lives inside the clean target. Without
  // this check, `typeweaver generate --input spec/index.ts --output spec`
  // deletes the source before bundling runs.
  assertDoesNotContainInputFile(context, inputFile);

  // Defense in depth: a target outside the workspace inferred from cwd is
  // not necessarily safe. If the target directory itself carries a workspace
  // marker, cleaning it would destroy a workspace — reject before any rm
  // runs.
  assertTargetHasNoWorkspaceMarker(context);
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
