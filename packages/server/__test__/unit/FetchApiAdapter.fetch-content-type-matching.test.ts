import { TestAssertionError } from "test-utils";
import { describe, expect, test } from "vitest";
import { PayloadTooLargeError } from "../../src/lib/Errors.js";
import { FetchApiAdapter } from "../../src/lib/FetchApiAdapter.js";
import { BASE_URL } from "../helpers.js";

function createAdapterRequest(path: string, init?: RequestInit): Request {
  return new Request(`${BASE_URL}${path}`, init);
}

function isUnknownRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function requireUnknownRecord(value: unknown): Record<string, unknown> {
  if (!isUnknownRecord(value)) {
    throw new TestAssertionError("Expected an object body");
  }
  return value;
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

describe("Fetch Content-Type matching", () => {
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

describe("Fetch query and form prototype pollution protection", () => {
  test("stores __proto__ as a regular property in query params", async () => {
    const adapter = new FetchApiAdapter();
    const request = new Request(`${BASE_URL}/todos?__proto__=polluted`);
    const before: unknown = Object.getPrototypeOf({});

    const result = await adapter.toRequest(request);

    expect(result.query?.["__proto__"]).toBe("polluted");
    expect(Object.getPrototypeOf({})).toBe(before);
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
    const before: unknown = Object.getPrototypeOf({});

    const result = await adapter.toRequest(request);
    const body = requireUnknownRecord(result.body);

    expect(body["__proto__"]).toBe("polluted");
    expect(body["constructor"]).toBe("evil");
    expect(Object.getPrototypeOf({})).toBe(before);
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
    const before: unknown = Object.getPrototypeOf({});

    const result = await adapter.toRequest(request);
    const body = requireUnknownRecord(result.body);

    expect(body["__proto__"]).toBe("polluted");
    expect(body["constructor"]).toBe("evil");
    expect(Object.getPrototypeOf({})).toBe(before);
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
    const body = requireUnknownRecord(result.body);

    expect(body["title"]).toBe("safe");
    expect(body["__proto__"]).toEqual(["a", "b"]);
    expect(Object.prototype).not.toHaveProperty("a");
    expect(Object.prototype).not.toHaveProperty("b");
  });
});

describe("Fetch JSON prototype pollution protection", () => {
  test("strips top-level __proto__ from raw JSON request bodies", async () => {
    const adapter = new FetchApiAdapter();
    const request = new Request(`${BASE_URL}/todos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: '{"title":"legit","__proto__":{"isAdmin":true}}',
    });
    const before: unknown = Object.getPrototypeOf({});

    const result = await adapter.toRequest(request);
    const body = requireUnknownRecord(result.body);

    expect(body["title"]).toBe("legit");
    expect(Object.hasOwn(body, "__proto__")).toBe(false);
    expect(Object.getPrototypeOf({})).toBe(before);
    expect(Reflect.get({}, "isAdmin")).toBeUndefined();
  });

  test("strips nested __proto__ from JSON request bodies", async () => {
    const adapter = new FetchApiAdapter();
    const body = '{"user": {"__proto__": {"isAdmin": true}, "name": "test"}}';
    const request = new Request(`${BASE_URL}/todos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });

    const result = await adapter.toRequest(request);
    const responseBody = requireUnknownRecord(result.body);
    const user = requireUnknownRecord(responseBody["user"]);

    expect(user["name"]).toBe("test");
    expect(Object.hasOwn(user, "__proto__")).toBe(false);
    expect(Reflect.get({}, "isAdmin")).toBeUndefined();
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
    if (!Array.isArray(result.body)) {
      throw new TestAssertionError("Expected an array body");
    }
    const firstItem = requireUnknownRecord(result.body[0]);
    expect(Object.hasOwn(firstItem, "__proto__")).toBe(false);
    expect(Reflect.get({}, "isAdmin")).toBeUndefined();
  });

  test("allows constructor and prototype as regular JSON keys", async () => {
    const adapter = new FetchApiAdapter();
    const request = new Request(`${BASE_URL}/todos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ constructor: "value", prototype: "value" }),
    });

    const result = await adapter.toRequest(request);
    const body = requireUnknownRecord(result.body);

    expect(body.constructor).toBe("value");
    expect(body["prototype"]).toBe("value");
  });
});

describe("Fetch Content-Length body limits", () => {
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
});
