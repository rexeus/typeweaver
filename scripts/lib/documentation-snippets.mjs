import { mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const fixturePrefix = "typeweaver-doc-snippets-";

/**
 * The generated documentation snippets import workspace packages and `zod`. A
 * fixture outside the repository cannot rely on the directory walk that resolves
 * them in-tree, so link the CLI workspace's installed modules under the fixture.
 * `junction` is a Windows directory link that needs no elevation and is ignored
 * on POSIX, where an ordinary directory symlink is created instead.
 */
const linkWorkspaceModules = ({ workspaceRoot, fixtureRoot }) => {
  const workspaceModules = path.join(
    workspaceRoot,
    "packages",
    "cli",
    "node_modules"
  );
  symlinkSync(
    workspaceModules,
    path.join(fixtureRoot, "node_modules"),
    "junction"
  );
};

export const createDocumentationSnippetFixture = ({
  workspaceRoot,
  tempRoot = tmpdir(),
}) => {
  const fixtureRoot = mkdtempSync(path.join(tempRoot, fixturePrefix));
  linkWorkspaceModules({ workspaceRoot, fixtureRoot });
  return fixtureRoot;
};

/**
 * Removes a snippet fixture and is safe to call more than once. `rmSync` deletes
 * the `node_modules` link itself rather than following it.
 */
export const removeDocumentationSnippetFixture = fixtureRoot => {
  rmSync(fixtureRoot, { recursive: true, force: true });
};

/**
 * Stages a snippet fixture and runs `body` against it. The fixture is removed on
 * normal completion and on thrown failures. An abrupt termination such as
 * SIGKILL cannot be observed, so it may leave an OS-temp directory behind; that
 * residue sits outside the repository and does not dirty it.
 */
export const withDocumentationSnippetFixture = ({
  workspaceRoot,
  tempRoot,
  body,
}) => {
  const fixtureRoot = createDocumentationSnippetFixture({
    workspaceRoot,
    tempRoot,
  });
  try {
    return body(fixtureRoot);
  } finally {
    removeDocumentationSnippetFixture(fixtureRoot);
  }
};
