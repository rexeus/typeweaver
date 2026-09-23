import { spawnSync } from "node:child_process";

/**
 * One `git status --porcelain=v1 -z` record. `originalPath` is present only
 * for rename and copy records, which name the source path in a second
 * NUL-terminated field.
 *
 * @typedef {object} WorktreeStatusEntry
 * @property {string} status
 * @property {string} path
 * @property {string} [originalPath]
 */

/** @param {string} status @returns {boolean} */
const carriesOriginalPath = status => /[RC]/u.test(status);

/** @param {string} record @returns {{ status: string, path: string }} */
const parseRecord = record => {
  if (record.length < 4 || record[2] !== " ")
    throw new Error(`Malformed git status record: ${JSON.stringify(record)}`);
  return { status: record.slice(0, 2), path: record.slice(3) };
};

/**
 * Parses `git status --porcelain=v1 -z` output. A rename or copy record is
 * followed by its original path as a separate field, so fields cannot be read
 * one record at a time.
 *
 * @param {string} output
 * @returns {WorktreeStatusEntry[]}
 */
export const parsePorcelainStatus = output => {
  const fields = output.split("\0");
  if (fields.at(-1) === "") fields.pop();
  /** @type {WorktreeStatusEntry[]} */
  const entries = [];
  for (let index = 0; index < fields.length; index += 1) {
    const entry = parseRecord(fields[index] ?? "");
    if (!carriesOriginalPath(entry.status)) {
      entries.push(entry);
      continue;
    }
    index += 1;
    const originalPath = fields[index];
    if (originalPath === undefined || originalPath === "")
      throw new Error(
        `git status record lacks its original path: ${entry.path}`
      );
    entries.push({ ...entry, originalPath });
  }
  return entries;
};

/**
 * Reads the worktree status of `cwd`, including every untracked file.
 *
 * @param {string} cwd
 * @returns {WorktreeStatusEntry[]}
 */
export const readWorktreeStatus = cwd => {
  const result = spawnSync(
    "git",
    ["status", "--porcelain=v1", "-z", "--untracked-files=all"],
    { cwd, encoding: "utf8", maxBuffer: 50 * 1024 * 1024 }
  );
  if (result.error !== undefined) throw result.error;
  if (result.status !== 0)
    throw new Error(
      `git status failed with exit code ${String(result.status)}`
    );
  return parsePorcelainStatus(result.stdout);
};
