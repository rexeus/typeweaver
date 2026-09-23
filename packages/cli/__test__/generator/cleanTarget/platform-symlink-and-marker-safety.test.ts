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

describe("Generator platform-specific ancestor clean safety", () => {
  test.skipIf(process.platform === "win32")(
    "rejects ancestors when a POSIX child segment contains a literal backslash after dot-dot",
    () => {
      const workspaceRoot = createTempDir();
      const packagesDirectory = path.join(workspaceRoot, "packages");
      const packageDirectory = path.join(
        packagesDirectory,
        "..\\generated",
        "cli"
      );
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
    }
  );

  test.runIf(process.platform === "win32")(
    "rejects ancestors addressed through native Windows separators",
    () => {
      const workspaceRoot = createTempDir();
      const packagesDirectory = path.join(workspaceRoot, "packages");
      const packageDirectory = path.join(
        packagesDirectory,
        "..generated",
        "cli"
      );
      fs.mkdirSync(path.join(workspaceRoot, ".git"), { recursive: true });
      fs.mkdirSync(packageDirectory, { recursive: true });

      const nativeWindowsTarget = packagesDirectory.replaceAll("/", "\\");
      const error = captureUnsafeCleanTargetError(() =>
        assertSafeCleanTarget(nativeWindowsTarget, packageDirectory)
      );

      expect(error).toEqual(
        expect.objectContaining({
          outputDir: nativeWindowsTarget,
          reason: "ancestor-of-current-working-directory",
          resolvedOutputDir: packagesDirectory,
          currentWorkingDirectory: packageDirectory,
        })
      );
    }
  );
});

describe("Generator symlinked output clean safety", () => {
  test.skipIf(!canCreateDirectorySymlinks())(
    "rejects ancestors reached through a symlinked workspace alias",
    () => {
      const { workspaceRoot, packageDirectory } =
        createWorkspaceWithPackageDirectory();
      const aliasParent = createTempDir();
      const workspaceAlias = path.join(aliasParent, "workspace-link");
      fs.symlinkSync(workspaceRoot, workspaceAlias, directorySymlinkType);
      const aliasPackagesDirectory = path.join(workspaceAlias, "packages");

      const error = captureUnsafeCleanTargetError(() =>
        assertSafeCleanTarget(aliasPackagesDirectory, packageDirectory)
      );

      expect(error).toEqual(
        expect.objectContaining({
          outputDir: aliasPackagesDirectory,
          reason: "ancestor-of-current-working-directory",
          resolvedOutputDir: aliasPackagesDirectory,
          currentWorkingDirectory: packageDirectory,
        })
      );
    }
  );

  test.skipIf(!canCreateDirectorySymlinks())(
    "rejects output symlinks that resolve to the current working directory",
    () => {
      const currentWorkingDirectory = createTempDir();
      const symlinkParent = createTempDir();
      const symlinkedOutputDirectory = path.join(symlinkParent, "cwd-link");
      fs.symlinkSync(
        currentWorkingDirectory,
        symlinkedOutputDirectory,
        directorySymlinkType
      );

      const error = captureUnsafeCleanTargetError(() =>
        assertSafeCleanTarget(symlinkedOutputDirectory, currentWorkingDirectory)
      );

      expect(error).toEqual(
        expect.objectContaining({
          outputDir: symlinkedOutputDirectory,
          reason: "current-working-directory",
          resolvedOutputDir: symlinkedOutputDirectory,
          currentWorkingDirectory,
        })
      );
    }
  );

  test.skipIf(!canCreateDirectorySymlinks())(
    "rejects output symlinks that resolve to the protected workspace root",
    () => {
      const { workspaceRoot, packageDirectory } =
        createWorkspaceWithPackageDirectory();
      const symlinkParent = createTempDir();
      const symlinkedOutputDirectory = path.join(
        symlinkParent,
        "workspace-root-link"
      );
      fs.symlinkSync(
        workspaceRoot,
        symlinkedOutputDirectory,
        directorySymlinkType
      );

      const error = captureUnsafeCleanTargetError(() =>
        assertSafeCleanTarget(symlinkedOutputDirectory, packageDirectory)
      );

      expect(error).toEqual(
        expect.objectContaining({
          outputDir: symlinkedOutputDirectory,
          reason: "workspace-root",
          resolvedOutputDir: symlinkedOutputDirectory,
          currentWorkingDirectory: packageDirectory,
          protectedWorkspaceRoot: workspaceRoot,
        })
      );
    }
  );
});

