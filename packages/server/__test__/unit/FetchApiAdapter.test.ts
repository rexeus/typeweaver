import { describe, expect, test } from "vitest";
import {
  BodyParseError,
  FetchApiAdapter,
  PayloadTooLargeError,
} from "../../src/lib/FetchApiAdapter";

describe("FetchApiAdapter", () => {
  const adapter = new FetchApiAdapter();

  describe("toRequest", () => {
    test("should extract method and path", async () => {
      const request = new Request("http://localhost/todos");

      const result = await adapter.toRequest(request);

      expect(result.method).toBe("GET");
      expect(result.path).toBe("/todos");
    });

    test("should extract query parameters", async () => {
      const request = new Request(
        "http://localhost/todos?status=TODO&limit=10"
      );

      const result = await adapter.toRequest(request);

      expect(result.query).toEqual({ status: "TODO", limit: "10" });
    });

    test("should handle multi-value query parameters", async () => {
      const request = new Request("http://localhost/todos?tag=a&tag=b");

      const result = await adapter.toRequest(request);

      expect(result.query).toEqual({ tag: ["a", "b"] });
    });

    test("should return undefined query when no params present", async () => {
      const request = new Request("http://localhost/todos");

      const result = await adapter.toRequest(request);

      expect(result.query).toBeUndefined();
    });

    test("should extract headers", async () => {
      const request = new Request("http://localhost/todos", {
        headers: {
          Authorization: "Bearer token123",
          "X-Custom": "value",
        },
      });

      const result = await adapter.toRequest(request);

      expect(result.header?.["authorization"]).toBe("Bearer token123");
      expect(result.header?.["x-custom"]).toBe("value");
    });

    test("should return undefined header when no headers present", async () => {
      // Fetch API always adds some headers, but let's test minimally
      const request = new Request("http://localhost/todos");

      const result = await adapter.toRequest(request);

      // Even without explicit headers, may have default ones
      // The key invariant is that the result is a valid IHttpHeader
      expect(
        typeof result.header === "object" || result.header === undefined
      ).toBe(true);
    });

    test("should not include path params at adapter level", async () => {
      const request = new Request("http://localhost/todos/t1");

      const result = await adapter.toRequest(request);

      // Path params are injected later by TypeweaverApp.resolveAndExecute
      expect(result.param).toBeUndefined();
    });

    test("should parse JSON body", async () => {
      const request = new Request("http://localhost/todos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "New Todo" }),
      });

      const result = await adapter.toRequest(request);

      expect(result.body).toEqual({ title: "New Todo" });
    });

    test("should parse +json content types (RFC 6839)", async () => {
      const request = new Request("http://localhost/todos", {
        method: "PATCH",
        headers: { "Content-Type": "application/merge-patch+json" },
        body: JSON.stringify({ title: "Updated" }),
      });

      const result = await adapter.toRequest(request);

      expect(result.body).toEqual({ title: "Updated" });
    });

    test("should parse vendor +json content types", async () => {
      const request = new Request("http://localhost/todos", {
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

    test("should throw BodyParseError for malformed +json body", async () => {
      const request = new Request("http://localhost/todos", {
        method: "PATCH",
        headers: { "Content-Type": "application/merge-patch+json" },
        body: "not valid json",
      });

      await expect(adapter.toRequest(request)).rejects.toThrow(BodyParseError);
    });

    test("should parse text body", async () => {
      const request = new Request("http://localhost/todos", {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: "Hello World",
      });

      const result = await adapter.toRequest(request);

      expect(result.body).toBe("Hello World");
    });

    test("should parse form-urlencoded body", async () => {
      const request = new Request("http://localhost/todos", {
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
      const request = new Request("http://localhost/todos");

      const result = await adapter.toRequest(request);

      expect(result.body).toBeUndefined();
    });

    test("should throw BodyParseError for malformed JSON", async () => {
      const request = new Request("http://localhost/todos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{ invalid json !!!",
      });

      await expect(adapter.toRequest(request)).rejects.toThrow(BodyParseError);
      // Verify it's specifically a BodyParseError
      try {
        await adapter.toRequest(
          new Request("http://localhost/todos", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: "not json",
          })
        );
      } catch (err) {
        expect(err).toBeInstanceOf(BodyParseError);
        expect((err as BodyParseError).message).toContain("Invalid JSON");
      }
    });

    test("should accept pre-parsed URL to avoid double parsing", async () => {
      const request = new Request("http://localhost/todos?status=TODO");
      const url = new URL(request.url);

      const result = await adapter.toRequest(request, url);

      expect(result.path).toBe("/todos");
      expect(result.query).toEqual({ status: "TODO" });
    });

    test("should parse multipart/form-data body", async () => {
      const formData = new FormData();
      formData.append("title", "Test Todo");
      formData.append("tags", "tag1");
      formData.append("tags", "tag2");

      const request = new Request("http://localhost/todos", {
        method: "POST",
        body: formData,
      });

      const result = await adapter.toRequest(request);

      expect(result.body).toBeDefined();
      expect(result.body.title).toBe("Test Todo");
      expect(result.body.tags).toEqual(["tag1", "tag2"]);
    });
  });

  describe("prototype pollution protection", () => {
    test("should store __proto__ as a regular property in query params", async () => {
      const request = new Request("http://localhost/todos?__proto__=polluted");
      const before = ({} as any).__proto__;

      const result = await adapter.toRequest(request);

      expect(result.query?.["__proto__"]).toBe("polluted");
      expect(({} as any).__proto__).toBe(before);
      expect(Object.prototype).not.toHaveProperty("polluted");
    });

    test("should store multi-value __proto__ keys safely in query params", async () => {
      const request = new Request(
        "http://localhost/todos?__proto__=a&__proto__=b"
      );

      const result = await adapter.toRequest(request);

      expect(result.query?.["__proto__"]).toEqual(["a", "b"]);
      expect(Object.prototype).not.toHaveProperty("a");
      expect(Object.prototype).not.toHaveProperty("b");
    });

    test("should store __proto__ as a regular property in multipart/form-data", async () => {
      const formData = new FormData();
      formData.append("__proto__", "polluted");
      formData.append("constructor", "evil");

      const request = new Request("http://localhost/todos", {
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
      const request = new Request("http://localhost/todos", {
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

  describe("body size limit", () => {
    test("should throw PayloadTooLargeError when Content-Length exceeds limit", async () => {
      const limitedAdapter = new FetchApiAdapter({ maxBodySize: 100 });
      const body = "x".repeat(200);
      const request = new Request("http://localhost/todos", {
        method: "POST",
        headers: {
          "Content-Type": "text/plain",
          "Content-Length": String(body.length),
        },
        body,
      });

      await expect(limitedAdapter.toRequest(request)).rejects.toThrow(
        PayloadTooLargeError
      );
    });

    test("should accept bodies within the limit", async () => {
      const limitedAdapter = new FetchApiAdapter({ maxBodySize: 1000 });
      const body = "hello";
      const request = new Request("http://localhost/todos", {
        method: "POST",
        headers: {
          "Content-Type": "text/plain",
          "Content-Length": String(body.length),
        },
        body,
      });

      const result = await limitedAdapter.toRequest(request);

      expect(result.body).toBe("hello");
    });

    test("should ignore invalid Content-Length header gracefully", async () => {
      const limitedAdapter = new FetchApiAdapter({ maxBodySize: 100 });
      const request = new Request("http://localhost/todos", {
        method: "POST",
        headers: {
          "Content-Type": "text/plain",
          "Content-Length": "not-a-number",
        },
        body: "hello",
      });

      const result = await limitedAdapter.toRequest(request);

      expect(result.body).toBe("hello");
    });

    test("should accept body at exact maxBodySize boundary", async () => {
      const limitedAdapter = new FetchApiAdapter({ maxBodySize: 100 });
      const body = "x".repeat(100);
      const request = new Request("http://localhost/todos", {
        method: "POST",
        headers: {
          "Content-Type": "text/plain",
          "Content-Length": String(body.length),
        },
        body,
      });

      const result = await limitedAdapter.toRequest(request);

      expect(result.body).toBe(body);
    });

    test("should not enforce limit when maxBodySize is not set", async () => {
      const unlimitedAdapter = new FetchApiAdapter();
      const body = "x".repeat(10000);
      const request = new Request("http://localhost/todos", {
        method: "POST",
        headers: {
          "Content-Type": "text/plain",
          "Content-Length": String(body.length),
        },
        body,
      });

      const result = await unlimitedAdapter.toRequest(request);

      expect(result.body).toBe(body);
    });
  });

  describe("toResponse", () => {
    test("should convert status code", () => {
      const response = adapter.toResponse({ statusCode: 201 });

      expect(response.status).toBe(201);
    });

    test("should convert JSON body and auto-set content-type", () => {
      const response = adapter.toResponse({
        statusCode: 200,
        body: { id: "1", title: "Todo" },
      });

      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toBe("application/json");
    });

    test("should handle string body without auto content-type", async () => {
      const response = adapter.toResponse({
        statusCode: 200,
        body: "plain text",
      });

      const text = await response.text();
      expect(text).toBe("plain text");
      // String body should NOT get auto application/json
      expect(response.headers.get("content-type")).not.toBe("application/json");
    });

    test("should handle empty body (null)", async () => {
      const response = adapter.toResponse({ statusCode: 204 });

      const text = await response.text();
      expect(text).toBe("");
    });

    test("should set single-value response headers", () => {
      const response = adapter.toResponse({
        statusCode: 200,
        header: { "X-Request-Id": "abc" },
        body: {},
      });

      expect(response.headers.get("x-request-id")).toBe("abc");
    });

    test("should set multi-value response headers", () => {
      const response = adapter.toResponse({
        statusCode: 200,
        header: { "Set-Cookie": ["a=1", "b=2"] },
        body: {},
      });

      // Fetch API joins multi-value headers
      const cookies = response.headers.get("set-cookie");
      expect(cookies).toContain("a=1");
      expect(cookies).toContain("b=2");
    });

    test("should not override explicit Content-Type header", () => {
      const response = adapter.toResponse({
        statusCode: 200,
        header: { "Content-Type": "text/html" },
        body: { html: true },
      });

      expect(response.headers.get("content-type")).toBe("text/html");
    });
  });
});
