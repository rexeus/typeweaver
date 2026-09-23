import path from "node:path";
import { isProcessAlive } from "./processLiveness.js";
import type { OutputLockInfo } from "./outputLockInfo.js";
import type { OutputLock } from "./outputLockOperations.js";

/**
 * A long-lived runtime can survive a transient release failure while the
 * on-disk lock still names its live PID. Remember only the exact ownership
 * token whose finalizer release failed so a later acquisition in this process
 * can distinguish that abandoned lock from a genuinely active concurrent run.
 */
const failedOutputLockReleases = new Map<string, string>();

const outputLockReleaseKey = (lockPath: string): string =>
  path.resolve(lockPath);

export const rememberFailedOutputLockRelease = (lock: OutputLock): void => {
  failedOutputLockReleases.set(
    outputLockReleaseKey(lock.path),
    lock.ownerToken
  );
};

export const forgetFailedOutputLockRelease = (lock: OutputLock): void => {
  const key = outputLockReleaseKey(lock.path);
  if (failedOutputLockReleases.get(key) === lock.ownerToken) {
    failedOutputLockReleases.delete(key);
  }
};

export const forgetFailedOutputLockReleaseAt = (lockPath: string): void => {
  failedOutputLockReleases.delete(outputLockReleaseKey(lockPath));
};

export const isActiveOutputLock = (
  lockPath: string,
  holder: OutputLockInfo
): boolean =>
  !(
    holder.pid === process.pid &&
    holder.ownerToken !== undefined &&
    failedOutputLockReleases.get(outputLockReleaseKey(lockPath)) ===
      holder.ownerToken
  ) && isProcessAlive(holder.pid);
