import { describe, expect, test, vi } from "vitest";
import {
  createNodeBodyLimitPolicy,
  markRequestBodyPrevalidated,
} from "../../src/lib/BodyLimitPolicy.js";
import { PayloadTooLargeError } from "../../src/lib/Errors.js";
import { FetchApiAdapter } from "../../src/lib/FetchApiAdapter.js";
import { BASE_URL } from "../helpers.js";

function createAdapterRequest(path: string, init?: RequestInit): Request {
  return new Request(`${BASE_URL}${path}`, init);
}

function createAdapterRequestWithStream(
  path: string,
  headers: Record<string, string>,
  body: ReadableStream<Uint8Array>
): Request {
  const request = createAdapterRequest(path, { method: "POST", headers });
  Object.defineProperty(request, "body", { value: body });
  return request;
}

function createByteStream(
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

function createSixByteStream(
  cancel: () => Promise<void>
): ReadableStream<Uint8Array> {
  return createByteStream(
    [new Uint8Array([1, 2, 3]), new Uint8Array([4, 5, 6])],
    cancel
  );
}

function createBodyStream(
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

async function expectPayloadTooLargeError(
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

function createPrevalidatedRequest(
  path: string,
  init: RequestInit,
  maxBodySize = 1_048_576
): Request {
  const request = createAdapterRequest(path, init);
  markRequestBodyPrevalidated(request, createNodeBodyLimitPolicy(maxBodySize));
  return request;
}

describe("Fetch default and streaming body limits", () => {
  test("accepts bodies at the exact Content-Length limit", async () => {
    const adapter = new FetchApiAdapter({ maxBodySize: 100 });
    const body = "x".repeat(100);
    const request = new Request(`${BASE_URL}/todos`, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain",
        "Content-Length": String(body.length),
      },
      body,
    });

    const result = await adapter.toRequest(request);

    expect(result.body).toBe(body);
  });

  test("uses the default body size limit when maxBodySize is not configured", async () => {
    const adapter = new FetchApiAdapter();
    const body = "x".repeat(10000);
    const request = new Request(`${BASE_URL}/todos`, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain",
        "Content-Length": String(body.length),
      },
      body,
    });

    const result = await adapter.toRequest(request);

    expect(result.body).toBe(body);
  });

  test("rejects oversized bodies when Content-Length is missing", async () => {
    const adapter = new FetchApiAdapter({ maxBodySize: 50 });
    const request = new Request(`${BASE_URL}/todos`, {
      method: "POST",
      body: "x".repeat(100),
    });
    request.headers.delete("content-length");

    await expect(adapter.toRequest(request)).rejects.toThrow(
      PayloadTooLargeError
    );
  });

  test("rejects under-declared Content-Length streams and cancels the stream", async () => {
    const cancel = vi.fn().mockResolvedValue(undefined);
    const actualBodySize = 6;
    const maxBodySize = 4;
    const body = createSixByteStream(cancel);
    const request = createAdapterRequestWithStream(
      "/todos",
      {
        "Content-Type": "application/octet-stream",
        "Content-Length": String(maxBodySize),
      },
      body
    );
    const adapter = new FetchApiAdapter({ maxBodySize });

    await expectPayloadTooLargeError(
      adapter.toRequest(request),
      actualBodySize,
      maxBodySize
    );

    expect(cancel).toHaveBeenCalledTimes(1);
  });

  test("accepts stream chunks that exactly reach the body limit", async () => {
    const cancel = vi.fn().mockResolvedValue(undefined);
    const body = createBodyStream(["he", "llo"], cancel);
    const request = createAdapterRequestWithStream(
      "/todos",
      { "Content-Type": "text/plain" },
      body
    );
    const adapter = new FetchApiAdapter({ maxBodySize: 5 });

    const result = await adapter.toRequest(request);

    expect(result.body).toBe("hello");
    expect(cancel).not.toHaveBeenCalled();
  });
});

