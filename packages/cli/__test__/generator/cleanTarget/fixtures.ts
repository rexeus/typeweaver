import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { UnsafeCleanTargetError } from "../../../src/errors/UnsafeCleanTargetError.js";

type WorkspaceMarker = ".git" | "pnpm-workspace.yaml";

export const captureUnsafeCleanTargetError = (
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

const tempDirs: string[] = [];

export const removeTempDirs = (): void => {
  for (const tempDir of tempDirs) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }

  tempDirs.length = 0;
};

export const createTempDir = (): string => {
  const tempDir = fs.mkdtempSync(
    path.join(os.tmpdir(), "typeweaver-generator-")
  );
  tempDirs.push(tempDir);

  return tempDir;
};

export const createWorkspaceWithPackageDirectory = (
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
