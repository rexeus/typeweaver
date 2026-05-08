import { TestAssertionError, TestIoError, TestSetupError } from "test-utils";
import { describe, expect, test, vi } from "vitest";
import {
  createNodeBodyLimitPolicy,
  markRequestBodyPrevalidated,
} from "../../src/lib/BodyLimitPolicy.js";
import {
  BodyParseError,
  PayloadTooLargeError,
  ResponseSerializationError,
} from "../../src/lib/Errors.js";
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

function parseRequest(request: Request, url?: URL) {
  return new FetchApiAdapter().toRequest(request, url);
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

function createFailingBodyReadStream(
  readFailure: Error,
  cancel: () => Promise<void>
): ReadableStream<Uint8Array> {
  let hasEnqueuedFailure = false;
  const failingChunk = Object.defineProperty({}, "byteLength", {
    get() {
      throw readFailure;
    },
  }) as Uint8Array;

  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (hasEnqueuedFailure) {
        return;
      }

      hasEnqueuedFailure = true;
      controller.enqueue(failingChunk);
    },
    cancel,
  });
}

async function expectBodyParseError(
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

function createPrevalidatedRequestWithUnreadableText(
  contentType: string | undefined,
  error: Error
): Request {
  const request = createPrevalidatedRequest(
    "/todos",
    {
      method: "POST",
      headers: contentType ? { "Content-Type": contentType } : undefined,
      body: new TextEncoder().encode("unreadable"),
    },
    64
  );
  Object.defineProperty(request, "text", {
    value: () => Promise.reject(error),
  });
  return request;
}

function createRequiredTestFile(): File {
  if (typeof File === "undefined") {
    throw new TestSetupError("The Node 22+ test runtime must provide File.");
  }

  return new File(["file contents"], "todo.txt", { type: "text/plain" });
}

function anUntypedResponseWithHeaders(
  header: Record<string, unknown>
): Parameters<FetchApiAdapter["toResponse"]>[0] {
  return {
    statusCode: 200,
    header,
    body: "ok",
  } as Parameters<FetchApiAdapter["toResponse"]>[0];
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

describe("FetchApiAdapter", () => {
  describe("toRequest", () => {
    test("extracts method and path", async () => {
      const result = await parseRequest(createAdapterRequest("/todos"));

      expect(result.method).toBe("GET");
      expect(result.path).toBe("/todos");
    });

    test("normalizes lowercase custom request methods to uppercase", async () => {
      const request = createAdapterRequest("/todos", {
        method: "custommethod",
      });

      const result = await parseRequest(request);

      expect(result.method).toBe("CUSTOMMETHOD");
    });

    test("extracts query parameters", async () => {
      const result = await parseRequest(
        createAdapterRequest("/todos?status=TODO&limit=10")
      );

      expect(result.query).toEqual({ status: "TODO", limit: "10" });
    });

    test("preserves repeated query parameters as arrays", async () => {
      const adapter = new FetchApiAdapter();
      const request = new Request(`${BASE_URL}/todos?tag=a&tag=b`);

      const result = await adapter.toRequest(request);

      expect(result.query).toEqual({ tag: ["a", "b"] });
    });

    test("omits query when no query parameters are present", async () => {
      const adapter = new FetchApiAdapter();
      const request = new Request(`${BASE_URL}/todos`);

      const result = await adapter.toRequest(request);

      expect(result.query).toBeUndefined();
    });

    test("extracts request headers by lowercase name", async () => {
      const adapter = new FetchApiAdapter();
      const request = new Request(`${BASE_URL}/todos`, {
        headers: {
          Authorization: "Bearer token123",
          "X-Custom": "value",
        },
      });

      const result = await adapter.toRequest(request);

      expect(result.header?.["authorization"]).toBe("Bearer token123");
      expect(result.header?.["x-custom"]).toBe("value");
    });

    test("omits headers when no request headers are present", async () => {
      const adapter = new FetchApiAdapter();
      const request = new Request(`${BASE_URL}/todos`);

      const result = await adapter.toRequest(request);

      expect(result.header).toBeUndefined();
    });

    test("preserves request headers with empty string values", async () => {
      const adapter = new FetchApiAdapter();
      const request = new Request(`${BASE_URL}/todos`, {
        headers: { "X-Empty": "" },
      });

      const result = await adapter.toRequest(request);

      expect(result.header?.["x-empty"]).toBe("");
    });

    test("omits path params at adapter level", async () => {
      const adapter = new FetchApiAdapter();
      const request = new Request(`${BASE_URL}/todos/t1`);

      const result = await adapter.toRequest(request);

      expect(result.param).toBeUndefined();
    });

    test("parses JSON request bodies", async () => {
      const adapter = new FetchApiAdapter();
      const request = new Request(`${BASE_URL}/todos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "New Todo" }),
      });

      const result = await adapter.toRequest(request);

      expect(result.body).toEqual({ title: "New Todo" });
    });

    test("parses structured +json request bodies", async () => {
      const adapter = new FetchApiAdapter();
      const request = new Request(`${BASE_URL}/todos`, {
        method: "PATCH",
        headers: { "Content-Type": "application/merge-patch+json" },
        body: JSON.stringify({ title: "Updated" }),
      });

      const result = await adapter.toRequest(request);

      expect(result.body).toEqual({ title: "Updated" });
    });

    test("parses vendor +json request bodies with charset parameters", async () => {
      const adapter = new FetchApiAdapter();
      const request = new Request(`${BASE_URL}/todos`, {
        method: "POST",
        headers: { "Content-Type": "application/vnd.api+json; charset=utf-8" },
        body: JSON.stringify({
          data: { type: "todo", attributes: { title: "Test" } },
        }),
      });

      const result = await adapter.toRequest(request);

      expect(result.body).toEqual({
        data: { type: "todo", attributes: { title: "Test" } },
      });
    });

    test("throws BodyParseError for malformed JSON and preserves the cause", async () => {
      const request = createAdapterRequest("/todos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{ invalid json !!!",
      });

      await expectBodyParseError(request, "Invalid JSON");
    });

    test("throws BodyParseError for malformed +json bodies and preserves the cause", async () => {
      const request = createAdapterRequest("/todos", {
        method: "PATCH",
        headers: { "Content-Type": "application/merge-patch+json" },
        body: "not valid json",
      });

      await expectBodyParseError(request, "Invalid JSON");
    });

    test("parses application/problem+json request bodies as JSON", async () => {
      const adapter = new FetchApiAdapter();
      const request = createAdapterRequest("/todos", {
        method: "POST",
        headers: { "Content-Type": "application/problem+json" },
        body: JSON.stringify({ title: "Invalid todo", status: 422 }),
      });

      const result = await adapter.toRequest(request);

      expect(result.body).toEqual({ title: "Invalid todo", status: 422 });
    });

    test("throws BodyParseError for malformed JSON with charset parameters", async () => {
      const request = createAdapterRequest("/todos", {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: "{ invalid json !!!",
      });

      await expectBodyParseError(request, "Invalid JSON");
    });

    test.each([
      { scenario: "null", body: "null", expected: null },
      { scenario: "array", body: "[1,2,3]", expected: [1, 2, 3] },
      { scenario: "string", body: '"hello"', expected: "hello" },
    ])("parses JSON $scenario request bodies", async ({ body, expected }) => {
      const adapter = new FetchApiAdapter();
      const request = createAdapterRequest("/todos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });

      const result = await adapter.toRequest(request);

      expect(result.body).toEqual(expected);
    });

    test("throws BodyParseError for empty JSON request bodies", async () => {
      const request = createAdapterRequest("/todos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "",
      });

      await expectBodyParseError(request, "Invalid JSON");
    });

    test("parses text request bodies", async () => {
      const adapter = new FetchApiAdapter();
      const request = new Request(`${BASE_URL}/todos`, {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: "Hello World",
      });

      const result = await adapter.toRequest(request);

      expect(result.body).toBe("Hello World");
    });

    test("parses bodies without Content-Type as raw text", async () => {
      const adapter = new FetchApiAdapter();
      const request = createAdapterRequestWithStream(
        "/todos",
        {},
        createBodyStream(["raw body"])
      );

      const result = await adapter.toRequest(request);

      expect(result.body).toBe("raw body");
    });

    test("parses bodies with empty Content-Type as raw text", async () => {
      const adapter = new FetchApiAdapter();
      const request = createAdapterRequest("/todos", {
        method: "POST",
        headers: { "Content-Type": "" },
        body: new TextEncoder().encode("raw body"),
      });

      const result = await adapter.toRequest(request);

      expect(result.body).toBe("raw body");
    });

    test("parses form-urlencoded request bodies", async () => {
      const adapter = new FetchApiAdapter();
      const request = new Request(`${BASE_URL}/todos`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: "title=New+Todo&priority=HIGH",
      });

      const result = await adapter.toRequest(request);

      expect(result.body).toEqual({
        title: "New Todo",
        priority: "HIGH",
      });
    });

    test("preserves repeated form-urlencoded keys as arrays", async () => {
      const adapter = new FetchApiAdapter();
      const request = createAdapterRequest("/todos", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: "tag=one&tag=two&title=New+Todo",
      });

      const result = await adapter.toRequest(request);

      expect(result.body).toEqual({
        tag: ["one", "two"],
        title: "New Todo",
      });
    });

    test("omits body for bodyless requests", async () => {
      const adapter = new FetchApiAdapter();
      const request = new Request(`${BASE_URL}/todos`);

      const result = await adapter.toRequest(request);

      expect(result.body).toBeUndefined();
    });

    test("uses the supplied parsed URL when converting the request", async () => {
      const adapter = new FetchApiAdapter();
      const request = new Request(`${BASE_URL}/ignored?status=IGNORED`);
      const url = new URL(`${BASE_URL}/todos?status=TODO&tag=supplied`);

      const result = await adapter.toRequest(request, url);

      expect(result.path).toBe("/todos");
      expect(result.query).toEqual({ status: "TODO", tag: "supplied" });
    });

    test("parses multipart form fields", async () => {
      const adapter = new FetchApiAdapter();
      const formData = new FormData();
      formData.append("title", "Test Todo");
      formData.append("tags", "tag1");
      formData.append("tags", "tag2");

      const request = new Request(`${BASE_URL}/todos`, {
        method: "POST",
        body: formData,
      });

      const result = await adapter.toRequest(request);

      expect(result.body.title).toBe("Test Todo");
      expect(result.body.tags).toEqual(["tag1", "tag2"]);
    });

    test("preserves multipart File values", async () => {
      const adapter = new FetchApiAdapter();
      const formData = new FormData();
      const file = createRequiredTestFile();
      formData.append("attachment", file);

      const request = createAdapterRequest("/todos", {
        method: "POST",
        body: formData,
      });

      const result = await adapter.toRequest(request);

      expect(result.body.attachment).toBeInstanceOf(File);
      expect(result.body.attachment.name).toBe("todo.txt");
      expect(result.body.attachment.type).toBe("text/plain");
      await expect(result.body.attachment.text()).resolves.toBe(
        "file contents"
      );
    });

    test("throws BodyParseError for malformed multipart form bodies", async () => {
      const request = createAdapterRequest("/todos", {
        method: "POST",
        headers: { "Content-Type": "multipart/form-data; boundary=invalid" },
        body: "this is not valid multipart data",
      });

      await expectBodyParseError(request, "multipart/form-data");
    });

    test("falls back to raw text for unknown content types", async () => {
      const adapter = new FetchApiAdapter();
      const request = new Request(`${BASE_URL}/todos`, {
        method: "POST",
        headers: { "Content-Type": "application/octet-stream" },
        body: "raw binary-ish data",
      });

      const result = await adapter.toRequest(request);

      expect(result.body).toBe("raw binary-ish data");
    });

    test("omits raw body when an unknown content type has empty body text", async () => {
      const adapter = new FetchApiAdapter();
      const request = new Request(`${BASE_URL}/todos`, {
        method: "POST",
        headers: { "Content-Type": "application/xml" },
        body: "",
      });

      const result = await adapter.toRequest(request);

      expect(result.body).toBeUndefined();
    });

    test("throws BodyParseError when text body reads fail", async () => {
      const request = createPrevalidatedRequestWithUnreadableText(
        "text/plain",
        new TestIoError("read failed")
      );

      await expectBodyParseError(request, "Failed to read text request body");
    });

    test("throws BodyParseError when form-urlencoded body reads fail", async () => {
      const request = createPrevalidatedRequestWithUnreadableText(
        "application/x-www-form-urlencoded",
        new TestIoError("read failed")
      );

      await expectBodyParseError(
        request,
        "Failed to read form-urlencoded request body"
      );
    });

    test("throws BodyParseError when raw body reads fail", async () => {
      const request = createPrevalidatedRequestWithUnreadableText(
        undefined,
        new TestIoError("read failed")
      );

      await expectBodyParseError(request, "Failed to read request body");
    });

    test("cancels oversized request streams without masking the original error", async () => {
      const cancel = vi
        .fn()
        .mockRejectedValue(new TestIoError("cancel failed"));
      const actualBodySize = 6;
      const maxBodySize = 4;
      const body = createSixByteStream(cancel);
      const request = createAdapterRequestWithStream(
        "/upload",
        { "Content-Type": "application/octet-stream" },
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

    test("cancels oversized multipart request streams without masking the size-limit error", async () => {
      const cancel = vi
        .fn()
        .mockRejectedValue(new TestIoError("cancel failed"));
      const actualBodySize = 6;
      const maxBodySize = 4;
      const body = createSixByteStream(cancel);
      const request = createAdapterRequestWithStream(
        "/upload",
        { "Content-Type": "multipart/form-data; boundary=typeweaver-test" },
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

    test("cancels multipart request streams after body read failures without masking the original error", async () => {
      const readFailure = new TestIoError("read failed");
      const cancel = vi
        .fn()
        .mockRejectedValue(new TestIoError("cancel failed"));
      const body = createFailingBodyReadStream(readFailure, cancel);
      const request = createAdapterRequestWithStream(
        "/upload",
        { "Content-Type": "multipart/form-data; boundary=typeweaver-test" },
        body
      );
      const adapter = new FetchApiAdapter({ maxBodySize: 64 });

      await expect(adapter.toRequest(request)).rejects.toBe(readFailure);

      expect(cancel).toHaveBeenCalledTimes(1);
    });

    describe("Content-Type Matching", () => {
      test("parses JSON media types with surrounding whitespace and parameters", async () => {
        const adapter = new FetchApiAdapter();
        const request = new Request(`${BASE_URL}/todos`, {
          method: "POST",
          headers: {
            "Content-Type": " application/json ; charset=utf-8 ",
          },
          body: JSON.stringify({ title: "Whitespace Test" }),
        });

        const result = await adapter.toRequest(request);

        expect(result.body).toEqual({ title: "Whitespace Test" });
      });

      test("treats text/html+json-not-really as raw text", async () => {
        const adapter = new FetchApiAdapter();
        const request = new Request(`${BASE_URL}/todos`, {
          method: "POST",
          headers: { "Content-Type": "text/html+json-not-really" },
          body: "not json",
        });

        const result = await adapter.toRequest(request);

        expect(result.body).toBe("not json");
      });

      test("parses text/html as text when the body looks like JSON", async () => {
        const adapter = new FetchApiAdapter();
        const request = new Request(`${BASE_URL}/todos`, {
          method: "POST",
          headers: { "Content-Type": "text/html" },
          body: '{"title": "test"}',
        });

        const result = await adapter.toRequest(request);

        expect(result.body).toBe('{"title": "test"}');
      });

      test("strips charset parameters before matching content type", async () => {
        const adapter = new FetchApiAdapter();
        const request = new Request(`${BASE_URL}/todos`, {
          method: "POST",
          headers: { "Content-Type": "application/json; charset=utf-8" },
          body: JSON.stringify({ title: "Charset Test" }),
        });

        const result = await adapter.toRequest(request);

        expect(result.body).toEqual({ title: "Charset Test" });
      });

      test("matches content type case-insensitively", async () => {
        const adapter = new FetchApiAdapter();
        const request = new Request(`${BASE_URL}/todos`, {
          method: "POST",
          headers: { "Content-Type": "Application/JSON" },
          body: JSON.stringify({ title: "Case Test" }),
        });

        const result = await adapter.toRequest(request);

        expect(result.body).toEqual({ title: "Case Test" });
      });

      test("parses form-urlencoded bodies with charset parameters", async () => {
        const adapter = new FetchApiAdapter();
        const request = new Request(`${BASE_URL}/todos`, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded; charset=utf-8",
          },
          body: "title=Test",
        });

        const result = await adapter.toRequest(request);

        expect(result.body).toEqual({ title: "Test" });
      });
    });

    describe("Prototype Pollution Protection", () => {
      test("stores __proto__ as a regular property in query params", async () => {
        const adapter = new FetchApiAdapter();
        const request = new Request(`${BASE_URL}/todos?__proto__=polluted`);
        const before = ({} as any).__proto__;

        const result = await adapter.toRequest(request);

        expect(result.query?.["__proto__"]).toBe("polluted");
        expect(({} as any).__proto__).toBe(before);
        expect(Object.prototype).not.toHaveProperty("polluted");
      });

      test("stores repeated __proto__ query params without polluting safe keys", async () => {
        const adapter = new FetchApiAdapter();
        const request = new Request(
          `${BASE_URL}/todos?title=safe&__proto__=a&__proto__=b`
        );

        const result = await adapter.toRequest(request);

        expect(result.query?.["title"]).toBe("safe");
        expect(result.query?.["__proto__"]).toEqual(["a", "b"]);
        expect(Object.prototype).not.toHaveProperty("a");
        expect(Object.prototype).not.toHaveProperty("b");
      });

      test("stores __proto__ as a regular property in multipart form data", async () => {
        const adapter = new FetchApiAdapter();
        const formData = new FormData();
        formData.append("__proto__", "polluted");
        formData.append("constructor", "evil");

        const request = new Request(`${BASE_URL}/todos`, {
          method: "POST",
          body: formData,
        });
        const before = ({} as any).__proto__;

        const result = await adapter.toRequest(request);

        expect(result.body?.["__proto__"]).toBe("polluted");
        expect(result.body?.["constructor"]).toBe("evil");
        expect(({} as any).__proto__).toBe(before);
      });

      test("stores __proto__ as a regular property in form-urlencoded bodies", async () => {
        const adapter = new FetchApiAdapter();
        const request = new Request(`${BASE_URL}/todos`, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: "__proto__=polluted&constructor=evil",
        });
        const before = ({} as any).__proto__;

        const result = await adapter.toRequest(request);

        expect(result.body?.["__proto__"]).toBe("polluted");
        expect(result.body?.["constructor"]).toBe("evil");
        expect(({} as any).__proto__).toBe(before);
      });

      test("stores repeated __proto__ form keys without polluting safe values", async () => {
        const adapter = new FetchApiAdapter();
        const request = createAdapterRequest("/todos", {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: "title=safe&__proto__=a&__proto__=b",
        });

        const result = await adapter.toRequest(request);

        expect(result.body?.["title"]).toBe("safe");
        expect(result.body?.["__proto__"]).toEqual(["a", "b"]);
        expect(Object.prototype).not.toHaveProperty("a");
        expect(Object.prototype).not.toHaveProperty("b");
      });

      test("strips top-level __proto__ from raw JSON request bodies", async () => {
        const adapter = new FetchApiAdapter();
        const request = new Request(`${BASE_URL}/todos`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: '{"title":"legit","__proto__":{"isAdmin":true}}',
        });
        const before = ({} as any).__proto__;

        const result = await adapter.toRequest(request);

        expect(result.body.title).toBe("legit");
        expect(Object.hasOwn(result.body, "__proto__")).toBe(false);
        expect(({} as any).__proto__).toBe(before);
        expect(({} as any).isAdmin).toBeUndefined();
      });

      test("strips nested __proto__ from JSON request bodies", async () => {
        const adapter = new FetchApiAdapter();
        const body =
          '{"user": {"__proto__": {"isAdmin": true}, "name": "test"}}';
        const request = new Request(`${BASE_URL}/todos`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
        });

        const result = await adapter.toRequest(request);

        expect(result.body.user.name).toBe("test");
        expect(Object.hasOwn(result.body.user, "__proto__")).toBe(false);
        expect(({} as any).isAdmin).toBeUndefined();
      });

      test("strips __proto__ recursively from objects inside JSON arrays", async () => {
        const adapter = new FetchApiAdapter();
        const request = createAdapterRequest("/todos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: '[{"title":"safe","__proto__":{"isAdmin":true}}]',
        });

        const result = await adapter.toRequest(request);

        expect(result.body).toEqual([{ title: "safe" }]);
        expect(Object.hasOwn(result.body[0], "__proto__")).toBe(false);
        expect(({} as any).isAdmin).toBeUndefined();
      });

      test("allows constructor and prototype as regular JSON keys", async () => {
        const adapter = new FetchApiAdapter();
        const request = new Request(`${BASE_URL}/todos`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ constructor: "value", prototype: "value" }),
        });

        const result = await adapter.toRequest(request);

        expect(result.body.constructor).toBe("value");
        expect(result.body.prototype).toBe("value");
      });
    });

    describe("Body Size Limit", () => {
      test("rejects requests when Content-Length exceeds the limit", async () => {
        const adapter = new FetchApiAdapter({ maxBodySize: 100 });
        const body = "x".repeat(200);
        const request = new Request(`${BASE_URL}/todos`, {
          method: "POST",
          headers: {
            "Content-Type": "text/plain",
            "Content-Length": String(body.length),
          },
          body,
        });

        await expectPayloadTooLargeError(adapter.toRequest(request), 200, 100);
      });

      test("accepts requests when Content-Length is within the limit", async () => {
        const adapter = new FetchApiAdapter({ maxBodySize: 1000 });
        const body = "hello";
        const request = new Request(`${BASE_URL}/todos`, {
          method: "POST",
          headers: {
            "Content-Type": "text/plain",
            "Content-Length": String(body.length),
          },
          body,
        });

        const result = await adapter.toRequest(request);

        expect(result.body).toBe("hello");
      });

      test("accepts valid bodies when Content-Length is invalid", async () => {
        const adapter = new FetchApiAdapter({ maxBodySize: 100 });
        const request = new Request(`${BASE_URL}/todos`, {
          method: "POST",
          headers: {
            "Content-Type": "text/plain",
            "Content-Length": "not-a-number",
          },
          body: "hello",
        });

        const result = await adapter.toRequest(request);

        expect(result.body).toBe("hello");
      });

      test("rejects oversized requests with invalid Content-Length by reading the body", async () => {
        const adapter = new FetchApiAdapter({ maxBodySize: 4 });
        const request = createAdapterRequest("/todos", {
          method: "POST",
          headers: {
            "Content-Type": "text/plain",
            "Content-Length": "not-a-number",
          },
          body: "hello",
        });

        await expectPayloadTooLargeError(adapter.toRequest(request), 5, 4);
      });

      test("falls back to streaming validation for negative Content-Length", async () => {
        const adapter = new FetchApiAdapter({ maxBodySize: 100 });
        const request = new Request(`${BASE_URL}/todos`, {
          method: "POST",
          body: JSON.stringify({ ok: true }),
          headers: {
            "Content-Type": "application/json",
            "Content-Length": "-1",
          },
        });

        const result = await adapter.toRequest(request);

        expect(result.body).toEqual({ ok: true });
      });

      test("omits null bodies during streaming validation", async () => {
        const adapter = new FetchApiAdapter({ maxBodySize: 100 });
        const request = new Request(`${BASE_URL}/todos`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });

        const result = await adapter.toRequest(request);

        expect(result.body).toBeUndefined();
      });

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
  });

  describe("toResponse", () => {
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

      const response = adapter.toResponse(
        anUntypedResponseWithHeaders({
          "X-Skipped": undefined,
          "X-Kept": "kept",
        })
      );

      expect(response.headers.has("x-skipped")).toBe(false);
      expect(response.headers.get("x-kept")).toBe("kept");
    });

    test("coerces numeric response headers from untyped callers", () => {
      const adapter = new FetchApiAdapter();

      const response = adapter.toResponse(
        anUntypedResponseWithHeaders({
          "X-Count": 42,
        })
      );

      expect(response.headers.get("x-count")).toBe("42");
    });

    test("throws ResponseSerializationError for circular response bodies", () => {
      const adapter = new FetchApiAdapter();
      const circular: Record<string, unknown> = {};
      circular.self = circular;

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
});
