import fs from "node:fs";
import path from "node:path";

/**
 * Serializes every file below `workspace` (sorted POSIX paths plus UTF-8
 * contents) so a test can prove a command left the project untouched.
 */
export const collectWorkspace = (workspace: string): string => {
  const files: string[] = [];
  const visit = (directory: string): void => {
    for (const entry of fs
      .readdirSync(directory, { withFileTypes: true })
      .sort((left, right) => left.name.localeCompare(right.name))) {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        visit(entryPath);
      } else {
        files.push(path.relative(workspace, entryPath));
      }
    }
  };
  visit(workspace);
  return files
    .map(
      file =>
        `${file.replaceAll(path.sep, "/")}\0${fs.readFileSync(path.join(workspace, file), "utf8")}`
    )
    .join("\0");
};

/**
 * Maps every file below `root` to its base64 contents; a missing root yields
 * an empty snapshot.
 */
export const snapshotTree = (root: string): Record<string, string> => {
  const snapshot: Record<string, string> = {};
  if (!fs.existsSync(root)) {
    return snapshot;
  }
  const pending = [""];
  while (pending.length > 0) {
    const relativeDirectory = pending.pop() ?? "";
    const absoluteDirectory = path.join(root, relativeDirectory);
    for (const entry of fs.readdirSync(absoluteDirectory, {
      withFileTypes: true,
    })) {
      const relativePath =
        relativeDirectory === ""
          ? entry.name
          : `${relativeDirectory}/${entry.name}`;
      if (entry.isDirectory()) {
        pending.push(relativePath);
      } else {
        snapshot[relativePath] = fs
          .readFileSync(path.join(root, relativePath))
          .toString("base64");
      }
    }
  }
  return snapshot;
};