describe("Fetch streaming body cancellation", () => {
  test("rejects stream chunks one byte over the body limit and cancels the stream", async () => {
    const cancel = vi.fn().mockResolvedValue(undefined);
    const body = createBodyStream(["he", "ll", "o"], cancel);
    const request = createAdapterRequestWithStream(
      "/todos",
      { "Content-Type": "text/plain" },
      body
    );
    const adapter = new FetchApiAdapter({ maxBodySize: 4 });

    await expectPayloadTooLargeError(adapter.toRequest(request), 5, 4);

    expect(cancel).toHaveBeenCalledTimes(1);
  });

  test("does not cancel streams that finish within the body limit", async () => {
    const cancel = vi.fn().mockResolvedValue(undefined);
    const body = createBodyStream(["safe"], cancel);
    const request = createAdapterRequestWithStream(
      "/todos",
      { "Content-Type": "text/plain" },
      body
    );
    const adapter = new FetchApiAdapter({ maxBodySize: 4 });

    const result = await adapter.toRequest(request);

    expect(result.body).toBe("safe");
    expect(cancel).not.toHaveBeenCalled();
  });

  test("trusts satisfied prevalidated request bodies without duplicate streaming rejection", async () => {
    const bodyThatWouldFailIfReread = "hello";
    const fetchMaxBodySize = 4;
    const request = createPrevalidatedRequest(
      "/todos",
      {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: bodyThatWouldFailIfReread,
      },
      fetchMaxBodySize
    );
    const adapter = new FetchApiAdapter({ maxBodySize: fetchMaxBodySize });

    const result = await adapter.toRequest(request);

    expect(result.body).toBe(bodyThatWouldFailIfReread);
  });

  test("revalidates looser prevalidated request bodies through the stream", async () => {
    const cancel = vi.fn().mockResolvedValue(undefined);
    const body = createBodyStream(["hello"], cancel);
    const request = createAdapterRequestWithStream(
      "/todos",
      { "Content-Type": "text/plain" },
      body
    );
    markRequestBodyPrevalidated(request, createNodeBodyLimitPolicy(8));
    const adapter = new FetchApiAdapter({ maxBodySize: 4 });

    await expectPayloadTooLargeError(adapter.toRequest(request), 5, 4);

    expect(cancel).toHaveBeenCalledTimes(1);
  });
});

describe("Fetch missing Content-Length and custom body policies", () => {
  test("accepts bodies within the limit when Content-Length is missing", async () => {
    const adapter = new FetchApiAdapter({ maxBodySize: 200 });
    const request = new Request(`${BASE_URL}/todos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Hello" }),
    });
    request.headers.delete("content-length");

    const result = await adapter.toRequest(request);

    expect(result.body).toEqual({ title: "Hello" });
  });

  test("accepts bodies at the exact limit when Content-Length is missing", async () => {
    const body = "x".repeat(50);
    const adapter = new FetchApiAdapter({ maxBodySize: 50 });
    const request = new Request(`${BASE_URL}/todos`, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body,
    });
    request.headers.delete("content-length");

    const result = await adapter.toRequest(request);

    expect(result.body).toBe(body);
  });

  test("rejects oversized multipart bodies when Content-Length is missing", async () => {
    const actualBodySize = 6;
    const maxBodySize = 4;
    const adapter = new FetchApiAdapter({ maxBodySize });
    const request = createAdapterRequestWithStream(
      "/todos",
      { "Content-Type": "multipart/form-data; boundary=typeweaver-test" },
      createSixByteStream(vi.fn())
    );

    await expectPayloadTooLargeError(
      adapter.toRequest(request),
      actualBodySize,
      maxBodySize
    );
  });

  test("uses explicit bodyLimitPolicy instead of maxBodySize", async () => {
    const actualBodySize = 5;
    const maxBodySize = 4;
    const adapter = new FetchApiAdapter({
      maxBodySize: 10,
      bodyLimitPolicy: createNodeBodyLimitPolicy(maxBodySize),
    });
    const request = createAdapterRequest("/todos", {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: "x".repeat(actualBodySize),
    });

    await expectPayloadTooLargeError(
      adapter.toRequest(request),
      actualBodySize,
      maxBodySize
    );
  });
});

describe("Fetch response bodies", () => {
  test("converts status code", () => {
    const adapter = new FetchApiAdapter();

    const response = adapter.toResponse({ statusCode: 201 });

    expect(response.status).toBe(201);
  });

  test("returns object response bodies as JSON with a JSON content type", async () => {
    const adapter = new FetchApiAdapter();

    const response = adapter.toResponse({
      statusCode: 200,
      body: { id: "1", title: "Todo" },
    });

    const text = await response.text();
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/json");
    expect(text).toBe('{"id":"1","title":"Todo"}');
  });

  test.each([
    { scenario: "false", body: false, expected: "false" },
    { scenario: "zero", body: 0, expected: "0" },
  ])(
    "returns $scenario response bodies as JSON with a JSON content type",
    async ({ body, expected }) => {
      const adapter = new FetchApiAdapter();

      const response = adapter.toResponse({ statusCode: 200, body });

      const text = await response.text();
      expect(response.headers.get("content-type")).toBe("application/json");
      expect(text).toBe(expected);
    }
  );

  test("preserves string bodies without defaulting content-type to JSON", async () => {
    const adapter = new FetchApiAdapter();

    const response = adapter.toResponse({
      statusCode: 200,
      body: "plain text",
    });

    const text = await response.text();
    expect(text).toBe("plain text");
    expect(response.headers.get("content-type")).not.toBe("application/json");
  });

  test("returns an empty response body for undefined bodies", async () => {
    const adapter = new FetchApiAdapter();

    const response = adapter.toResponse({ statusCode: 204 });

    const text = await response.text();
    expect(text).toBe("");
  });

  test("returns an empty response body for explicit null bodies", async () => {
    const adapter = new FetchApiAdapter();

    const response = adapter.toResponse({ statusCode: 204, body: null });

    const text = await response.text();
    expect(text).toBe("");
  });
});
