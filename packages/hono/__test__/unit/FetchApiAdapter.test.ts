import { describe, expect, test } from "vitest";
import { FetchApiAdapter } from "../../src/lib/FetchApiAdapter.js";

describe("Hono FetchApiAdapter", () => {
  test("parses JSON bodies and multi-valued headers into IHttpRequest", async () => {
    const adapter = new FetchApiAdapter();
    const request = new Request("https://example.test/path?q=1&q=2&x=y", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/plain",
      },
      body: JSON.stringify({ hello: "world" }),
    });

    const httpRequest = await adapter.toRequest(request, { id: "42" });

    expect(httpRequest.method).toBe("POST");
    expect(httpRequest.path).toBe("/path");
    expect(httpRequest.query).toEqual({ q: ["1", "2"], x: "y" });
    expect(httpRequest.param).toEqual({ id: "42" });
    expect(httpRequest.body).toEqual({ hello: "world" });
  });

  test.each([
    ["ReadableStream", new ReadableStream()],
    ["Blob", new Blob(["hello"])],
    ["ArrayBuffer", new ArrayBuffer(8)],
    ["Uint8Array", new Uint8Array([1, 2, 3])],
    ["URLSearchParams", new URLSearchParams("a=1")],
    ["FormData", new FormData()],
  ])(
    "passes %s response bodies to Response unchanged",
    async (_label, body) => {
      const adapter = new FetchApiAdapter();
      const response = adapter.toResponse({
        statusCode: 200,
        body: body as unknown,
        header: { "x-trace-id": "abc" },
      } as never);

      expect(response.status).toBe(200);
      expect(response.headers.get("x-trace-id")).toBe("abc");
    }
  );

  test("serializes plain objects and arrays as JSON", async () => {
    const adapter = new FetchApiAdapter();
    const response = adapter.toResponse({
      statusCode: 201,
      body: { id: "7", tags: ["a", "b"] },
    } as never);

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ id: "7", tags: ["a", "b"] });
  });

  test("expands multi-valued response headers with append", () => {
    const adapter = new FetchApiAdapter();
    const response = adapter.toResponse({
      statusCode: 200,
      header: { "set-cookie": ["a=1", "b=2"] },
    } as never);

    expect(response.headers.getSetCookie()).toEqual(["a=1", "b=2"]);
  });

  test("falls back to undefined body when JSON parse fails", async () => {
    const adapter = new FetchApiAdapter();
    const request = new Request("https://example.test/", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "not valid json",
    });

    const httpRequest = await adapter.toRequest(request);
    expect(httpRequest.body).toBeUndefined();
  });
});
