import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import {
  createDocumentationSnippetFixture,
  removeDocumentationSnippetFixture,
  withDocumentationSnippetFixture,
} from "./lib/documentation-snippets.mjs";

const workspaceRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const fixturePrefix = "typeweaver-doc-snippets-";
const listFixtures = () =>
  readdirSync(tmpdir())
    .filter(name => name.startsWith(fixturePrefix))
    .sort();
const gitStatus = () => {
  const result = spawnSync(
    "git",
    ["-C", workspaceRoot, "status", "--porcelain"],
    {
      encoding: "utf8",
    }
  );
  assert.equal(result.status, 0, result.stderr);
  return result.stdout;
};

const workspacePrefix = `${path.resolve(workspaceRoot)}${path.sep}`;
const assertOutsideWorkspace = fixtureRoot => {
  assert(
    !path.resolve(fixtureRoot).startsWith(workspacePrefix),
    `fixture staged inside the workspace: ${fixtureRoot}`
  );
};

const fixturesBefore = listFixtures();
const statusBefore = gitStatus();

const fixtureRoot = createDocumentationSnippetFixture({ workspaceRoot });
assertOutsideWorkspace(fixtureRoot);
assert(
  existsSync(path.join(fixtureRoot, "node_modules")),
  "fixture did not link workspace modules"
);
removeDocumentationSnippetFixture(fixtureRoot);
assert(!existsSync(fixtureRoot), "fixture survived cleanup");
removeDocumentationSnippetFixture(fixtureRoot);

let failedFixtureRoot;
assert.throws(
  () =>
    withDocumentationSnippetFixture({
      workspaceRoot,
      body: root => {
        failedFixtureRoot = root;
        throw new Error("fixture body failed");
      },
    }),
  /fixture body failed/
);
assert(!existsSync(failedFixtureRoot), "fixture survived a failed body");

let completedFixtureRoot;
withDocumentationSnippetFixture({
  workspaceRoot,
  body: root => {
    completedFixtureRoot = root;
  },
});
assert(!existsSync(completedFixtureRoot), "fixture survived a successful body");

assert.deepEqual(
  listFixtures(),
  fixturesBefore,
  "fixture staging left files in OS temp"
);
assert.equal(gitStatus(), statusBefore, "fixture staging dirtied git status");

process.stdout.write(
  "Documentation snippet fixtures stage outside the workspace and clean up after success and failure\n"
);
