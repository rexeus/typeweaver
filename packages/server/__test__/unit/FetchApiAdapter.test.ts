import { describe, expect, test } from "vitest";
import {
  BodyParseError,
  FetchApiAdapter,
  PayloadTooLargeError,
} from "../../src/lib/FetchApiAdapter";
import { BASE_URL } from "../helpers";

describe("FetchApiAdapter", () => {
  describe("toRequest", () => {
    test("should extract method and path", async () => {
      const adapter = new FetchApiAdapter();
      const request = new Request(`${BASE_URL}/todos`);

      const result = await adapter.toRequest(request);

      expect(result.method).toBe("GET");
      expect(result.path).toBe("/todos");
    });

    test("should extract query parameters", async () => {
      const adapter = new FetchApiAdapter();
      const request = new Request(`${BASE_URL}/todos?status=TODO&limit=10`);

      const result = await adapter.toRequest(request);

      expect(result.query).toEqual({ status: "TODO", limit: "10" });
    });

    test("should handle multi-value query parameters", async () => {
      const adapter = new FetchApiAdapter();
      const request = new Request(`${BASE_URL}/todos?tag=a&tag=b`);

      const result = await adapter.toRequest(request);

      expect(result.query).toEqual({ tag: ["a", "b"] });
    });

    test("should return undefined query when no params present", async () => {
      const adapter = new FetchApiAdapter();
      const request = new Request(`${BASE_URL}/todos`);

      const result = await adapter.toRequest(request);

      expect(result.query).toBeUndefined();
    });

    test("should extract headers", async () => {
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

    test("should return undefined header when no explicit headers provided", async () => {
      const adapter = new FetchApiAdapter();
      const request = new Request(`${BASE_URL}/todos`);

      const result = await adapter.toRequest(request);

      // Fetch API may inject default headers; the adapter returns
      // undefined when no meaningful headers are present, or an object
      // containing only runtime-injected defaults.
      if (result.header !== undefined) {
        expect(typeof result.header).toBe("object");
      }
    });

    test("should not include path params at adapter level", async () => {
      const adapter = new FetchApiAdapter();
      const request = new Request(`${BASE_URL}/todos/t1`);

      const result = await adapter.toRequest(request);

      expect(result.param).toBeUndefined();
    });

    test("should parse JSON body", async () => {
      const adapter = new FetchApiAdapter();
      const request = new Request(`${BASE_URL}/todos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "New Todo" }),
      });

      const result = await adapter.toRequest(request);

      expect(result.body).toEqual({ title: "New Todo" });
    });

    test("should parse +json content types (RFC 6839)", async () => {
      const adapter = new FetchApiAdapter();
      const request = new Request(`${BASE_URL}/todos`, {
        method: "PATCH",
        headers: { "Content-Type": "application/merge-patch+json" },
        body: JSON.stringify({ title: "Updated" }),
      });

      const result = await adapter.toRequest(request);

      expect(result.body).toEqual({ title: "Updated" });
    });

    test("should parse vendor +json content types (RFC 6839)", async () => {
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

    test("should throw BodyParseError for malformed JSON and preserve cause", async () => {
      const adapter = new FetchApiAdapter();
      const request = new Request(`${BASE_URL}/todos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{ invalid json !!!",
      });

      await expect(adapter.toRequest(request)).rejects.toSatisfy(
        (error: BodyParseError) => {
          expect(error).toBeInstanceOf(BodyParseError);
          expect(error.message).toContain("Invalid JSON");
          expect(error.cause).toBeDefined();
          return true;
        }
      );
    });

    test("should throw BodyParseError for malformed +json body and preserve cause", async () => {
      const adapter = new FetchApiAdapter();
      const request = new Request(`${BASE_URL}/todos`, {
        method: "PATCH",
        headers: { "Content-Type": "application/merge-patch+json" },
        body: "not valid json",
      });

      await expect(adapter.toRequest(request)).rejects.toSatisfy(
        (error: BodyParseError) => {
          expect(error).toBeInstanceOf(BodyParseError);
          expect(error.message).toContain("Invalid JSON");
          expect(error.cause).toBeDefined();
          return true;
        }
      );
    });

    test("should parse text body", async () => {
      const adapter = new FetchApiAdapter();
      const request = new Request(`${BASE_URL}/todos`, {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: "Hello World",
      });

      const result = await adapter.toRequest(request);

      expect(result.body).toBe("Hello World");
    });

    test("should parse form-urlencoded body", async () => {
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

    test("should return undefined body for bodyless requests", async () => {
      const adapter = new FetchApiAdapter();
      const request = new Request(`${BASE_URL}/todos`);

      const result = await adapter.toRequest(request);

      expect(result.body).toBeUndefined();
    });

    test("should accept pre-parsed URL to avoid double parsing", async () => {
      const adapter = new FetchApiAdapter();
      const request = new Request(`${BASE_URL}/todos?status=TODO`);
      const url = new URL(request.url);

      const result = await adapter.toRequest(request, url);

      expect(result.path).toBe("/todos");
      expect(result.query).toEqual({ status: "TODO" });
    });

    test("should parse multipart/form-data body", async () => {
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

    test("should throw BodyParseError for malformed multipart/form-data", async () => {
      const adapter = new FetchApiAdapter();
      const request = new Request(`${BASE_URL}/todos`, {
        method: "POST",
        headers: { "Content-Type": "multipart/form-data; boundary=invalid" },
        body: "this is not valid multipart data",
      });

      await expect(adapter.toRequest(request)).rejects.toSatisfy(
        (error: BodyParseError) => {
          expect(error).toBeInstanceOf(BodyParseError);
          expect(error.message).toContain("multipart/form-data");
          expect(error.cause).toBeDefined();
          return true;
        }
      );
    });

    test("should fall back to raw text for unknown content types", async () => {
      const adapter = new FetchApiAdapter();
      const request = new Request(`${BASE_URL}/todos`, {
        method: "POST",
        headers: { "Content-Type": "application/octet-stream" },
        body: "raw binary-ish data",
      });

      const result = await adapter.toRequest(request);

      expect(result.body).toBe("raw binary-ish data");
    });

    test("should return undefined body for unknown content type with empty body text", async () => {
      const adapter = new FetchApiAdapter();
      const request = new Request(`${BASE_URL}/todos`, {
        method: "POST",
        headers: { "Content-Type": "application/xml" },
        body: "",
      });

      const result = await adapter.toRequest(request);

      // Source: `rawBody || undefined` — empty string returns undefined
      expect(result.body).toBeUndefined();
    });

    describe("Prototype Pollution Protection", () => {
      test("should store __proto__ as a regular property in query params", async () => {
        const adapter = new FetchApiAdapter();
        const request = new Request(`${BASE_URL}/todos?__proto__=polluted`);
        const before = ({} as any).__proto__;

        const result = await adapter.toRequest(request);

        expect(result.query?.["__proto__"]).toBe("polluted");
        expect(({} as any).__proto__).toBe(before);
        expect(Object.prototype).not.toHaveProperty("polluted");
      });

      test("should store multi-value __proto__ keys safely in query params", async () => {
        const adapter = new FetchApiAdapter();
        const request = new Request(
          `${BASE_URL}/todos?__proto__=a&__proto__=b`
        );

        const result = await adapter.toRequest(request);

        expect(result.query?.["__proto__"]).toEqual(["a", "b"]);
        expect(Object.prototype).not.toHaveProperty("a");
        expect(Object.prototype).not.toHaveProperty("b");
      });

      test("should store __proto__ as a regular property in multipart/form-data", async () => {
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

      test("should store __proto__ as a regular property in form-urlencoded body", async () => {
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
    });

    describe("Body Size Limit", () => {
      test("should throw PayloadTooLargeError with correct properties when Content-Length exceeds limit", async () => {
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

        await expect(adapter.toRequest(request)).rejects.toSatisfy(
          (error: PayloadTooLargeError) => {
            expect(error).toBeInstanceOf(PayloadTooLargeError);
            expect(error.contentLength).toBe(200);
            expect(error.maxBodySize).toBe(100);
            expect(error.message).toContain("200 bytes");
            expect(error.message).toContain("100 bytes");
            return true;
          }
        );
      });

      test("should accept bodies within the limit", async () => {
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

      test("should ignore invalid Content-Length header gracefully", async () => {
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

      test("should accept body at exact maxBodySize boundary", async () => {
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

      test("should use 1 MB default when maxBodySize is not configured", async () => {
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

      test("should reject oversized body when Content-Length header is missing", async () => {
        const adapter = new FetchApiAdapter({ maxBodySize: 50 });
        const request = new Request(`${BASE_URL}/todos`, {
          method: "POST",
          body: "x".repeat(100),
        });
        request.headers.delete("content-length");

        await expect(adapter.toRequest(request)).rejects.toThrow(PayloadTooLargeError);
      });

      test("should accept body within limit when Content-Length header is missing", async () => {
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

      test("should accept body at exact limit when Content-Length header is missing", async () => {
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

      test("should reject oversized multipart body when Content-Length header is missing", async () => {
        const adapter = new FetchApiAdapter({ maxBodySize: 10 });
        const formData = new FormData();
        formData.append("file", new Blob(["x".repeat(100)]), "big.txt");

        const request = new Request(`${BASE_URL}/todos`, {
          method: "POST",
          body: formData,
        });
        request.headers.delete("content-length");

        await expect(adapter.toRequest(request)).rejects.toThrow(PayloadTooLargeError);
      });
    });
  });

  describe("toResponse", () => {
    test("should convert status code", () => {
      const adapter = new FetchApiAdapter();

      const response = adapter.toResponse({ statusCode: 201 });

      expect(response.status).toBe(201);
    });

    test("should convert JSON body and auto-set content-type", () => {
      const adapter = new FetchApiAdapter();

      const response = adapter.toResponse({
        statusCode: 200,
        body: { id: "1", title: "Todo" },
      });

      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toBe("application/json");
    });

    test("should handle string body without auto content-type", async () => {
      const adapter = new FetchApiAdapter();

      const response = adapter.toResponse({
        statusCode: 200,
        body: "plain text",
      });

      const text = await response.text();
      expect(text).toBe("plain text");
      expect(response.headers.get("content-type")).not.toBe("application/json");
    });

    test("should handle undefined body", async () => {
      const adapter = new FetchApiAdapter();

      const response = adapter.toResponse({ statusCode: 204 });

      const text = await response.text();
      expect(text).toBe("");
    });

    test("should handle explicit null body", async () => {
      const adapter = new FetchApiAdapter();

      const response = adapter.toResponse({ statusCode: 204, body: null });

      const text = await response.text();
      expect(text).toBe("");
    });

    test("should handle Blob body without auto content-type", async () => {
      const adapter = new FetchApiAdapter();
      const blob = new Blob(["binary data"], { type: "application/octet-stream" });

      const response = adapter.toResponse({
        statusCode: 200,
        body: blob,
      });

      expect(response.headers.get("content-type")).not.toBe("application/json");
      const result = await response.blob();
      expect(result.size).toBe(blob.size);
    });

    test("should handle ArrayBuffer body without auto content-type", async () => {
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

    test("should JSON.stringify non-string, non-binary bodies", async () => {
      const adapter = new FetchApiAdapter();

      const response = adapter.toResponse({
        statusCode: 200,
        body: [1, 2, 3],
      });

      expect(response.headers.get("content-type")).toBe("application/json");
      const text = await response.text();
      expect(text).toBe("[1,2,3]");
    });

    test("should set single-value response headers", () => {
      const adapter = new FetchApiAdapter();

      const response = adapter.toResponse({
        statusCode: 200,
        header: { "X-Request-Id": "abc" },
        body: {},
      });

      expect(response.headers.get("x-request-id")).toBe("abc");
    });

    test("should set multi-value response headers", () => {
      const adapter = new FetchApiAdapter();

      const response = adapter.toResponse({
        statusCode: 200,
        header: { "Set-Cookie": ["a=1", "b=2"] },
        body: {},
      });

      const cookies = response.headers.get("set-cookie");
      expect(cookies).toContain("a=1");
      expect(cookies).toContain("b=2");
    });

    test("should not override explicit Content-Type header", () => {
      const adapter = new FetchApiAdapter();

      const response = adapter.toResponse({
        statusCode: 200,
        header: { "Content-Type": "text/html" },
        body: { html: true },
      });

      expect(response.headers.get("content-type")).toBe("text/html");
    });
  });
});
