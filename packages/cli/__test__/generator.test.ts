import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { UnsafeCleanTargetError } from "../src/generators/errors/UnsafeCleanTargetError.js";
import { assertSafeCleanTarget } from "../src/generators/Generator.js";

type WorkspaceMarker = ".git" | "pnpm-workspace.yaml";

const directorySymlinkType = process.platform === "win32" ? "junction" : "dir";

const isUnsupportedSymlinkError = (error: unknown): boolean => {
  return (
    error instanceof Error &&
    "code" in error &&
    ["EACCES", "EINVAL", "ENOTSUP", "EPERM"].includes(String(error.code))
  );
};

const canCreateDirectorySymlinks = (): boolean => {
  const tempDir = fs.mkdtempSync(
    path.join(os.tmpdir(), "typeweaver-symlink-support-")
  );
  const targetDirectory = path.join(tempDir, "target");
  const symlinkDirectory = path.join(tempDir, "link");

  try {
    fs.mkdirSync(targetDirectory);
    fs.symlinkSync(targetDirectory, symlinkDirectory, directorySymlinkType);

    return true;
  } catch (error) {
    if (isUnsupportedSymlinkError(error)) {
      return false;
    }

    throw error;
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
};

const captureUnsafeCleanTargetError = (
  action: () => void
): UnsafeCleanTargetError => {
  try {
    action();
  } catch (error) {
    if (error instanceof UnsafeCleanTargetError) {
      return error;
    }
  }

  throw new Error("Expected UnsafeCleanTargetError to be thrown");
};

describe("Generator clean safety", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const tempDir of tempDirs) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }

    tempDirs.length = 0;
  });

  const createTempDir = (): string => {
    const tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "typeweaver-generator-")
    );
    tempDirs.push(tempDir);

    return tempDir;
  };

  const createWorkspaceWithPackageDirectory = (
    marker: WorkspaceMarker = ".git"
  ): {
    readonly workspaceRoot: string;
    readonly packageDirectory: string;
  } => {
    const workspaceRoot = createTempDir();
    const packageDirectory = path.join(workspaceRoot, "packages", "cli");

    if (marker === ".git") {
      fs.mkdirSync(path.join(workspaceRoot, marker), { recursive: true });
    } else {
      fs.writeFileSync(
        path.join(workspaceRoot, marker),
        "packages:\n  - packages/*\n"
      );
    }
    fs.mkdirSync(packageDirectory, { recursive: true });

    return { workspaceRoot, packageDirectory };
  };

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

  test("allows clean targets when no workspace markers exist above the current working directory", () => {
    const currentWorkingDirectory = path.join(
      createTempDir(),
      "packages",
      "cli"
    );
    fs.mkdirSync(currentWorkingDirectory, { recursive: true });

    expect(() =>
      assertSafeCleanTarget("..", currentWorkingDirectory)
    ).not.toThrow();
  });
});