describe("Generator clean-target containment", () => {
  test("rejects clean targets above the workspace root that contain the current working directory", () => {
    const { workspaceRoot, packageDirectory } =
      createWorkspaceWithPackageDirectory();
    const workspaceParent = path.dirname(workspaceRoot);

    const error = captureUnsafeCleanTargetError(() =>
      assertSafeCleanTarget(workspaceParent, packageDirectory)
    );

    expect(error).toEqual(
      expect.objectContaining({
        outputDir: workspaceParent,
        reason: "ancestor-of-current-working-directory",
        resolvedOutputDir: workspaceParent,
        currentWorkingDirectory: packageDirectory,
      })
    );
  });

  test("allows workspace output directories that do not contain the current working directory", () => {
    const { workspaceRoot, packageDirectory } =
      createWorkspaceWithPackageDirectory();
    const outputDirectory = path.join(workspaceRoot, "generated", "types");

    expect(() =>
      assertSafeCleanTarget(outputDirectory, packageDirectory)
    ).not.toThrow();
  });

  test("allows descendants of the current working directory", () => {
    const { packageDirectory } = createWorkspaceWithPackageDirectory();

    expect(() =>
      assertSafeCleanTarget("generated/types", packageDirectory)
    ).not.toThrow();
  });

  test("rejects ancestors when no workspace markers exist above the current working directory", () => {
    const currentWorkingDirectory = path.join(
      createTempDir(),
      "packages",
      "cli"
    );
    fs.mkdirSync(currentWorkingDirectory, { recursive: true });

    const error = captureUnsafeCleanTargetError(() =>
      assertSafeCleanTarget("..", currentWorkingDirectory)
    );

    expect(error).toEqual(
      expect.objectContaining({
        outputDir: "..",
        reason: "ancestor-of-current-working-directory",
        resolvedOutputDir: path.dirname(currentWorkingDirectory),
        currentWorkingDirectory,
      })
    );
  });
});

describe("Generator clean-target workspace markers", () => {
  test("rejects clean targets that themselves contain a .git workspace marker", () => {
    const currentWorkingDirectory = createTempDir();
    const foreignWorkspaceRoot = createTempDir();
    fs.mkdirSync(path.join(foreignWorkspaceRoot, ".git"), { recursive: true });

    const error = captureUnsafeCleanTargetError(() =>
      assertSafeCleanTarget(foreignWorkspaceRoot, currentWorkingDirectory)
    );

    expect(error).toEqual(
      expect.objectContaining({
        outputDir: foreignWorkspaceRoot,
        reason: "target-carries-workspace-marker",
      })
    );
    expect(fs.realpathSync.native(error.protectedWorkspaceRoot ?? "")).toBe(
      fs.realpathSync.native(foreignWorkspaceRoot)
    );
  });

  test("rejects clean targets that themselves contain a pnpm-workspace.yaml marker", () => {
    const currentWorkingDirectory = createTempDir();
    const foreignWorkspaceRoot = createTempDir();
    fs.writeFileSync(
      path.join(foreignWorkspaceRoot, "pnpm-workspace.yaml"),
      "packages:\n  - packages/*\n"
    );

    const error = captureUnsafeCleanTargetError(() =>
      assertSafeCleanTarget(foreignWorkspaceRoot, currentWorkingDirectory)
    );

    expect(error).toEqual(
      expect.objectContaining({
        outputDir: foreignWorkspaceRoot,
        reason: "target-carries-workspace-marker",
      })
    );
    expect(fs.realpathSync.native(error.protectedWorkspaceRoot ?? "")).toBe(
      fs.realpathSync.native(foreignWorkspaceRoot)
    );
  });

  // Representative of the file-only markers (lerna.json, nx.json, turbo.json,
  // rush.json). One test covers the shape; the guard treats them uniformly.
  test("rejects clean targets that themselves contain a lerna.json workspace marker", () => {
    const currentWorkingDirectory = createTempDir();
    const foreignWorkspaceRoot = createTempDir();
    fs.writeFileSync(
      path.join(foreignWorkspaceRoot, "lerna.json"),
      '{"version": "independent"}\n'
    );

    const error = captureUnsafeCleanTargetError(() =>
      assertSafeCleanTarget(foreignWorkspaceRoot, currentWorkingDirectory)
    );

    expect(error).toEqual(
      expect.objectContaining({
        outputDir: foreignWorkspaceRoot,
        reason: "target-carries-workspace-marker",
      })
    );
    expect(fs.realpathSync.native(error.protectedWorkspaceRoot ?? "")).toBe(
      fs.realpathSync.native(foreignWorkspaceRoot)
    );
  });
});
