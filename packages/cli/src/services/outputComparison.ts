import fs from "node:fs";
import path from "node:path";
import { Effect } from "effect";
import {
  OutputComparisonReadError,
  OutputSnapshotError,
  UnsupportedOutputEntryError,
} from "../errors/OutputComparisonError.js";
import {
  errnoCode,
  isExpectedNodeSystemError,
} from "./internal/nodeFsErrors.js";
import {
  hasCoordinationArtifactMarker,
  isCompleteLegacyOutputLock,
} from "./internal/outputCoordinationArtifact.js";

export type OutputComparison = {
  readonly added: readonly string[];
  readonly removed: readonly string[];
  readonly changed: readonly string[];
  readonly generatedFileCount: number;
};

export const isMatchingOutput = (comparison: OutputComparison): boolean =>
  comparison.added.length === 0 &&
  comparison.removed.length === 0 &&
  comparison.changed.length === 0;

const toPosix = (relativePath: string): string =>
  relativePath.split(path.sep).join("/");

const readError = (
  root: string,
  relativePath: string,
  cause: unknown
): OutputComparisonReadError => {
  if (isExpectedNodeSystemError(cause)) {
    return new OutputComparisonReadError({ root, relativePath, cause });
  }
  throw cause;
};

const unsupportedEntry = (
  root: string,
  relativePath: string,
  entryType: "symbolic-link" | "other"
): UnsupportedOutputEntryError =>
  new UnsupportedOutputEntryError({ root, relativePath, entryType });

const toRelativePath = (
  relativeDirectory: string,
  entryName: string
): string =>
  relativeDirectory === ""
    ? entryName
    : path.join(relativeDirectory, entryName);

type RootInspection =
  | { readonly _tag: "Missing" }
  | { readonly _tag: "Directory" };

/**
 * Inspects a tree root itself. Only `ENOENT` means "missing"; an inaccessible
 * root is a typed read failure. A symlinked root and a non-directory root are
 * unsupported entries, never silently treated as empty.
 */
const inspectRoot = (
  root: string,
  allowMissingRoot: boolean
): RootInspection => {
  let stats: fs.Stats;
  try {
    stats = fs.lstatSync(root);
  } catch (cause) {
    if (errnoCode(cause) === "ENOENT") {
      if (allowMissingRoot) {
        return { _tag: "Missing" };
      }
      throw new OutputComparisonReadError({
        root,
        relativePath: ".",
        cause: new Error("Output directory does not exist"),
      });
    }
    throw readError(root, ".", cause);
  }

  if (stats.isSymbolicLink()) {
    throw unsupportedEntry(root, ".", "symbolic-link");
  }
  if (!stats.isDirectory()) {
    throw unsupportedEntry(root, ".", "other");
  }
  return { _tag: "Directory" };
};

const readDirectory = (root: string, relativeDirectory: string): string[] => {
  const absoluteDirectory =
    relativeDirectory === "" ? root : path.join(root, relativeDirectory);
  try {
    return fs.readdirSync(absoluteDirectory);
  } catch (cause) {
    throw readError(root, relativeDirectory || ".", cause);
  }
};

const readEntryStats = (
  root: string,
  relativePath: string,
  absolutePath: string
): fs.Stats => {
  try {
    return fs.lstatSync(absolutePath);
  } catch (cause) {
    throw readError(root, relativePath, cause);
  }
};

/**
 * Only a directory whose exact complete marker or legacy lock metadata proves
 * it is a Typeweaver coordination artifact is excluded. A regular file named
 * `.typeweaver-lock`, a fence-shaped name, a bare marker filename, or a
 * lookalike directory is compared or rejected normally.
 */
const isExcludedCoordinationDirectory = (
  root: string,
  absolutePath: string,
  entryName: string
): boolean => {
  try {
    return (
      hasCoordinationArtifactMarker(absolutePath, entryName) ||
      isCompleteLegacyOutputLock(absolutePath, entryName)
    );
  } catch (cause) {
    throw readError(root, toPosix(entryName), cause);
  }
};

type CollectionContext = {
  readonly root: string;
  readonly files: Map<string, string>;
  readonly walk: (relativeDirectory: string) => void;
};

const collectEntry = (
  context: CollectionContext,
  relativeDirectory: string,
  entryName: string
): void => {
  const relativePath = toRelativePath(relativeDirectory, entryName);
  const absolutePath = path.join(
    relativeDirectory === ""
      ? context.root
      : path.join(context.root, relativeDirectory),
    entryName
  );
  const stats = readEntryStats(context.root, relativePath, absolutePath);

  if (stats.isSymbolicLink()) {
    throw unsupportedEntry(
      context.root,
      toPosix(relativePath),
      "symbolic-link"
    );
  }
  if (stats.isDirectory()) {
    if (
      isExcludedCoordinationDirectory(context.root, absolutePath, entryName)
    ) {
      return;
    }
    context.walk(relativePath);
    return;
  }
  if (stats.isFile()) {
    context.files.set(toPosix(relativePath), absolutePath);
    return;
  }
  throw unsupportedEntry(context.root, toPosix(relativePath), "other");
};

