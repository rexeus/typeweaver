import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { ConcurrentGenerationError } from "../../errors/index.js";
import {
  canonicalHostTempDirectory,
  ensureTrustedHostTempDirectory,
} from "./hostTemp.js";
import { errnoCode } from "./nodeFsErrors.js";
import { outputLockDirectory } from "./outputCoordinationArtifact.js";
import { OUTPUT_LOCK_INFO_FILE, readOutputLockInfo } from "./outputLockInfo.js";
import {
  forgetFailedOutputLockReleaseAt,
  isActiveOutputLock,
} from "./outputLockState.js";
import type { OutputLockInfo } from "./outputLockInfo.js";

export type OutputLock = {
  readonly path: string;
  readonly outputDir: string;
  readonly ownerToken: string;
};

export type OutputLockAcquisitionHooks = {
  readonly onLockDirectoryCreated: (lockDir: string) => void;
  readonly onBeforeStaleLockMove: (lockDir: string) => void;
};

export const sameLockInfo = (
  left: OutputLockInfo,
  right: OutputLockInfo
): boolean =>
  left.pid === right.pid &&
  left.startedAt === right.startedAt &&
  left.ownerToken === right.ownerToken;

const holderOrUnknown = (holder: OutputLockInfo | undefined) =>
  holder === undefined
    ? ({ _tag: "Unknown" } as const)
    : ({
        _tag: "Known",
        pid: holder.pid,
        startedAt: holder.startedAt,
      } as const);

export const lockFencePath = (
  lockDir: string,
  info: OutputLockInfo
): string => {
  const identity =
    info.ownerToken ??
    `${info.pid}\u0000${info.startedAt}\u0000${info.inputFile}`;
  const digest = createHash("sha256")
    .update(identity)
    .digest("hex")
    .slice(0, 24);
  return `${lockDir}.fence-${digest}`;
};

const writeLockInfo = (lockDir: string, info: OutputLockInfo): void => {
  const candidatePath = path.join(lockDir, `.${String(info.ownerToken)}.json`);
  try {
    fs.writeFileSync(candidatePath, JSON.stringify(info, null, 2), {
      flag: "wx",
      mode: 0o600,
    });
    fs.renameSync(candidatePath, path.join(lockDir, OUTPUT_LOCK_INFO_FILE));
  } finally {
    fs.rmSync(candidatePath, { force: true });
  }
};

const tryCreateLockDir = (lockDir: string): boolean => {
  try {
    fs.mkdirSync(lockDir, { mode: 0o700 });
    return true;
  } catch (error) {
    if (errnoCode(error) === "EEXIST") return false;
    throw error;
  }
};

const moveStaleLockToFence = (
  lockDir: string,
  expected: OutputLockInfo,
  hooks: OutputLockAcquisitionHooks
): boolean => {
  const current = readOutputLockInfo(lockDir);
  if (current === undefined || !sameLockInfo(current, expected)) return false;
  const fencePath = lockFencePath(lockDir, expected);
  hooks.onBeforeStaleLockMove(lockDir);
  try {
    fs.renameSync(lockDir, fencePath);
  } catch (error) {
    const code = errnoCode(error);
    if (code === "EEXIST" || code === "ENOTEMPTY" || code === "ENOENT") {
      return false;
    }
    throw error;
  }
  const fenced = readOutputLockInfo(fencePath);
  if (fenced === undefined || !sameLockInfo(fenced, expected)) {
    if (!fs.existsSync(lockDir)) fs.renameSync(fencePath, lockDir);
    return false;
  }
  return true;
};

const rollbackLockAcquisition = (lockDir: string, ownerToken: string): void => {
  const current = readOutputLockInfo(lockDir);
  if (current !== undefined && current.ownerToken !== ownerToken) return;
  fs.rmSync(lockDir, { recursive: true, force: true });
};

const tryAcquireNewOutputLock = (
  params: { readonly outputDir: string; readonly inputFile: string },
  hooks: OutputLockAcquisitionHooks
): OutputLock | undefined => {
  ensureTrustedHostTempDirectory(canonicalHostTempDirectory());
  const lockDir = outputLockDirectory(params.outputDir);
  if (!tryCreateLockDir(lockDir)) return undefined;
  const ownerToken = randomUUID();
  try {
    hooks.onLockDirectoryCreated(lockDir);
    writeLockInfo(lockDir, {
      pid: process.pid,
      startedAt: new Date().toISOString(),
      inputFile: params.inputFile,
      ownerToken,
    });
    return { path: lockDir, outputDir: params.outputDir, ownerToken };
  } catch (error) {
    rollbackLockAcquisition(lockDir, ownerToken);
    throw error;
  }
};

export const acquireOrReclaimOutputLock = (
  lockedParams: { readonly outputDir: string; readonly inputFile: string },
  lockDir: string,
  hooks: OutputLockAcquisitionHooks
): OutputLock => {
  const acquired = tryAcquireNewOutputLock(lockedParams, hooks);
  if (acquired !== undefined) {
    forgetFailedOutputLockReleaseAt(lockDir);
    return acquired;
  }
  const holder = readOutputLockInfo(lockDir);
  if (holder === undefined) {
    throw new ConcurrentGenerationError({
      outputDir: lockedParams.outputDir,
      lockPath: lockDir,
      holder: { _tag: "Unknown" },
    });
  }
  if (isActiveOutputLock(lockDir, holder)) {
    throw new ConcurrentGenerationError({
      outputDir: lockedParams.outputDir,
      lockPath: lockDir,
      holder: { _tag: "Known", pid: holder.pid, startedAt: holder.startedAt },
    });
  }
  if (!moveStaleLockToFence(lockDir, holder, hooks)) {
    const reHolder = readOutputLockInfo(lockDir);
    if (reHolder?.ownerToken !== holder.ownerToken) {
      forgetFailedOutputLockReleaseAt(lockDir);
    }
    throw new ConcurrentGenerationError({
      outputDir: lockedParams.outputDir,
      lockPath: lockDir,
      holder:
        reHolder === undefined
          ? { _tag: "Unknown" }
          : { _tag: "Known", pid: reHolder.pid, startedAt: reHolder.startedAt },
    });
  }
  forgetFailedOutputLockReleaseAt(lockDir);
  const reclaimed = tryAcquireNewOutputLock(lockedParams, hooks);
  if (reclaimed !== undefined) return reclaimed;
  throw new ConcurrentGenerationError({
    outputDir: lockedParams.outputDir,
    lockPath: lockDir,
    holder: holderOrUnknown(readOutputLockInfo(lockDir)),
  });
};
