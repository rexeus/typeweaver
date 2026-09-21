import fs from "node:fs";
import path from "node:path";
import {
  OutputComparisonReadError,
  UnsupportedOutputEntryError,
} from "../../errors/OutputComparisonError.js";
import { errnoCode, isExpectedNodeSystemError } from "./nodeFsErrors.js";
import {
  hasCoordinationArtifactMarker,
  isCompleteLegacyOutputLock,
} from "./outputCoordinationArtifact.js";

export type RootInspection =
  | { readonly _tag: "Missing" }
  | { readonly _tag: "Directory" };

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

export const inspectRoot = (
  root: string,
  allowMissingRoot: boolean
): RootInspection => {
  let stats: fs.Stats;
  try {
    stats = fs.lstatSync(root);
  } catch (cause) {
    if (errnoCode(cause) === "ENOENT") {
      if (allowMissingRoot) return { _tag: "Missing" };
      throw new OutputComparisonReadError({
        root,
        relativePath: ".",
        cause: new Error("Output directory does not exist"),
      });
    }
    throw readError(root, ".", cause);
  }
  if (stats.isSymbolicLink())
    throw unsupportedEntry(root, ".", "symbolic-link");
  if (!stats.isDirectory()) throw unsupportedEntry(root, ".", "other");
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

const isExcludedCoordinationDirectory = (
  root: string,
  absolutePath: string,
  relativePath: string,
  entryName: string
): boolean => {
  try {
    return (
      hasCoordinationArtifactMarker(absolutePath, entryName) ||
      isCompleteLegacyOutputLock(absolutePath, entryName)
    );
  } catch (cause) {
    throw readError(root, toPosix(relativePath), cause);
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
      isExcludedCoordinationDirectory(
        context.root,
        absolutePath,
        relativePath,
        entryName
      )
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

export const collectRegularFiles = (params: {
  readonly root: string;
  readonly allowMissingRoot: boolean;
}): Map<string, string> => {
  const files = new Map<string, string>();
  if (inspectRoot(params.root, params.allowMissingRoot)._tag === "Missing") {
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

export const readBytes = (
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
