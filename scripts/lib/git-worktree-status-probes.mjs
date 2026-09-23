import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  parsePorcelainStatus,
  readWorktreeStatus,
} from "./git-worktree-status.mjs";

/**
 * Proves the porcelain parser keeps rename and copy records aligned. Each
 * such record carries its original path in a second NUL-terminated field; a
 * parser that reads one field per record turns that original path into a
 * bogus record and shifts every later one.
 */

/** @returns {void} */
const assertSampleParsing = () => {
  const sample = [
    " M packages/core/src/index.ts",
    "R  packages/gen/src/renamed.ts",
    "packages/gen/src/original.ts",
    "?? scripts/new file.mjs",
    "RM packages/cli/src/moved -> here.ts",
    "packages/cli/src/moved.ts",
    "C  packages/types/src/copy.ts",
    "packages/types/src/source.ts",
    " D packages/server/src/removed.ts",
    "",
  ].join("\0");
  assert.deepEqual(parsePorcelainStatus(sample), [
    { status: " M", path: "packages/core/src/index.ts" },
    {
      status: "R ",
      path: "packages/gen/src/renamed.ts",
      originalPath: "packages/gen/src/original.ts",
    },
    { status: "??", path: "scripts/new file.mjs" },
    {
      status: "RM",
      path: "packages/cli/src/moved -> here.ts",
      originalPath: "packages/cli/src/moved.ts",
    },
    {
      status: "C ",
      path: "packages/types/src/copy.ts",
      originalPath: "packages/types/src/source.ts",
    },
    { status: " D", path: "packages/server/src/removed.ts" },
  ]);
  assert.deepEqual(parsePorcelainStatus(""), []);
  assert.throws(
    () => parsePorcelainStatus("R  packages/gen/src/renamed.ts\0"),
    /lacks its original path/u
  );
  assert.throws(
    () => parsePorcelainStatus("packages/gen/src/original.ts\0"),
    /Malformed git status record/u
  );
};

/** @param {string} cwd @param {readonly string[]} args @returns {void} */
const git = (cwd, args) => {
  execFileSync(
    "git",
    [
      "-c",
      "user.name=Probe",
      "-c",
      "user.email=probe@example.invalid",
      "-c",
      "commit.gpgsign=false",
      ...args,
    ],
    { cwd, stdio: "ignore" }
  );
};

/** @returns {void} */
const assertStagedRenameParsing = () => {
  const repository = mkdtempSync(path.join(os.tmpdir(), "git-status-probe-"));
  try {
    git(repository, ["init", "--quiet"]);
    writeFileSync(path.join(repository, "before.ts"), "export {};\n");
    git(repository, ["add", "before.ts"]);
    git(repository, ["commit", "--quiet", "-m", "probe"]);
    git(repository, ["mv", "before.ts", "after.ts"]);
    writeFileSync(path.join(repository, "untracked.ts"), "export {};\n");
    assert.deepEqual(readWorktreeStatus(repository), [
      { status: "R ", path: "after.ts", originalPath: "before.ts" },
      { status: "??", path: "untracked.ts" },
    ]);
  } finally {
    rmSync(repository, { recursive: true, force: true });
  }
};

/** @returns {void} */
export const assertWorktreeStatusParsing = () => {
  assertSampleParsing();
  assertStagedRenameParsing();
};
