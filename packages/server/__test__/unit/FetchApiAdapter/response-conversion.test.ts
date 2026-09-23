import { TestAssertionError } from "test-utils";
import { describe, expect, test } from "vitest";
import { ResponseSerializationError } from "../../../src/lib/Errors.js";
import { FetchApiAdapter } from "../../../src/lib/FetchApiAdapter.js";
import { callUntyped } from "../../helpers.js";

function toResponseWithUntypedHeaders(
  adapter: FetchApiAdapter,
  header: Record<string, unknown>
): Response {
  const response = callUntyped(adapter.toResponse.bind(adapter), {
    statusCode: 200,
    header,
    body: "ok",
  });
  if (!(response instanceof Response)) {
    throw new TestAssertionError("Expected toResponse to return a Response");
  }
  return response;
}

function captureResponseSerializationError(
  body: unknown
): ResponseSerializationError {
  const adapter = new FetchApiAdapter();

  try {
    adapter.toResponse({ statusCode: 200, body });
  } catch (error) {
    if (error instanceof ResponseSerializationError) {
      return error;
    }
    throw error;
  }

  throw new TestAssertionError("Expected response body serialization to fail");
}

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

describe("Fetch binary response bodies", () => {
  test("uses Blob content-type when no explicit header is present", async () => {
    const adapter = new FetchApiAdapter();
    const blob = new Blob(["binary data"], {
      type: "application/octet-stream",
    });

    const response = adapter.toResponse({
      statusCode: 200,
      body: blob,
    });

    expect(response.headers.get("content-type")).toBe(
      "application/octet-stream"
    );
    const result = await response.blob();
    expect(result.size).toBe(blob.size);
  });

  test("does not infer content-type for Blob bodies without a type", async () => {
    const adapter = new FetchApiAdapter();
    const blob = new Blob(["binary data"]);

    const response = adapter.toResponse({
      statusCode: 200,
      body: blob,
    });

    expect(response.headers.get("content-type")).toBeNull();
    const result = await response.blob();
    expect(result.size).toBe(blob.size);
  });

  test("preserves explicit Content-Type headers over Blob types", async () => {
    const adapter = new FetchApiAdapter();
    const blob = new Blob(["binary data"], {
      type: "application/octet-stream",
    });

    const response = adapter.toResponse({
      statusCode: 200,
      header: { "Content-Type": "text/plain" },
      body: blob,
    });

    expect(response.headers.get("content-type")).toBe("text/plain");
    const result = await response.blob();
    expect(result.size).toBe(blob.size);
  });

  test("preserves ArrayBuffer bodies without defaulting content-type to JSON", async () => {
    const adapter = new FetchApiAdapter();
    const buffer = new TextEncoder().encode("binary data").buffer;

    const response = adapter.toResponse({
      statusCode: 200,
      body: buffer,
    });

    expect(response.headers.get("content-type")).not.toBe("application/json");
    const result = await response.arrayBuffer();
    expect(result.byteLength).toBe(buffer.byteLength);
  });

  test("serializes non-string and non-binary bodies as JSON", async () => {
    const adapter = new FetchApiAdapter();

    const response = adapter.toResponse({
      statusCode: 200,
      body: [1, 2, 3],
    });

    expect(response.headers.get("content-type")).toBe("application/json");
    const text = await response.text();
    expect(text).toBe("[1,2,3]");
  });
});

describe("Fetch response headers and serialization errors", () => {
  test("sets single-value response headers", () => {
    const adapter = new FetchApiAdapter();

    const response = adapter.toResponse({
      statusCode: 200,
      header: { "X-Request-Id": "abc" },
      body: {},
    });

    expect(response.headers.get("x-request-id")).toBe("abc");
  });

  test("sets multi-value response headers", () => {
    const adapter = new FetchApiAdapter();

    const response = adapter.toResponse({
      statusCode: 200,
      header: { "Set-Cookie": ["a=1", "b=2"] },
      body: {},
    });

    expect(response.headers.getSetCookie()).toEqual(["a=1", "b=2"]);
  });

  test("preserves explicit Content-Type headers for JSON response bodies", async () => {
    const adapter = new FetchApiAdapter();

    const response = adapter.toResponse({
      statusCode: 200,
      header: { "Content-Type": "text/html" },
      body: { html: true },
    });

    const text = await response.text();

    expect(response.headers.get("content-type")).toBe("text/html");
    expect(text).toBe('{"html":true}');
  });

  test("ignores undefined response headers from untyped callers", () => {
    const adapter = new FetchApiAdapter();

    const response = toResponseWithUntypedHeaders(adapter, {
      "X-Skipped": undefined,
      "X-Kept": "kept",
    });

    expect(response.headers.has("x-skipped")).toBe(false);
    expect(response.headers.get("x-kept")).toBe("kept");
  });

  test("coerces numeric response headers from untyped callers", () => {
    const adapter = new FetchApiAdapter();

    const response = toResponseWithUntypedHeaders(adapter, {
      "X-Count": 42,
    });

    expect(response.headers.get("x-count")).toBe("42");
  });

  test("throws ResponseSerializationError for circular response bodies", () => {
    const adapter = new FetchApiAdapter();
    const circular: Record<string, unknown> = {};
    circular["self"] = circular;

    expect(() =>
      adapter.toResponse({ statusCode: 200, body: circular })
    ).toThrow(ResponseSerializationError);
  });

  test("throws ResponseSerializationError for BigInt response bodies", () => {
    const adapter = new FetchApiAdapter();

    expect(() =>
      adapter.toResponse({ statusCode: 200, body: BigInt(1) })
    ).toThrow(ResponseSerializationError);
  });

  test.each([
    { scenario: "function", body: () => "not serializable" },
    { scenario: "symbol", body: Symbol("not serializable") },
    { scenario: "toJSON undefined", body: { toJSON: () => undefined } },
  ])(
    "throws ResponseSerializationError for unserializable $scenario response bodies",
    ({ body }) => {
      const error = captureResponseSerializationError(body);

      expect(error.cause).toBeInstanceOf(TypeError);
    }
  );
});
