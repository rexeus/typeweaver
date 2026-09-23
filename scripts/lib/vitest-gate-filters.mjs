import { existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

/**
 * Vitest gate filter contract.
 *
 * Vitest treats each positional CLI argument as a case-insensitive substring
 * of a test file path, so a gate that lists exact files keeps passing after a
 * suite is split while it silently runs fewer tests. Every positional filter
 * of a package script that runs Vitest must therefore be either:
 *
 * - a directory ending in `/` that contains test files, which selects a whole
 *   suite family including any later split inside it; or
 * - the exact path of an unsplit test file. Its directory must mirror a source
 *   directory (`__test__/<path>` beside `src/<path>`), because a test directory
 *   without a source counterpart groups the split suites of one subject. It
 *   must also have no sibling `<stem>/` directory, and every sibling
 *   `<stem>.<aspect>` test file must be selected too.
 */

/** @typedef {import("./vitest-gate-discovery.mjs").VitestGate} VitestGate */

const TEST_FILE_PATTERN = /\.(?:test|spec)\.[cm]?[jt]sx?$/u;

/**
 * @param {string} name
 * @returns {boolean}
 */
const isSkippedDirectory = name =>
  name === "node_modules" || name === "dist" || name.startsWith(".");

/**
 * @param {string} rootDirectory
 * @returns {string[]} Sorted POSIX test file paths relative to the root.
 */
const listTestFiles = rootDirectory => {
  /** @type {string[]} */
  const files = [];
  /** @param {string} relativeDirectory */
  const visit = relativeDirectory => {
    const entries = readdirSync(path.join(rootDirectory, relativeDirectory), {
      withFileTypes: true,
    });
    for (const entry of entries) {
      const relativePath = path.posix.join(relativeDirectory, entry.name);
      if (entry.isDirectory() && !isSkippedDirectory(entry.name)) {
        visit(relativePath);
      } else if (entry.isFile() && TEST_FILE_PATTERN.test(entry.name)) {
        files.push(relativePath);
      }
    }
  };
  visit("");
  return files.sort();
};

/**
 * @param {string} filter
 * @returns {string}
 */
const normalizeFilter = filter => filter.replace(/^\.\//u, "");

/**
 * Mirrors Vitest's case-insensitive substring matching of CLI filters.
 *
 * @param {string} filter
 * @param {string} file
 * @returns {boolean}
 */
const selects = (filter, file) =>
  file.toLowerCase().includes(normalizeFilter(filter).toLowerCase());

/**
 * @param {string} target
 * @param {"directory" | "file"} kind
 * @returns {boolean}
 */
const existsAs = (target, kind) =>
  existsSync(target) &&
  (kind === "directory"
    ? statSync(target).isDirectory()
    : statSync(target).isFile());

/**
 * Maps `__test__/<path>/file` to `src/<path>`; tests outside `__test__` sit
 * beside their sources and have no mirror to check.
 *
 * @param {string} file
 * @returns {string | undefined}
 */
const mirroredSourceDirectory = file => {
  const segments = path.posix.dirname(file).split("/");
  const testRoot = segments.indexOf("__test__");
  return testRoot === -1
    ? undefined
    : [
        ...segments.slice(0, testRoot),
        "src",
        ...segments.slice(testRoot + 1),
      ].join("/");
};

/**
 * @param {{ rootDirectory: string, filter: string, testFiles: readonly string[], selected: ReadonlySet<string> }} context
 * @returns {string[]}
 */
const exactFileFailures = ({ rootDirectory, filter, testFiles, selected }) => {
  const file = normalizeFilter(filter);
  const stem = file.replace(TEST_FILE_PATTERN, "");
  const sourceDirectory = mirroredSourceDirectory(file);
  if (
    sourceDirectory !== undefined &&
    !existsAs(path.join(rootDirectory, sourceDirectory), "directory")
  ) {
    return [`sits in the suite directory '${path.posix.dirname(file)}/'`];
  }
  if (existsAs(path.join(rootDirectory, stem), "directory")) {
    return [`names one file of the suite split into '${stem}/'`];
  }
  return testFiles
    .filter(
      sibling =>
        sibling !== file &&
        sibling.startsWith(`${stem}.`) &&
        !selected.has(sibling)
    )
    .map(sibling => `leaves the split sibling '${sibling}' unselected`);
};

/**
 * @param {{ rootDirectory: string, filter: string, testFiles: readonly string[], selected: ReadonlySet<string> }} context
 * @returns {string[]}
 */
const filterFailures = context => {
  const { rootDirectory, filter, testFiles } = context;
  if (!testFiles.some(file => selects(filter, file))) {
    return ["selects no test file"];
  }
  const target = path.join(rootDirectory, filter);
  if (filter.endsWith("/")) {
    return existsAs(target, "directory") ? [] : ["is not a directory"];
  }
  if (!TEST_FILE_PATTERN.test(filter) || !existsAs(target, "file")) {
    return ["must be a test file or a directory ending in '/'"];
  }
  return exactFileFailures(context);
};

/**
 * @param {VitestGate} gate
 * @returns {string[]} One message per rejected filter.
 */
export const validateVitestGate = gate => {
  const { label, rootDirectory, filters } = gate;
  if (rootDirectory === undefined) {
    return [`${label}: targets a workspace package that does not exist`];
  }
  const testFiles = listTestFiles(rootDirectory);
  const selected = new Set(
    testFiles.filter(file => filters.some(filter => selects(filter, file)))
  );
  return filters.flatMap(filter =>
    filterFailures({ rootDirectory, filter, testFiles, selected }).map(
      reason => `${label}: filter '${filter}' ${reason}`
    )
  );
};
