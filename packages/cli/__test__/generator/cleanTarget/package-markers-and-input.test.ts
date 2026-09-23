import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { UnsafeCleanTargetError } from "../../../src/errors/UnsafeCleanTargetError.js";
import {
  assertSafeCleanTarget,
  assertSafeCleanTargetWith,
} from "../../../src/services/cleanTargetGuard.js";
import type { CleanTargetFs } from "../../../src/services/cleanTargetGuard.js";

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

describe("Generator clean-target package markers", () => {
  test("rejects clean targets that themselves contain a package.json declaring workspaces", () => {
    const currentWorkingDirectory = createTempDir();
    const foreignWorkspaceRoot = createTempDir();
    fs.writeFileSync(
      path.join(foreignWorkspaceRoot, "package.json"),
      JSON.stringify({ name: "foreign-workspace", workspaces: ["packages/*"] })
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

  test("allows clean targets whose package.json has no workspaces field", () => {
    const currentWorkingDirectory = createTempDir();
    const foreignTarget = createTempDir();
    fs.writeFileSync(
      path.join(foreignTarget, "package.json"),
      JSON.stringify({ name: "lone-package", version: "1.0.0" })
    );

    expect(() =>
      assertSafeCleanTarget(foreignTarget, currentWorkingDirectory)
    ).not.toThrow();
  });
});

describe("Generator clean-target input containment", () => {
  test("rejects clean targets that contain the spec input file", () => {
    const workspace = createTempDir();
    const specDir = path.join(workspace, "spec");
    const specFile = path.join(specDir, "index.ts");
    const knownPaths = new Set([workspace, specDir, specFile]);

    const fakeFs: CleanTargetFs = {
      exists: probePath => knownPaths.has(probePath),
      isSymbolicLink: () => false,
      readFileString: () => "{}",
      realPath: probePath => probePath,
    };

    const error = captureUnsafeCleanTargetError(() =>
      assertSafeCleanTargetWith(specDir, workspace, fakeFs, specFile)
    );

    expect(error).toEqual(
      expect.objectContaining({
        outputDir: specDir,
        reason: "contains-input-file",
        inputFile: specFile,
      })
    );
  });

  test("allows clean targets that do not contain the spec input file", () => {
    const workspace = createTempDir();
    const specFile = path.join(workspace, "spec", "index.ts");
    const generatedDir = path.join(workspace, "generated");

    expect(() =>
      assertSafeCleanTarget(generatedDir, workspace, specFile)
    ).not.toThrow();
  });
});
