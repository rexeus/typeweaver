import type { ClientHttpHeader } from "@rexeus/typeweaver-core";
import { RequestSerializationError } from "./RequestSerializationError.js";

export type SerializedBody = {
  readonly body: NonNullable<RequestInit["body"]> | undefined;
  readonly isJsonSerialized: boolean;
};

export function serializeHttpScalar(
  value: unknown,
  location: "header" | "path" | "query",
  key: string,
): string {
  if (value === null) {
    throw new RequestSerializationError(location, key, value, "null-value");
  }
  if (Array.isArray(value)) {
    throw new RequestSerializationError(location, key, value, "nested-array");
  }
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      throw new RequestSerializationError(location, key, value, "invalid-date");
    }
    return value.toISOString();
  }

  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new RequestSerializationError(location, key, value, "non-finite-number");
    }
    return String(value);
  }
  if (typeof value === "boolean" || typeof value === "bigint") {
    return String(value);
  }

  throw new RequestSerializationError(location, key, value, "unsupported-type");
}

export function flattenHeaders(header: ClientHttpHeader): Record<string, string> | undefined {
  if (header === undefined) return undefined;

  const flattened: Record<string, string> = {};
  for (const [key, value] of Object.entries(header)) {
    if (value === undefined) {
      continue;
    }
    if (Array.isArray(value)) {
      // An empty header list round-trips as the empty comma-list value and is
      // normalized back to `[]` by the validator for array header schemas.
      flattened[key] = value.map((item) => serializeHttpScalar(item, "header", key)).join(", ");
      continue;
    }
    flattened[key] = serializeHttpScalar(value, "header", key);
  }
  return flattened;
}

export function mergeRequestHeaders(
  headers: Record<string, string> | undefined,
  defaultHeaders: Readonly<Record<string, string>>,
): Record<string, string> | undefined {
  const hasDefaults = Object.keys(defaultHeaders).length > 0;
  if (!hasDefaults) return headers;
  const requestHeaderNames = new Set(
    Object.keys(headers ?? {}).map((headerName) => headerName.toLowerCase()),
  );
  const applicableDefaults = Object.fromEntries(
    Object.entries(defaultHeaders).filter(
      ([headerName]) => !requestHeaderNames.has(headerName.toLowerCase()),
    ),
  );
  return { ...applicableDefaults, ...headers };
}

export function createRequestHeaders(
  headers: Record<string, string> | undefined,
  isJsonSerialized: boolean,
): Record<string, string> | undefined {
  if (!isJsonSerialized) return headers;

  const requestHeaders = headers ? { ...headers } : {};
  if (!hasContentTypeHeader(requestHeaders)) {
    requestHeaders["Content-Type"] = "application/json";
  }
  return requestHeaders;
}

export function createRequestSignal(
  signal: AbortSignal | undefined,
  timeoutMs: number | undefined,
): AbortSignal | undefined {
  if (signal === undefined) {
    return timeoutMs === undefined ? undefined : AbortSignal.timeout(timeoutMs);
  }
  if (timeoutMs === undefined) {
    return signal;
  }
  return AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]);
}

export function serializeBody(body: unknown): SerializedBody {
  if (body === null || body === undefined) {
    return { body: undefined, isJsonSerialized: false };
  }
  if (typeof body === "string") {
    return { body, isJsonSerialized: false };
  }
  if (isNativeBody(body)) return { body, isJsonSerialized: false };
  return { body: JSON.stringify(body), isJsonSerialized: true };
}

function hasContentTypeHeader(headers: Record<string, string>): boolean {
  return Object.keys(headers).some((key) => key.toLowerCase() === "content-type");
}

function isNativeBody(body: unknown): body is NonNullable<RequestInit["body"]> {
  return (
    body instanceof Blob ||
    body instanceof ArrayBuffer ||
    body instanceof FormData ||
    body instanceof URLSearchParams ||
    body instanceof ReadableStream ||
    ArrayBuffer.isView(body)
  );
}
