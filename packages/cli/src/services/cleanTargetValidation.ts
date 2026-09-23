import path from "node:path";
import { UnsafeCleanTargetError } from "../errors/UnsafeCleanTargetError.js";
import {
  findProtectedWorkspaceRoot,
  hasWorkspaceMarker,
} from "./cleanTargetWorkspace.js";
import {
  canonicalizePathForContainment,
  isSameOrDescendantOf,
} from "./internal/canonicalPath.js";
import type { CleanTargetFs } from "./cleanTargetTypes.js";

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
  if (outputDir.trim().length === 0) {
    throw new UnsafeCleanTargetError({
      outputDir,
      details: { reason: "empty-path" },
    });
  }
  const resolvedWorkingDirectory = path.resolve(currentWorkingDirectory);
  const canonicalWorkingDirectory = fileSystem.realPath(
    resolvedWorkingDirectory
  );
  const resolvedOutputDir = path.resolve(resolvedWorkingDirectory, outputDir);
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
  if (context.canonicalOutputDir !== context.filesystemRoot) return;
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
  if (
    context.resolvedOutputDir !== context.resolvedWorkingDirectory &&
    context.canonicalOutputDir !== context.canonicalWorkingDirectory
  ) {
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

const protectedWorkspaceRoots = (
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
  roots: readonly string[]
): void => {
  const target = roots.find(
    root =>
      context.resolvedOutputDir === root ||
      context.canonicalOutputDir === context.fileSystem.realPath(root)
  );
  if (target === undefined) return;
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
  context: CleanTargetContext
): void => {
  if (
    !isSameOrDescendantOf(
      context.resolvedWorkingDirectory,
      context.resolvedOutputDir
    ) &&
    !isSameOrDescendantOf(
      context.canonicalWorkingDirectory,
      context.canonicalOutputDir
    )
  ) {
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

const assertTargetIsNotSymbolicLink = (context: CleanTargetContext): void => {
  if (!context.fileSystem.isSymbolicLink(context.resolvedOutputDir)) return;
  throw new UnsafeCleanTargetError({
    outputDir: context.outputDir,
    details: {
      reason: "symbolic-link",
      resolvedOutputDir: context.resolvedOutputDir,
      canonicalOutputDir: context.canonicalOutputDir,
      currentWorkingDirectory: context.resolvedWorkingDirectory,
    },
  });
};

const assertDoesNotContainInputFile = (
  context: CleanTargetContext,
  inputFile: string | undefined
): void => {
  if (inputFile === undefined) return;
  const resolvedInputFile = path.resolve(
    context.resolvedWorkingDirectory,
    inputFile
  );
  const canonicalInputFile = canonicalizePathForContainment(
    resolvedInputFile,
    context.fileSystem
  );
  const containedInputFile = isSameOrDescendantOf(
    resolvedInputFile,
    context.resolvedOutputDir
  )
    ? resolvedInputFile
    : isSameOrDescendantOf(canonicalInputFile, context.canonicalOutputDir)
      ? canonicalInputFile
      : undefined;
  if (containedInputFile === undefined) return;
  throw new UnsafeCleanTargetError({
    outputDir: context.outputDir,
    details: {
      reason: "contains-input-file",
      resolvedOutputDir: context.resolvedOutputDir,
      currentWorkingDirectory: context.resolvedWorkingDirectory,
      inputFile: containedInputFile,
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
 * `fileSystem` to keep the algorithm pure-core. Rejected targets:
 *   - empty / whitespace-only paths
 *   - filesystem root
 *   - the current working directory itself
 *   - an inferred workspace root (`.git`, `pnpm-workspace.yaml`, `lerna.json`,
 *     `nx.json`, `turbo.json`, `rush.json`, or a `package.json` declaring
 *     workspaces)
 *   - any lexical or canonical ancestor of the current working directory,
 *     regardless of workspace markers
 *   - an output path that is itself a symbolic link, including dangling links
 *   - a target containing `inputFile`, when passed
 *   - a target that itself carries a workspace marker
 *
 * Symlinks are resolved before comparison so a symlinked output directory
 * pointing at a protected location is still rejected.
 *
 * @throws UnsafeCleanTargetError naming the violated rule in `details.reason`
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
  assertNotWorkspaceRoot(context, protectedWorkspaceRoots(context));
  assertNotAncestorOfWorkingDirectory(context);
  assertTargetIsNotSymbolicLink(context);
  // Reject when the spec input file lives inside the clean target. Without
  // this check, `typeweaver generate --input spec/index.ts --output spec`
  // deletes the source before bundling runs.
  assertDoesNotContainInputFile(context, inputFile);
  // Defense in depth: a target outside the workspace inferred from cwd is
  // not necessarily safe. If the target directory itself carries a workspace
  // marker, cleaning it would destroy a workspace — reject before any rm
  // runs.
  if (hasWorkspaceMarker(context.canonicalOutputDir, context.fileSystem)) {
    throw new UnsafeCleanTargetError({
      outputDir: context.outputDir,
      details: {
        reason: "target-carries-workspace-marker",
        resolvedOutputDir: context.resolvedOutputDir,
        currentWorkingDirectory: context.resolvedWorkingDirectory,
        protectedWorkspaceRoot: context.canonicalOutputDir,
      },
    });
  }
};
