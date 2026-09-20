import { isBodySizeOverLimit } from "./BodyLimitPolicy.js";
import { RequestBodyDrainTimeoutError, PayloadTooLargeError } from "./errors/index.js";
import type { IncomingMessage } from "node:http";

export type DrainRequestResult = {
  readonly exceededLimit: boolean;
  readonly timedOut: boolean;
  readonly totalBytes: number;
};

export type DrainRequestOptions = {
  readonly destroyOnLimitExceeded?: boolean;
  readonly timeoutMs?: number;
};

export const REQUEST_DRAIN_TIMEOUT_MS = 5_000;

export async function drainRequestStream(
  req: IncomingMessage,
  maxBodySize: number,
  options: DrainRequestOptions = {},
): Promise<DrainRequestResult> {
  if (req.readableEnded || req.destroyed) {
    return { exceededLimit: false, timedOut: false, totalBytes: 0 };
  }
  return await drainRequestBody(req, maxBodySize, options);
}

const drainRequestBody = (
  req: IncomingMessage,
  maxBodySize: number,
  options: DrainRequestOptions,
): Promise<DrainRequestResult> =>
  new Promise<DrainRequestResult>((resolve) => {
    const destroyOnLimitExceeded = options.destroyOnLimitExceeded ?? true;
    const timeoutMs = options.timeoutMs ?? REQUEST_DRAIN_TIMEOUT_MS;
    let drainedBytes = 0;
    let isSettled = false;
    let drainTimeout: NodeJS.Timeout | undefined;

    const cleanup = (): void => {
      if (drainTimeout !== undefined) clearTimeout(drainTimeout);
      req.off("data", handleData);
      req.off("end", handleSettled);
      req.off("error", handleSettled);
      req.off("aborted", handleSettled);
      req.off("close", handleSettled);
    };

    const finish = (result: Omit<DrainRequestResult, "totalBytes">, destroy: boolean): void => {
      if (isSettled) return;
      isSettled = true;
      cleanup();
      if (destroy) req.destroy();
      resolve({ ...result, totalBytes: drainedBytes });
    };

    const handleData = (chunk: Buffer | string): void => {
      drainedBytes += typeof chunk === "string" ? Buffer.byteLength(chunk) : chunk.byteLength;
      if (isBodySizeOverLimit(drainedBytes, maxBodySize)) {
        finish({ exceededLimit: true, timedOut: false }, destroyOnLimitExceeded);
      }
    };

    const handleSettled = (): void => {
      finish({ exceededLimit: false, timedOut: false }, false);
    };

    drainTimeout = setTimeout(() => {
      finish({ exceededLimit: false, timedOut: true }, destroyOnLimitExceeded);
    }, timeoutMs);
    drainTimeout.unref();

    req.on("data", handleData);
    req.on("end", handleSettled);
    req.on("error", handleSettled);
    req.on("aborted", handleSettled);
    req.on("close", handleSettled);
    req.resume();
  });

export function bodyDrainError(
  result: DrainRequestResult,
  maxBodySize: number,
): PayloadTooLargeError | RequestBodyDrainTimeoutError | undefined {
  if (result.exceededLimit) {
    return new PayloadTooLargeError(result.totalBytes, maxBodySize);
  }
  if (result.timedOut) {
    return new RequestBodyDrainTimeoutError(maxBodySize, REQUEST_DRAIN_TIMEOUT_MS);
  }
  return undefined;
}
