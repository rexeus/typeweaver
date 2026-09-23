import { TestApplicationError } from "test-utils";
import { describe, expect, test, vi } from "vitest";
import { ResponseSerializationError } from "../../../src/lib/errors/index.js";
import { defineMiddleware } from "../../../src/lib/TypedMiddleware.js";
import { expectErrorResponse, get } from "../../helpers.js";
import { createApp, expectInternalError } from "./fixtures.js";

describe("Response Conversion", () => {
  test("should set Content-Type to application/json for object bodies", async () => {
    const app = createApp();

    const res = await app.fetch(get("/todos"));

    expect(res.headers.get("content-type")).toBe("application/json");
  });

  test("should handle empty response bodies", async () => {
    const app = createApp(undefined, {
      handleGetTodos: async () => ({ statusCode: 204 }),
    });

    const res = await app.fetch(get("/todos"));

    expect(res.status).toBe(204);
    const text = await res.text();
    expect(text).toBe("");
  });

  test("should preserve custom response headers", async () => {
    const app = createApp(undefined, {
      handleGetTodos: async () => ({
        statusCode: 200,
        header: {
          "X-Custom": "value",
          "X-Multi": ["a", "b"],
        },
        body: {},
      }),
    });

    const res = await app.fetch(get("/todos"));

    expect(res.headers.get("x-custom")).toBe("value");
    expect(res.headers.get("x-multi")).toContain("a");
    expect(res.headers.get("x-multi")).toContain("b");
  });

  test("should return string body without auto-setting Content-Type to JSON", async () => {
    const app = createApp(undefined, {
      handleGetTodos: async () => ({ statusCode: 200, body: "plain text" }),
    });
    const res = await app.fetch(get("/todos"));

    expect(res.status).toBe(200);
    expect(await res.text()).toBe("plain text");
    expect(res.headers.get("content-type")).not.toBe("application/json");
  });

  test("should preserve explicit Content-Type for string body", async () => {
    const app = createApp(undefined, {
      handleGetTodos: async () => ({
        statusCode: 200,
        header: { "Content-Type": "text/plain" },
        body: "plain text",
      }),
    });
    const res = await app.fetch(get("/todos"));

    expect(res.headers.get("content-type")).toBe("text/plain");
    expect(await res.text()).toBe("plain text");
  });
});

describe("TypeweaverApp response serialization errors", () => {
  test("returns a sanitized 500 when response serialization fails", async () => {
    const circularBody: Record<string, unknown> = {
      secret: "circular serialization details",
    };
    circularBody["self"] = circularBody;
    const app = createApp(
      undefined,
      {
        handleGetTodos: async () => ({
          statusCode: 200,
          body: circularBody,
        }),
      },
      { onError: vi.fn() }
    );

    const res = await app.fetch(get("/todos"));

    const data = await expectInternalError(res);
    expect(JSON.stringify(data)).not.toContain(
      "circular serialization details"
    );
  });

  test("reports onError when response serialization fails", async () => {
    const onError = vi.fn();
    const circularBody: Record<string, unknown> = {};
    circularBody["self"] = circularBody;
    const app = createApp(
      undefined,
      {
        handleGetTodos: async () => ({
          statusCode: 200,
          body: circularBody,
        }),
      },
      { onError }
    );

    await app.fetch(get("/todos"));

    expect(onError).toHaveBeenCalledWith(
      expect.any(ResponseSerializationError)
    );
  });

  test("should handle errors thrown inside middleware", async () => {
    const onError = vi.fn();
    const app = createApp(undefined, undefined, { onError });
    const boom = defineMiddleware(async () => {
      throw new TestApplicationError("middleware boom");
    });

    app.use(boom);

    const res = await app.fetch(get("/todos"));

    await expectErrorResponse(res, 500, "INTERNAL_SERVER_ERROR");
    expect(onError).toHaveBeenCalledOnce();
  });
});