const collectRegularFiles = (params: {
  readonly root: string;
  readonly allowMissingRoot: boolean;
}): Map<string, string> => {
  const files = new Map<string, string>();
  const inspection = inspectRoot(params.root, params.allowMissingRoot);
  if (inspection._tag === "Missing") {
    return files;
  }

  const context: CollectionContext = {
    root: params.root,
    files,
    walk: relativeDirectory => {
      for (const entryName of readDirectory(params.root, relativeDirectory)) {
        collectEntry(context, relativeDirectory, entryName);
      }
    },
  };
  context.walk("");
  return files;
};

const readBytes = (
  root: string,
  relativePath: string,
  absolutePath: string
): Buffer => {
  try {
    return fs.readFileSync(absolutePath);
  } catch (cause) {
    throw readError(root, relativePath, cause);
  }
};

const compareSync = (params: {
  readonly committedRoot: string;
  readonly generatedRoot: string;
}): OutputComparison => {
  const committed = collectRegularFiles({
    root: params.committedRoot,
    allowMissingRoot: true,
  });
  const generated = collectRegularFiles({
    root: params.generatedRoot,
    allowMissingRoot: false,
  });

  const added = Array.from(generated.keys())
    .filter(relativePath => !committed.has(relativePath))
    .sort();
  const removed = Array.from(committed.keys())
    .filter(relativePath => !generated.has(relativePath))
    .sort();
  const changed = Array.from(generated.keys())
    .filter(relativePath => committed.has(relativePath))
    .filter(relativePath => {
      const committedBytes = readBytes(
        params.committedRoot,
        relativePath,
        committed.get(relativePath) ?? ""
      );
      const generatedBytes = readBytes(
        params.generatedRoot,
        relativePath,
        generated.get(relativePath) ?? ""
      );
      return !committedBytes.equals(generatedBytes);
    })
    .sort();

  return { added, removed, changed, generatedFileCount: generated.size };
};

/**
 * Compares committed output against fresh generated output.
 *
 * `committedRoot` may be missing, which reports every generated file as added.
 * Both trees are walked deterministically; only regular files participate and
 * comparison is byte-exact, so binary output is supported. Symlinked or
 * unsupported roots and entries fail closed with a typed error, as do expected
 * read failures.
 */
export const compareOutputTrees = (params: {
  readonly committedRoot: string;
  readonly generatedRoot: string;
}): Effect.Effect<
  OutputComparison,
  UnsupportedOutputEntryError | OutputComparisonReadError
> =>
  Effect.try({
    try: () => compareSync(params),
    catch: error => {
      if (
        error instanceof UnsupportedOutputEntryError ||
        error instanceof OutputComparisonReadError
      ) {
        return error;
      }
      throw error;
    },
  });

const snapshotError = (
  sourceRoot: string,
  relativePath: string,
  cause: unknown
): OutputSnapshotError => {
  if (isExpectedNodeSystemError(cause)) {
    return new OutputSnapshotError({ sourceRoot, relativePath, cause });
  }
  throw cause;
};

const copySync = (params: {
  readonly sourceRoot: string;
  readonly destinationRoot: string;
}): void => {
  try {
    fs.mkdirSync(params.destinationRoot, { recursive: true });
  } catch (cause) {
    throw snapshotError(params.sourceRoot, ".", cause);
  }

  const inspection = inspectRoot(params.sourceRoot, true);
  if (inspection._tag === "Missing") {
    return;
  }

  let files: Map<string, string>;
  try {
    files = collectRegularFiles({
      root: params.sourceRoot,
      allowMissingRoot: false,
    });
  } catch (error) {
    if (error instanceof OutputComparisonReadError) {
      throw new OutputSnapshotError({
        sourceRoot: params.sourceRoot,
        relativePath: error.relativePath,
        cause: error.cause,
      });
    }
    throw error;
  }

  for (const relativePath of Array.from(files.keys()).sort()) {
    const absoluteSource = files.get(relativePath) ?? "";
    const absoluteDestination = path.join(
      params.destinationRoot,
      ...relativePath.split("/")
    );
    try {
      fs.mkdirSync(path.dirname(absoluteDestination), { recursive: true });
      fs.copyFileSync(absoluteSource, absoluteDestination);
    } catch (cause) {
      throw snapshotError(params.sourceRoot, relativePath, cause);
    }
  }
};

/**
 * Copies committed output into a staging directory before isolated generation.
 * A missing source is a no-op so a first `--check` can still compare fresh
 * output against absent committed output. The source is never mutated, and
 * unsupported entries or expected filesystem failures are typed.
 */
export const snapshotOutputTree = (params: {
  readonly sourceRoot: string;
  readonly destinationRoot: string;
}): Effect.Effect<
  void,
  UnsupportedOutputEntryError | OutputComparisonReadError | OutputSnapshotError
> =>
  Effect.try({
    try: () => copySync(params),
    catch: error => {
      if (
        error instanceof UnsupportedOutputEntryError ||
        error instanceof OutputComparisonReadError ||
        error instanceof OutputSnapshotError
      ) {
        return error;
      }
      throw error;
    },
  });
