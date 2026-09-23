import { TestIoError } from "test-utils";
import { describe, expect, test, vi } from "vitest";
import { ResponseParseError } from "../../../src/lib/ResponseParseError.js";
import { requireArrayBuffer } from "../../helpers.js";
import { createClient, resolvedFetch, TestRequestCommand } from "./fixtures.js";

describe("ApiClient response parsing", () => {
  test.each([
    { case: "204 No Content", status: 204 },
    { case: "304 Not Modified", status: 304 },
  ])(
    "returns undefined body for $case even with content-type",
    async ({ status }) => {
      const mockFetch = resolvedFetch(
        new Response(null, {
          status,
          headers: { "content-type": "application/json" },
        })
      );
      const client = createClient(mockFetch);

      const result = await client.send(new TestRequestCommand());

      expect(result.body).toBeUndefined();
    }
  );

  test("returns undefined body for empty text responses", async () => {
    const mockFetch = resolvedFetch(new Response("", { status: 200 }));
    const client = createClient(mockFetch);

    const result = await client.send(new TestRequestCommand());

    expect(result.body).toBeUndefined();
  });

  test("returns undefined body for empty JSON responses", async () => {
    const mockFetch = resolvedFetch(
      new Response("", {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );
    const client = createClient(mockFetch);

    const result = await client.send(new TestRequestCommand());

    expect(result.body).toBeUndefined();
  });

  test.each([
    { case: "application/json", contentType: "application/json" },
    {
      case: "application/json with charset",
      contentType: "application/json; charset=utf-8",
    },
    { case: "+json media type", contentType: "application/problem+json" },
    { case: "case-insensitive JSON", contentType: "Application/JSON" },
    {
      case: "case-insensitive +json",
      contentType: "APPLICATION/PROBLEM+JSON",
    },
  ])("parses $case responses as JSON", async ({ contentType }) => {
    const mockFetch = resolvedFetch(
      new Response('{"ok":true}', {
        status: 200,
        headers: { "content-type": contentType },
      })
    );
    const client = createClient(mockFetch);

    const result = await client.send(new TestRequestCommand());

    expect(result.body).toEqual({ ok: true });
  });

  test("throws ResponseParseError with status, bounded preview, and cause for invalid JSON", async () => {
    const body = `{${"x".repeat(250)}`;
    const mockFetch = resolvedFetch(
      new Response(body, {
        status: 502,
        headers: { "content-type": "application/json" },
      })
    );
    const client = createClient(mockFetch);

    await expect(client.send(new TestRequestCommand())).rejects.toSatisfy(
      (error: unknown) => {
        return (
          error instanceof ResponseParseError &&
          error.statusCode === 502 &&
          error.bodyPreview === body.slice(0, 200) &&
          error.bodyPreview.length === 200 &&
          error.cause instanceof SyntaxError
        );
      }
    );
  });
});

describe("ApiClient text and binary response parsing", () => {
  test("returns text/plain responses as strings", async () => {
    const mockFetch = resolvedFetch(
      new Response("plain text", {
        status: 200,
        headers: { "content-type": "text/plain" },
      })
    );
    const client = createClient(mockFetch);

    const result = await client.send(new TestRequestCommand());

    expect(result.body).toBe("plain text");
  });

  test("returns case-insensitive text content types as strings", async () => {
    const mockFetch = resolvedFetch(
      new Response("plain text", {
        status: 200,
        headers: { "content-type": "TEXT/PLAIN; charset=UTF-8" },
      })
    );
    const client = createClient(mockFetch);

    const result = await client.send(new TestRequestCommand());

    expect(result.body).toBe("plain text");
  });

  test("returns responses with no content-type as strings", async () => {
    const mockFetch = resolvedFetch(new Response("raw text", { status: 200 }));
    const client = createClient(mockFetch);

    const result = await client.send(new TestRequestCommand());

    expect(result.body).toBe("raw text");
  });

  test("returns application/octet-stream responses as ArrayBuffer", async () => {
    const mockFetch = resolvedFetch(
      new Response(new Uint8Array([1, 2, 3]), {
        status: 200,
        headers: { "content-type": "application/octet-stream" },
      })
    );
    const client = createClient(mockFetch);

    const result = await client.send(new TestRequestCommand());

    expect(result.body).toBeInstanceOf(ArrayBuffer);
    expect(Array.from(new Uint8Array(requireArrayBuffer(result.body)))).toEqual(
      [1, 2, 3]
    );
  });

  test("returns empty application/octet-stream responses as zero-length ArrayBuffer", async () => {
    const mockFetch = resolvedFetch(
      new Response(new Uint8Array([]), {
        status: 200,
        headers: { "content-type": "application/octet-stream" },
      })
    );
    const client = createClient(mockFetch);

    const result = await client.send(new TestRequestCommand());

    expect(result.body).toBeInstanceOf(ArrayBuffer);
    expect(requireArrayBuffer(result.body).byteLength).toBe(0);
  });
});

describe("ApiClient response body read failures", () => {
  test("wraps response body read failures as ResponseParseError", async () => {
    const cause = new TestIoError("body stream interrupted");
    const response = new Response("body", {
      status: 200,
      headers: { "content-type": "text/plain" },
    });
    vi.spyOn(response, "text").mockRejectedValue(cause);
    const mockFetch = resolvedFetch(response);
    const client = createClient(mockFetch);

    await expect(client.send(new TestRequestCommand())).rejects.toSatisfy(
      (error: unknown) => {
        return (
          error instanceof ResponseParseError &&
          error.statusCode === 200 &&
          error.bodyPreview === "" &&
          error.cause === cause &&
          error.message.includes("Failed to read response body")
        );
      }
    );
  });

  test("wraps binary response body read failures as ResponseParseError", async () => {
    const cause = new TestIoError("binary stream interrupted");
    const response = new Response(new Uint8Array([1]), {
      status: 206,
      headers: { "content-type": "application/octet-stream" },
    });
    vi.spyOn(response, "arrayBuffer").mockRejectedValue(cause);
    const mockFetch = resolvedFetch(response);
    const client = createClient(mockFetch);

    await expect(client.send(new TestRequestCommand())).rejects.toSatisfy(
      (error: unknown) => {
        return (
          error instanceof ResponseParseError &&
          error.statusCode === 206 &&
          error.bodyPreview === "" &&
          error.cause === cause &&
          error.message.includes("Failed to read response body")
        );
      }
    );
  });
});

describe("ApiClient response headers", () => {
  test("copies response headers into a plain object", async () => {
    const mockFetch = resolvedFetch(
      new Response("{}", {
        status: 200,
        headers: {
          "content-type": "application/json",
          "x-request-id": "req_123",
        },
      })
    );
    const client = createClient(mockFetch);

    const result = await client.send(new TestRequestCommand());

    expect(result.header).toStrictEqual({
      "content-type": "application/json",
      "x-request-id": "req_123",
    });
  });

  test("preserves native Headers comma-join behavior for repeated non-cookie headers", async () => {
    const headers = new Headers({ "content-type": "application/json" });
    headers.append("x-custom", "first");
    headers.append("x-custom", "second");
    const mockFetch = resolvedFetch(
      new Response("{}", { status: 200, headers })
    );
    const client = createClient(mockFetch);

    const result = await client.send(new TestRequestCommand());

    expect(result.header?.["x-custom"]).toBe("first, second");
  });

  test("preserves native getSetCookie values as a string array when available", async () => {
    const response = new Response("{}", {
      status: 200,
      headers: { "content-type": "application/json" },
    });
    Object.defineProperty(response.headers, "getSetCookie", {
      value: () => ["a=1; Path=/", "b=2; Path=/"],
    });
    const mockFetch = resolvedFetch(response);
    const client = createClient(mockFetch);

    const result = await client.send(new TestRequestCommand());

    expect(result.header?.["set-cookie"]).toStrictEqual([
      "a=1; Path=/",
      "b=2; Path=/",
    ]);
  });

  test("preserves a single native getSetCookie value as a string array", async () => {
    const response = new Response("{}", {
      status: 200,
      headers: { "content-type": "application/json" },
    });
    Object.defineProperty(response.headers, "getSetCookie", {
      value: () => ["sid=abc; Path=/"],
    });
    const mockFetch = resolvedFetch(response);
    const client = createClient(mockFetch);

    const result = await client.send(new TestRequestCommand());

    expect(result.header?.["set-cookie"]).toStrictEqual(["sid=abc; Path=/"]);
  });
});
