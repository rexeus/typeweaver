import { TestAssertionError } from "test-utils";
import { expect } from "vitest";
import {
  createNodeBodyLimitPolicy,
  markRequestBodyPrevalidated,
} from "../../../src/lib/BodyLimitPolicy.js";
import {
  BodyParseError,
  PayloadTooLargeError,
} from "../../../src/lib/Errors.js";
import { FetchApiAdapter } from "../../../src/lib/FetchApiAdapter.js";
import { BASE_URL, isUnknownRecord } from "../../helpers.js";

export function createAdapterRequest(
  path: string,
  init?: RequestInit
): Request {
  return new Request(`${BASE_URL}${path}`, init);
}

export function createAdapterRequestWithStream(
  path: string,
  headers: Record<string, string>,
  body: ReadableStream<Uint8Array>
): Request {
  const request = createAdapterRequest(path, { method: "POST", headers });
  Object.defineProperty(request, "body", { value: body });
  return request;
}

export function parseRequest(request: Request, url?: URL) {
  return new FetchApiAdapter().toRequest(request, url);
}

export function requireUnknownRecord(value: unknown): Record<string, unknown> {
  if (!isUnknownRecord(value)) {
    throw new TestAssertionError("Expected an object body");
  }
  return value;
}

export function createByteStream(
  chunks: readonly Uint8Array[],
  cancel: () => Promise<void>
): ReadableStream<Uint8Array> {
  const queuedChunks = [...chunks];

  return new ReadableStream<Uint8Array>({
    pull(controller) {
      const chunk = queuedChunks.shift();
      if (chunk) {
        controller.enqueue(chunk);
        return;
      }
      controller.close();
    },
    cancel,
  });
}

export function createSixByteStream(
  cancel: () => Promise<void>
): ReadableStream<Uint8Array> {
  return createByteStream(
    [new Uint8Array([1, 2, 3]), new Uint8Array([4, 5, 6])],
    cancel
  );
}

export async function expectBodyParseError(
  request: Request,
  expectedMessage: string
): Promise<void> {
  await expect(parseRequest(request)).rejects.toSatisfy(
    (error: BodyParseError) => {
      expect(error).toBeInstanceOf(BodyParseError);
      expect(error.message).toContain(expectedMessage);
      expect(error.cause).toBeDefined();
      return true;
    }
  );
}

export async function expectPayloadTooLargeError(
  promise: Promise<unknown>,
  expectedContentLength: number,
  expectedMaxBodySize: number
): Promise<void> {
  await expect(promise).rejects.toSatisfy((error: PayloadTooLargeError) => {
    expect(error).toBeInstanceOf(PayloadTooLargeError);
    expect(error.contentLength).toBe(expectedContentLength);
    expect(error.maxBodySize).toBe(expectedMaxBodySize);
    expect(error.message).toContain(`${expectedContentLength} bytes`);
    expect(error.message).toContain(`${expectedMaxBodySize} bytes`);
    return true;
  });
}

export function createPrevalidatedRequest(
  path: string,
  init: RequestInit,
  maxBodySize = 1_048_576
): Request {
  const request = createAdapterRequest(path, init);
  markRequestBodyPrevalidated(request, createNodeBodyLimitPolicy(maxBodySize));
  return request;
}

export function createBodyStream(
  chunks: readonly string[],
  cancel: () => Promise<void> = async () => {}
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const encodedChunks = chunks.map(chunk => encoder.encode(chunk));

  return new ReadableStream<Uint8Array>({
    pull(controller) {
      const chunk = encodedChunks.shift();
      if (chunk) {
        controller.enqueue(chunk);
        return;
      }
      controller.close();
    },
    cancel,
  });
}
