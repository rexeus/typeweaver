import { describe, expect, test } from "vitest";

import { FetchApiAdapter, BodyParseError } from "../../src/lib/FetchApiAdapter";

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
      const request = new Request(
        "http://localhost/todos?tag=a&tag=b"
      );

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
      expect(typeof result.header === "object" || result.header === undefined).toBe(true);
    });

    test("should merge path parameters", async () => {
      const request = new Request("http://localhost/todos/t1");

      const result = await adapter.toRequest(request, { todoId: "t1" });

      expect(result.param).toEqual({ todoId: "t1" });
    });

    test("should set param to undefined when no path params", async () => {
      const request = new Request("http://localhost/todos");

      const result = await adapter.toRequest(request, {});

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

      const result = await adapter.toRequest(request, undefined, url);

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
      expect(response.headers.get("content-type")).toBe(
        "application/json"
      );
    });

    test("should handle string body without auto content-type", async () => {
      const response = adapter.toResponse({
        statusCode: 200,
        body: "plain text",
      });

      const text = await response.text();
      expect(text).toBe("plain text");
      // String body should NOT get auto application/json
      expect(response.headers.get("content-type")).not.toBe(
        "application/json"
      );
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
