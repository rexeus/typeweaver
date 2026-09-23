import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { isUnsupportedFilesystemOperationError } from "./fixtures.js";
import type { FileSystemError } from "./fixtures.js";

const isSymlinkUnsupportedError = (error: unknown): boolean => {
  return isUnsupportedFilesystemOperationError(error);
};

type SymlinkCapability =
  | { readonly supported: true }
  | { readonly supported: false; readonly reason: string };

const detectSymlinkCapability = (): SymlinkCapability => {
  const tempDir = fs.mkdtempSync(
    path.join(os.tmpdir(), "typeweaver-gen-symlink-")
  );

  try {
    const targetDir = path.join(tempDir, "target");
    fs.mkdirSync(targetDir);
    fs.symlinkSync(targetDir, path.join(tempDir, "link"), "dir");

    return { supported: true };
  } catch (error) {
    if (isSymlinkUnsupportedError(error)) {
      const errorCode = (error as FileSystemError).code;

      return {
        supported: false,
        reason: `symlink creation failed with ${errorCode}`,
      };
    }

    throw error;
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
};

/**
 * Probed once when a symlink suite imports this module; unsupported hosts
 * skip those scenarios and append the reason to their titles.
 */
export const symlinkCapability = detectSymlinkCapability();

export const symlinkSkipReason = symlinkCapability.supported
  ? ""
  : ` (${symlinkCapability.reason})`;
