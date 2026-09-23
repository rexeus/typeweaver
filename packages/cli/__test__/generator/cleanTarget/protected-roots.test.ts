import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { assertSafeCleanTarget } from "../../../src/services/cleanTargetGuard.js";
import {
  canCreateDirectorySymlinks,
  directorySymlinkType,
} from "../../helpers/symlinks.js";
import {
  captureUnsafeCleanTargetError,
  createTempDir,
  createWorkspaceWithPackageDirectory,
  removeTempDirs,
} from "./fixtures.js";

afterEach(removeTempDirs);

describe("Generator filesystem and working-directory clean safety", () => {
  test.runIf(process.platform === "win32")(
    "provides the junction capability required by Windows clean-target tests",
    () => {
      expect(canCreateDirectorySymlinks()).toBe(true);
    }
  );

  test("rejects filesystem root clean targets", () => {
    const outputDir = path.parse(process.cwd()).root;
    const error = captureUnsafeCleanTargetError(() =>
      assertSafeCleanTarget(outputDir, process.cwd())
    );

    expect(error).toEqual(
      expect.objectContaining({
        outputDir,
        reason: "filesystem-root",
        filesystemRoot: outputDir,
      })
    );
    expect(error.details).toEqual({
      reason: "filesystem-root",
      resolvedOutputDir: outputDir,
      currentWorkingDirectory: process.cwd(),
      filesystemRoot: outputDir,
    });
  });

  test.each([
    { scenario: "empty", cleanTarget: "" },
    { scenario: "whitespace-only", cleanTarget: "   " },
  ])("rejects $scenario clean targets", ({ cleanTarget }) => {
    const error = captureUnsafeCleanTargetError(() =>
      assertSafeCleanTarget(cleanTarget, process.cwd())
    );

    expect(error).toEqual(
      expect.objectContaining({
        outputDir: cleanTarget,
        reason: "empty-path",
      })
    );
  });

  test("rejects clean targets that resolve to the current working directory", () => {
    const currentWorkingDirectory = createTempDir();

    const error = captureUnsafeCleanTargetError(() =>
      assertSafeCleanTarget(currentWorkingDirectory, currentWorkingDirectory)
    );

    expect(error).toEqual(
      expect.objectContaining({
        outputDir: currentWorkingDirectory,
        reason: "current-working-directory",
        currentWorkingDirectory,
      })
    );
  });

  test("rejects relative clean targets that resolve to the current working directory", () => {
    const currentWorkingDirectory = createTempDir();

    const error = captureUnsafeCleanTargetError(() =>
      assertSafeCleanTarget(".", currentWorkingDirectory)
    );

    expect(error).toEqual(
      expect.objectContaining({
        outputDir: ".",
        reason: "current-working-directory",
        resolvedOutputDir: currentWorkingDirectory,
        currentWorkingDirectory,
      })
    );
  });

  test("rejects relative clean targets that resolve to the filesystem root", () => {
    const currentWorkingDirectory = path.join(
      createTempDir(),
      "packages",
      "cli"
    );
    fs.mkdirSync(currentWorkingDirectory, { recursive: true });
    const filesystemRoot = path.parse(currentWorkingDirectory).root;
    const relativeFilesystemRoot = path.relative(
      currentWorkingDirectory,
      filesystemRoot
    );

    const error = captureUnsafeCleanTargetError(() =>
      assertSafeCleanTarget(relativeFilesystemRoot, currentWorkingDirectory)
    );

    expect(error).toEqual(
      expect.objectContaining({
        outputDir: relativeFilesystemRoot,
        reason: "filesystem-root",
        resolvedOutputDir: filesystemRoot,
        currentWorkingDirectory,
        filesystemRoot,
      })
    );
  });
});

