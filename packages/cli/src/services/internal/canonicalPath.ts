import path from "node:path";

export type CanonicalPathFs = {
  readonly exists: (probePath: string) => boolean;
  readonly realPath: (probePath: string) => string;
};

/**
 * Resolves the physical path of a target that may not exist yet. The nearest
 * existing ancestor is canonicalized with `realpath`, then the unresolved
 * suffix is appended deterministically. This makes symlink aliases and
 * platform-canonical spellings (`/tmp` versus `/private/tmp`) collapse to one
 * identity even when descendant directories have not been created.
 */
export const canonicalizePathForContainment = (
  targetPath: string,
  fileSystem: CanonicalPathFs
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

/**
 * True when `directory` is `ancestor` itself or lives beneath it. Both paths
 * must already be canonicalized for the answer to be meaningful.
 */
export const isSameOrDescendantOf = (
  directory: string,
  ancestor: string
): boolean => {
  const relativePath = path.relative(ancestor, directory);
  const parentTraversalPrefix = `..${path.sep}`;
  const escapesAncestor =
    relativePath === ".." || relativePath.startsWith(parentTraversalPrefix);

  return (
    relativePath === "" || (!escapesAncestor && !path.isAbsolute(relativePath))
  );
};

/**
 * True when neither path contains the other, so writing one cannot mutate the
 * other.
 */
export const areDisjointPaths = (left: string, right: string): boolean =>
  !isSameOrDescendantOf(left, right) && !isSameOrDescendantOf(right, left);
