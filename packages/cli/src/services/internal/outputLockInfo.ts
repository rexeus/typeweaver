import fs from "node:fs";
import path from "node:path";
import { errnoCode } from "./nodeFsErrors.js";

export const OUTPUT_LOCK_INFO_FILE = "info.json";

export type OutputLockInfo = {
  readonly pid: number;
  readonly startedAt: string;
  readonly inputFile: string;
  readonly ownerToken?: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

export const decodeOutputLockInfo = (
  parsed: unknown
): OutputLockInfo | undefined => {
  if (!isRecord(parsed)) {
    return undefined;
  }

  const candidate = parsed;
  if (
    typeof candidate["pid"] !== "number" ||
    typeof candidate["startedAt"] !== "string"
  ) {
    return undefined;
  }
  if (
    candidate["ownerToken"] !== undefined &&
    typeof candidate["ownerToken"] !== "string"
  ) {
    return undefined;
  }

  return {
    pid: candidate["pid"],
    startedAt: candidate["startedAt"],
    inputFile:
      typeof candidate["inputFile"] === "string" ? candidate["inputFile"] : "",
    ...(candidate["ownerToken"] === undefined
      ? {}
      : { ownerToken: candidate["ownerToken"] }),
  };
};

const isUnavailableLockInfo = (error: unknown): boolean =>
  error instanceof SyntaxError ||
  errnoCode(error) === "ENOENT" ||
  errnoCode(error) === "ENOTDIR";

/**
 * Reads one lock metadata file. Missing or malformed metadata returns
 * `undefined`; unexpected filesystem failures propagate so callers can decide
 * whether they are typed failures or defects.
 */
export const readOutputLockInfo = (
  lockDirectory: string
): OutputLockInfo | undefined => {
  try {
    const raw = fs.readFileSync(
      path.join(lockDirectory, OUTPUT_LOCK_INFO_FILE),
      "utf8"
    );
    return decodeOutputLockInfo(JSON.parse(raw) as unknown);
  } catch (error) {
    if (isUnavailableLockInfo(error)) {
      return undefined;
    }
    throw error;
  }
};
