import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach } from "vitest";

/**
 * Scoped temp-directory factory: call once in a test file, use the returned
 * function to create temp dirs, and they all get cleaned up automatically
 * after each test.
 *
 * @param prefix  Unique prefix for generated directory names (e.g. "typeweaver-init-")
 * @param root    Parent directory for the temp dirs (defaults to OS temp)
 */
export const createTempDirFactory = (
  prefix: string,
  root: string = os.tmpdir()
): (() => string) => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const tempDir of tempDirs) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    tempDirs.length = 0;
  });

  return () => {
    const tempDir = fs.mkdtempSync(path.join(root, prefix));
    tempDirs.push(tempDir);
    return tempDir;
  };
};