describe("Generator inferred workspace-root clean safety", () => {
  test("rejects clean targets that resolve to the inferred workspace root", () => {
    const { workspaceRoot, packageDirectory } =
      createWorkspaceWithPackageDirectory();

    const error = captureUnsafeCleanTargetError(() =>
      assertSafeCleanTarget(workspaceRoot, packageDirectory)
    );

    expect(error).toEqual(
      expect.objectContaining({
        outputDir: workspaceRoot,
        reason: "workspace-root",
        resolvedOutputDir: workspaceRoot,
        currentWorkingDirectory: packageDirectory,
        protectedWorkspaceRoot: workspaceRoot,
      })
    );
  });

  test("rejects relative clean targets that resolve to the inferred workspace root", () => {
    const { workspaceRoot, packageDirectory } =
      createWorkspaceWithPackageDirectory();

    const error = captureUnsafeCleanTargetError(() =>
      assertSafeCleanTarget("../../", packageDirectory)
    );

    expect(error).toEqual(
      expect.objectContaining({
        outputDir: "../../",
        reason: "workspace-root",
        resolvedOutputDir: workspaceRoot,
        currentWorkingDirectory: packageDirectory,
        protectedWorkspaceRoot: workspaceRoot,
      })
    );
  });

  test.skipIf(!canCreateDirectorySymlinks())(
    "rejects workspace roots reached from a symlinked current working directory",
    () => {
      const workspaceRoot = createTempDir();
      const packagesDirectory = path.join(workspaceRoot, "packages");
      const realCliDirectory = path.join(createTempDir(), "cli-real");
      const symlinkedCliPath = path.join(packagesDirectory, "cli");
      fs.mkdirSync(path.join(workspaceRoot, ".git"), { recursive: true });
      fs.mkdirSync(packagesDirectory, { recursive: true });
      fs.mkdirSync(realCliDirectory, { recursive: true });
      fs.symlinkSync(realCliDirectory, symlinkedCliPath, directorySymlinkType);

      const error = captureUnsafeCleanTargetError(() =>
        assertSafeCleanTarget("../..", symlinkedCliPath)
      );

      expect(error).toEqual(
        expect.objectContaining({
          outputDir: "../..",
          reason: "workspace-root",
        })
      );
    }
  );
});

describe("Generator workspace ancestor clean safety", () => {
  test("rejects workspace roots discovered by pnpm-workspace.yaml", () => {
    const { workspaceRoot, packageDirectory } =
      createWorkspaceWithPackageDirectory("pnpm-workspace.yaml");

    const error = captureUnsafeCleanTargetError(() =>
      assertSafeCleanTarget(workspaceRoot, packageDirectory)
    );

    expect(error).toEqual(
      expect.objectContaining({
        outputDir: workspaceRoot,
        reason: "workspace-root",
        resolvedOutputDir: workspaceRoot,
        currentWorkingDirectory: packageDirectory,
        protectedWorkspaceRoot: workspaceRoot,
      })
    );
  });

  test("rejects relative ancestors of the current working directory inside the protected workspace", () => {
    const { packageDirectory } = createWorkspaceWithPackageDirectory();

    const error = captureUnsafeCleanTargetError(() =>
      assertSafeCleanTarget("..", packageDirectory)
    );

    expect(error).toEqual(
      expect.objectContaining({
        outputDir: "..",
        reason: "ancestor-of-current-working-directory",
        resolvedOutputDir: path.dirname(packageDirectory),
        currentWorkingDirectory: packageDirectory,
      })
    );
  });

  test("rejects absolute ancestors of the current working directory inside the protected workspace", () => {
    const { workspaceRoot, packageDirectory } =
      createWorkspaceWithPackageDirectory();
    const packagesDirectory = path.join(workspaceRoot, "packages");

    const error = captureUnsafeCleanTargetError(() =>
      assertSafeCleanTarget(packagesDirectory, packageDirectory)
    );

    expect(error).toEqual(
      expect.objectContaining({
        outputDir: packagesDirectory,
        reason: "ancestor-of-current-working-directory",
        resolvedOutputDir: packagesDirectory,
        currentWorkingDirectory: packageDirectory,
      })
    );
  });

  test("rejects ancestors when the child segment starts with dot-dot characters", () => {
    const workspaceRoot = createTempDir();
    const packagesDirectory = path.join(workspaceRoot, "packages");
    const packageDirectory = path.join(packagesDirectory, "..generated", "cli");
    fs.mkdirSync(path.join(workspaceRoot, ".git"), { recursive: true });
    fs.mkdirSync(packageDirectory, { recursive: true });

    const error = captureUnsafeCleanTargetError(() =>
      assertSafeCleanTarget(packagesDirectory, packageDirectory)
    );

    expect(error).toEqual(
      expect.objectContaining({
        outputDir: packagesDirectory,
        reason: "ancestor-of-current-working-directory",
        resolvedOutputDir: packagesDirectory,
        currentWorkingDirectory: packageDirectory,
      })
    );
  });
});
