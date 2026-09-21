import type { IHttpHeader } from "@rexeus/typeweaver-core";
import { ResponseSerializationError } from "./Errors.js";

export function serializeFetchResponseBody(body: unknown): string | ArrayBuffer | Blob | null {
  if (body === undefined || body === null) return null;
  if (typeof body === "string") return body;
  if (body instanceof ArrayBuffer) return body;
  if (body instanceof Blob) return body;

  try {
    const serializedBody = JSON.stringify(body);
    if (serializedBody === undefined) {
      throw new TypeError("Response body cannot be serialized to JSON");
    }
    return serializedBody;
  } catch (error) {
    throw new ResponseSerializationError("Failed to serialize response body to JSON", {
      cause: error,
    });
  }
}

export function buildFetchResponseHeaders(header?: IHttpHeader, body?: unknown): Headers {
  const headers = new Headers();
  if (header) {
    for (const [key, value] of Object.entries(header)) {
      appendResponseHeader(headers, key, value);
    }
  }
  if (!headers.has("content-type") && isJsonBody(body)) {
    headers.set("content-type", "application/json");
  }
  if (!headers.has("content-type") && body instanceof Blob && body.type) {
    headers.set("content-type", body.type);
  }
  return headers;
}

function appendResponseHeader(
  headers: Headers,
  key: string,
  value: string | string[] | undefined,
): void {
  if (value === undefined) return;
  if (Array.isArray(value)) {
    for (const item of value) headers.append(key, item);
    return;
  }
  headers.set(key, String(value));
}

function isJsonBody(body: unknown): boolean {
  return (
    body !== undefined &&
    body !== null &&
    typeof body !== "string" &&
    !(body instanceof Blob) &&
    !(body instanceof ArrayBuffer)
  );
}
