import fs from "node:fs";
import path from "node:path";
import { Effect } from "effect";
import {
  OutputComparisonReadError,
  OutputSnapshotError,
  UnsupportedOutputEntryError,
} from "../errors/OutputComparisonError.js";
import { isExpectedNodeSystemError } from "./internal/nodeFsErrors.js";
import {
  collectRegularFiles,
  inspectRoot,
  readBytes,
} from "./internal/outputTreeCollection.js";

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
