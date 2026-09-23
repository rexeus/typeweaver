import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/** Windows tests use junctions, which need no symlink privilege. */
export const directorySymlinkType =
  process.platform === "win32" ? "junction" : "dir";

const isUnsupportedSymlinkError = (error: unknown): boolean => {
  return (
    error instanceof Error &&
    "code" in error &&
    ["EACCES", "EINVAL", "ENOTSUP", "EPERM"].includes(String(error.code))
  );
};

/**
 * Reports whether this host can create directory symlinks, so symlink
 * scenarios can be skipped where the platform forbids them.
 */
export const canCreateDirectorySymlinks = (): boolean => {
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
