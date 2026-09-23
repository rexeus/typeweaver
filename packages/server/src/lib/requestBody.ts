import { isBodySizeOverLimit, parseContentLength } from "./BodyLimitPolicy.js";
import {
  PayloadTooLargeError,
  RequestBodyDrainTimeoutError,
} from "./errors/index.js";
import { collectRequestBody } from "./requestBodyCollection.js";
import { bodyDrainError, drainRequestStream } from "./requestBodyDrain.js";
import type { IncomingMessage } from "node:http";

export function shouldValidateRequestBody(method?: string): boolean {
  return method !== "GET" && method !== "HEAD";
}

export function hasReadableRequestBody(req: IncomingMessage): boolean {
  return (
    req.headers["content-length"] !== undefined ||
    req.headers["transfer-encoding"] !== undefined
  );
}

export function isRequestBodyLimitError(
  error: unknown
): error is PayloadTooLargeError | RequestBodyDrainTimeoutError {
  return (
    error instanceof PayloadTooLargeError ||
    error instanceof RequestBodyDrainTimeoutError
  );
}

export function enforceContentLengthLimit(
  req: IncomingMessage,
  maxBodySize: number
): void {
  const contentLength = parseContentLength(req.headers["content-length"]);
  if (
    contentLength !== undefined &&
    isBodySizeOverLimit(contentLength, maxBodySize)
  ) {
    throw new PayloadTooLargeError(contentLength, maxBodySize);
  }
}

export async function readRequestBody(
  req: IncomingMessage,
  shouldValidateBody: boolean,
  maxBodySize: number
): Promise<ArrayBuffer | undefined> {
  if (!shouldValidateBody) return undefined;
  return collectRequestBody(req, maxBodySize);
}

export async function drainUnvalidatedRequestBody(
  req: IncomingMessage,
  bodyLimitPolicy: { readonly maxBodySize: number }
): Promise<void> {
  if (shouldValidateRequestBody(req.method) || !hasReadableRequestBody(req)) {
    return;
  }
  const drainResult = await drainRequestStream(
    req,
    bodyLimitPolicy.maxBodySize,
    {
      destroyOnLimitExceeded: false,
    }
  );
  const error = bodyDrainError(drainResult, bodyLimitPolicy.maxBodySize);
  if (error) throw error;
}

export function createRejectedRequestBodyCleanup(
  req: IncomingMessage,
  maxBodySize: number
): (() => void) | undefined {
  if (!hasReadableRequestBody(req)) return undefined;

  return () => {
    const contentLength = parseContentLength(req.headers["content-length"]);
    if (
      contentLength !== undefined &&
      isBodySizeOverLimit(contentLength, maxBodySize)
    ) {
      req.destroy();
      return;
    }

    void drainRequestStream(req, maxBodySize, { destroyOnLimitExceeded: true });
  };
}

export async function drainRequest(
  req: IncomingMessage,
  maxBodySize: number,
  options: Parameters<typeof drainRequestStream>[2] = {}
) {
  return drainRequestStream(req, maxBodySize, options);
}
