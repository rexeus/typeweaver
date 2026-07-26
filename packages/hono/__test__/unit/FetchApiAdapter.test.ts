import { describe, expect, test } from "vitest";
import {
  HonoBodyParseError,
  HonoResponseSerializationError,
} from "../../src/lib/Errors.js";
import { FetchApiAdapter } from "../../src/lib/FetchApiAdapter.js";

const TEST_URL = "https://typeweaver.test/body";

describe("FetchApiAdapter request body boundary", () => {
  test("parses JSON values from external requests", async () => {
    const adapter = new FetchApiAdapter();
    const request = new Request(TEST_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "hello" }),
    });

    const result = await adapter.toRequest(request);

    expect(result.body).toEqual({ message: "hello" });
  });

  test("rejects malformed external JSON", async () => {
    const adapter = new FetchApiAdapter();
    const request = new Request(TEST_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{ malformed",
    });

    await expect(adapter.toRequest(request)).rejects.toBeInstanceOf(
      HonoBodyParseError
    );
  });
});

describe("FetchApiAdapter response body boundary", () => {
  test.each([
    {
      scenario: "JSON object",
      body: { message: "hello" },
      expected: '{"message":"hello"}',
    },
    { scenario: "string", body: "hello", expected: "hello" },
    { scenario: "null", body: null, expected: "null" },
    { scenario: "undefined", body: undefined, expected: "" },
  ])("preserves $scenario response bodies", async ({ body, expected }) => {
    const adapter = new FetchApiAdapter();

    const response = adapter.toResponse({ statusCode: 200, body });

    expect(await response.text()).toBe(expected);
  });

  test("preserves ArrayBuffer response bodies", async () => {
    const adapter = new FetchApiAdapter();
    const body = new TextEncoder().encode("binary").buffer;

    const response = adapter.toResponse({ statusCode: 200, body });

    expect(await response.arrayBuffer()).toEqual(body);
  });

  test("preserves Blob response bodies and their media type", async () => {
    const adapter = new FetchApiAdapter();
    const body = new Blob(["blob"], { type: "application/octet-stream" });

    const response = adapter.toResponse({ statusCode: 200, body });

    expect(response.headers.get("content-type")).toBe(
      "application/octet-stream"
    );
    expect(await response.text()).toBe("blob");
  });

  test.each([
    { scenario: "function", body: () => "not serializable" },
    { scenario: "symbol", body: Symbol("not serializable") },
    { scenario: "BigInt", body: BigInt(1) },
    { scenario: "undefined toJSON", body: { toJSON: () => undefined } },
  ])("rejects unserializable $scenario bodies", ({ body }) => {
    const adapter = new FetchApiAdapter();

    expect(() => adapter.toResponse({ statusCode: 200, body })).toThrowError(
      HonoResponseSerializationError
    );
  });
});
