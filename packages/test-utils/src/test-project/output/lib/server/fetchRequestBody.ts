import type { IHttpBody } from "@rexeus/typeweaver-core";
import {
  hasSatisfiedBodyLimitPolicy,
  isBodySizeOverLimit,
  parseContentLength,
} from "./BodyLimitPolicy.js";
import { BodyParseError, PayloadTooLargeError } from "./Errors.js";
import { appendRequestRecordValue } from "./requestRecord.js";
import type { BodyLimitPolicy } from "./BodyLimitPolicy.js";

export async function parseFetchRequestBody(
  request: Request,
  bodyLimitPolicy: BodyLimitPolicy,
): Promise<IHttpBody> {
  if (!request.body) return undefined;

  const checkedRequest = await enforceBodySizeLimit(request, bodyLimitPolicy);
  const contentType = checkedRequest.headers.get("content-type");

  if (isJsonContentType(contentType)) return parseJsonBody(checkedRequest);
  if (isTextContentType(contentType)) return parseTextBody(checkedRequest);
  if (isFormUrlencodedContentType(contentType)) {
    return parseFormUrlencodedBody(checkedRequest);
  }
  if (isMultipartFormDataContentType(contentType)) {
    return parseMultipartBody(checkedRequest);
  }
  return parseRawBody(checkedRequest);
}

function extractMediaType(contentType: string | null): string | null {
  if (!contentType) return null;
  return (contentType.split(";")[0] ?? "").trim().toLowerCase();
}

function isJsonContentType(contentType: string | null): boolean {
  const mediaType = extractMediaType(contentType);
  return mediaType === "application/json" || mediaType?.endsWith("+json") === true;
}

function isTextContentType(contentType: string | null): boolean {
  return extractMediaType(contentType)?.startsWith("text/") === true;
}

function isFormUrlencodedContentType(contentType: string | null): boolean {
  return extractMediaType(contentType) === "application/x-www-form-urlencoded";
}

function isMultipartFormDataContentType(contentType: string | null): boolean {
  return extractMediaType(contentType) === "multipart/form-data";
}

async function parseJsonBody(request: Request): Promise<IHttpBody> {
  try {
    const text = await request.text();
    return JSON.parse(text, (key: string, value: unknown) => {
      if (key === "__proto__") return undefined;
      return value;
    }) as unknown;
  } catch (error) {
    throw new BodyParseError("Invalid JSON in request body", { cause: error });
  }
}

async function parseTextBody(request: Request): Promise<IHttpBody> {
  try {
    return await request.text();
  } catch (error) {
    throw new BodyParseError("Failed to read text request body", {
      cause: error,
    });
  }
}

async function parseFormUrlencodedBody(request: Request): Promise<IHttpBody> {
  let text: string;
  try {
    text = await request.text();
  } catch (error) {
    throw new BodyParseError("Failed to read form-urlencoded request body", {
      cause: error,
    });
  }

  const result: Record<string, string | string[]> = Object.create(null) as Record<
    string,
    string | string[]
  >;
  new URLSearchParams(text).forEach((value, key) => {
    appendRequestRecordValue(result, key, value);
  });
  return result;
}

async function parseMultipartBody(request: Request): Promise<IHttpBody> {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch (error) {
    throw new BodyParseError("Invalid multipart/form-data in request body", {
      cause: error,
    });
  }

  const result: Record<string, string | File | (string | File)[]> = Object.create(null) as Record<
    string,
    string | File | (string | File)[]
  >;
  formData.forEach((value, key) => {
    const existing = result[key];
    if (existing === undefined) result[key] = value;
    else if (Array.isArray(existing)) existing.push(value);
    else result[key] = [existing, value];
  });
  return result;
}

async function parseRawBody(request: Request): Promise<IHttpBody> {
  try {
    const text = await request.text();
    return text || undefined;
  } catch (error) {
    throw new BodyParseError("Failed to read request body", { cause: error });
  }
}

async function enforceBodySizeLimit(
  request: Request,
  bodyLimitPolicy: BodyLimitPolicy,
): Promise<Request> {
  if (hasSatisfiedBodyLimitPolicy(request, bodyLimitPolicy)) return request;

  const contentLength = parseContentLength(request.headers.get("content-length"));
  if (
    contentLength !== undefined &&
    isBodySizeOverLimit(contentLength, bodyLimitPolicy.maxBodySize)
  ) {
    throw new PayloadTooLargeError(contentLength, bodyLimitPolicy.maxBodySize);
  }

  return readBodyWithLimit(request, bodyLimitPolicy);
}

async function readBodyWithLimit(
  request: Request,
  bodyLimitPolicy: BodyLimitPolicy,
): Promise<Request> {
  if (!request.body) return request;

  const reader: ReadableStreamDefaultReader<Uint8Array> = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (isBodySizeOverLimit(totalBytes, bodyLimitPolicy.maxBodySize)) {
        throw new PayloadTooLargeError(totalBytes, bodyLimitPolicy.maxBodySize);
      }
      chunks.push(value);
    }
  } catch (error) {
    try {
      await reader.cancel();
    } catch {
      // Preserve the original read failure if stream cleanup also fails.
    }
    throw error;
  } finally {
    try {
      reader.releaseLock();
    } catch {
      // Some runtimes may report release errors after stream termination.
    }
  }

  return new Request(request.url, {
    method: request.method,
    headers: request.headers,
    body: concatChunks(chunks, totalBytes),
  });
}

function concatChunks(chunks: readonly Uint8Array[], totalBytes: number): ArrayBuffer {
  const buffer = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    buffer.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return buffer.buffer;
}
