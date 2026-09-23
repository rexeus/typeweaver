import { describe, expect, test } from "vitest";
import { FetchApiAdapter } from "../../../src/lib/FetchApiAdapter.js";
import { BASE_URL } from "../../helpers.js";
import {
  createAdapterRequest,
  createAdapterRequestWithStream,
  createBodyStream,
  expectBodyParseError,
  parseRequest,
} from "./fixtures.js";

describe("Fetch request metadata", () => {
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
});

describe("Fetch JSON request bodies", () => {
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
});

describe("Fetch text and form request bodies", () => {
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
});
