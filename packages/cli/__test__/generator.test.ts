import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
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
    expect(() =>
      assertSafeCleanTarget(path.parse(process.cwd()).root, process.cwd())
    ).toThrow(/filesystem root/);
  });

  test.each([
    { scenario: "empty", cleanTarget: "" },
    { scenario: "whitespace-only", cleanTarget: "   " },
  ])("rejects $scenario clean targets", ({ cleanTarget }) => {
    expect(() => assertSafeCleanTarget(cleanTarget, process.cwd())).toThrow(
      /empty output directory/
    );
  });

  test("rejects clean targets that resolve to the current working directory", () => {
    const currentWorkingDirectory = createTempDir();

    expect(() =>
      assertSafeCleanTarget(currentWorkingDirectory, currentWorkingDirectory)
    ).toThrow(/current working directory/);
  });

  test("rejects relative clean targets that resolve to the current working directory", () => {
    const currentWorkingDirectory = createTempDir();

    expect(() => assertSafeCleanTarget(".", currentWorkingDirectory)).toThrow(
      /current working directory/
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

    expect(() =>
      assertSafeCleanTarget(relativeFilesystemRoot, currentWorkingDirectory)
    ).toThrow(/filesystem root/);
  });

  test("rejects clean targets that resolve to the inferred workspace root", () => {
    const { workspaceRoot, packageDirectory } =
      createWorkspaceWithPackageDirectory();

    expect(() =>
      assertSafeCleanTarget(workspaceRoot, packageDirectory)
    ).toThrow(/inferred workspace root/);
  });

  test("rejects relative clean targets that resolve to the inferred workspace root", () => {
    const { packageDirectory } = createWorkspaceWithPackageDirectory();

    expect(() => assertSafeCleanTarget("../../", packageDirectory)).toThrow(
      /inferred workspace root/
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

      expect(() => assertSafeCleanTarget("../..", symlinkedCliPath)).toThrow(
        /inferred workspace root/
      );
    }
  );

  test("rejects workspace roots discovered by pnpm-workspace.yaml", () => {
    const { workspaceRoot, packageDirectory } =
      createWorkspaceWithPackageDirectory("pnpm-workspace.yaml");

    expect(() =>
      assertSafeCleanTarget(workspaceRoot, packageDirectory)
    ).toThrow(/inferred workspace root/);
  });

  test("rejects relative ancestors of the current working directory inside the protected workspace", () => {
    const { packageDirectory } = createWorkspaceWithPackageDirectory();

    expect(() => assertSafeCleanTarget("..", packageDirectory)).toThrow(
      /ancestor directory/
    );
  });

  test("rejects absolute ancestors of the current working directory inside the protected workspace", () => {
    const { workspaceRoot, packageDirectory } =
      createWorkspaceWithPackageDirectory();
    const packagesDirectory = path.join(workspaceRoot, "packages");

    expect(() =>
      assertSafeCleanTarget(packagesDirectory, packageDirectory)
    ).toThrow(/ancestor directory/);
  });

  test("rejects ancestors when the child segment starts with dot-dot characters", () => {
    const workspaceRoot = createTempDir();
    const packagesDirectory = path.join(workspaceRoot, "packages");
    const packageDirectory = path.join(packagesDirectory, "..generated", "cli");
    fs.mkdirSync(path.join(workspaceRoot, ".git"), { recursive: true });
    fs.mkdirSync(packageDirectory, { recursive: true });

    expect(() =>
      assertSafeCleanTarget(packagesDirectory, packageDirectory)
    ).toThrow(/ancestor directory/);
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

      expect(() =>
        assertSafeCleanTarget(packagesDirectory, packageDirectory)
      ).toThrow(/ancestor directory/);
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

      expect(() =>
        assertSafeCleanTarget(aliasPackagesDirectory, packageDirectory)
      ).toThrow(/ancestor directory/);
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

      expect(() =>
        assertSafeCleanTarget(symlinkedOutputDirectory, currentWorkingDirectory)
      ).toThrow(/current working directory/);
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

      expect(() =>
        assertSafeCleanTarget(symlinkedOutputDirectory, packageDirectory)
      ).toThrow(/inferred workspace root/);
    }
  );

  test("rejects clean targets above the workspace root that contain the current working directory", () => {
    const { workspaceRoot, packageDirectory } =
      createWorkspaceWithPackageDirectory();
    const workspaceParent = path.dirname(workspaceRoot);

    expect(() =>
      assertSafeCleanTarget(workspaceParent, packageDirectory)
    ).toThrow(/ancestor directory/);
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
