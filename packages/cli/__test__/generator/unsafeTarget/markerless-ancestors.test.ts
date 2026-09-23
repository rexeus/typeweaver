import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { writeTinySpec } from "../../helpers/specFiles.js";
import {
  canCreateDirectorySymlinks,
  directorySymlinkType,
} from "../../helpers/symlinks.js";
import {
  createIsolatedTempDirectory,
  expectUnsafeCleanTargetFailure,
  removeTempDirs,
  runGenerateExit,
} from "./fixtures.js";

afterEach(removeTempDirs);

describe("Generator markerless ancestor safety", () => {
  test("rejects a lexical cwd ancestor before the no-clean orphan sweep", async () => {
    const isolatedRoot = createIsolatedTempDirectory("lexical-ancestor");
    const workspace = path.join(isolatedRoot, "workspace");
    fs.mkdirSync(workspace);
    writeTinySpec(workspace);

    const orphanDir = path.join(isolatedRoot, ".typeweaver-ABC123");
    const sentinel = path.join(orphanDir, "keep.txt");
    fs.mkdirSync(orphanDir);
    fs.writeFileSync(sentinel, "must survive");

    const exit = await runGenerateExit(workspace, "..", false);

    expectUnsafeCleanTargetFailure(
      exit,
      "ancestor-of-current-working-directory"
    );
    expect(fs.readFileSync(sentinel, "utf8")).toBe("must survive");
  });

  test.skipIf(!canCreateDirectorySymlinks())(
    "rejects a canonical cwd ancestor before the no-clean orphan sweep",
    async () => {
      const canonicalRoot = createIsolatedTempDirectory("canonical-ancestor");
      const canonicalWorkspace = path.join(canonicalRoot, "workspace");
      fs.mkdirSync(canonicalWorkspace);
      writeTinySpec(canonicalWorkspace);

      const aliasRoot = createIsolatedTempDirectory("canonical-alias");
      const workspaceAlias = path.join(aliasRoot, "workspace-link");
      fs.symlinkSync(canonicalWorkspace, workspaceAlias, directorySymlinkType);

      const orphanDir = path.join(canonicalRoot, ".typeweaver-ABC123");
      const sentinel = path.join(orphanDir, "keep.txt");
      fs.mkdirSync(orphanDir);
      fs.writeFileSync(sentinel, "must survive");

      const exit = await runGenerateExit(workspaceAlias, canonicalRoot, false);

      expectUnsafeCleanTargetFailure(
        exit,
        "ancestor-of-current-working-directory"
      );
      expect(fs.readFileSync(sentinel, "utf8")).toBe("must survive");
    }
  );
});
