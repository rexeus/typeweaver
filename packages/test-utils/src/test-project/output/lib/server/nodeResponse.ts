import {
  badRequestDefaultError,
  createDefaultErrorBody,
  internalServerErrorDefaultError,
  payloadTooLargeDefaultError,
} from "@rexeus/typeweaver-core";
import { createRejectedRequestBodyCleanup } from "./requestBody.js";
import type { IncomingMessage, ServerResponse } from "node:http";

export function writeResponseHeaders(res: ServerResponse, response: Response): void {
  response.headers.forEach((value, key) => {
    if (key.toLowerCase() !== "set-cookie") res.setHeader(key, value);
  });
  const cookies = response.headers.getSetCookie();
  if (cookies.length > 0) res.setHeader("set-cookie", cookies);
}

export async function readWritableResponseBody(
  method: string | undefined,
  response: Response,
  reportError: (error: unknown) => void,
): Promise<Buffer | undefined> {
  if (shouldWriteResponseBody(method, response.status)) {
    return Buffer.from(await response.arrayBuffer());
  }

  cancelSuppressedResponseBody(response, reportError);
  return undefined;
}

export function writeDefaultErrorResponse(
  res: ServerResponse,
  error:
    | typeof badRequestDefaultError
    | typeof payloadTooLargeDefaultError
    | typeof internalServerErrorDefaultError,
  options: {
    readonly method?: string | undefined;
    readonly onFinished?: (() => void) | undefined;
  } = {},
): void {
  if (!res.headersSent) {
    res.writeHead(error.statusCode, { "content-type": "application/json" });
  }

  if (options.onFinished !== undefined) res.once("finish", options.onFinished);

  const body = shouldWriteResponseBody(options.method, error.statusCode)
    ? JSON.stringify(createDefaultErrorBody(error))
    : undefined;
  res.end(body);
}

export function writeBadRequestResponse(
  req: IncomingMessage,
  res: ServerResponse,
  maxBodySize: number,
): void {
  writeDefaultErrorResponse(res, badRequestDefaultError, {
    method: req.method,
    onFinished: createRejectedRequestBodyCleanup(req, maxBodySize),
  });
}

function shouldWriteResponseBody(method: string | undefined, status: number): boolean {
  return method !== "HEAD" && status !== 204 && status !== 304;
}

function cancelSuppressedResponseBody(
  response: Response,
  reportError: (error: unknown) => void,
): void {
  try {
    void response.body?.cancel().catch((error) => {
      reportSuppressedResponseBodyCancelError(error, reportError);
    });
  } catch (error) {
    reportSuppressedResponseBodyCancelError(error, reportError);
  }
}

function reportSuppressedResponseBodyCancelError(
  error: unknown,
  reportError: (error: unknown) => void,
): void {
  try {
    reportError(error);
  } catch (onErrorFailure) {
    console.error("TypeweaverApp: onError callback threw while handling error", {
      onErrorFailure,
      originalError: error,
    });
  }
}
