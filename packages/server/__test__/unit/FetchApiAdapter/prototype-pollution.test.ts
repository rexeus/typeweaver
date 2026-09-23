import { TestAssertionError } from "test-utils";
import { describe, expect, test } from "vitest";
import { FetchApiAdapter } from "../../../src/lib/FetchApiAdapter.js";
import { BASE_URL } from "../../helpers.js";
import { createAdapterRequest, requireUnknownRecord } from "./fixtures.js";

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
