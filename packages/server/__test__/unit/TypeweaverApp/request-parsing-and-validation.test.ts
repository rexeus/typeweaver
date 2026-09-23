import {
  badRequestDefaultError,
  payloadTooLargeDefaultError,
} from "@rexeus/typeweaver-core";
import { TestApplicationError } from "test-utils";
import { describe, expect, test, vi } from "vitest";
import { PayloadTooLargeError } from "../../../src/lib/errors/index.js";
import { TypeweaverApp } from "../../../src/lib/TypeweaverApp.js";
import {
  BASE_URL,
  expectErrorResponse,
  expectJson,
  get,
  post,
  postRaw,
} from "../../helpers.js";
import {
  createApp,
  defaultHandlers,
  TestRouter,
  withConsoleErrorSpy,
} from "./fixtures.js";

describe("Body Size Limit", () => {
  test("should return 413 for oversized body with maxBodySize set", async () => {
    const app = createApp(undefined, undefined, {
      maxBodySize: 50,
      onError: vi.fn(),
    });
    const res = await app.fetch(
      postRaw("/todos", "x".repeat(100), "text/plain")
    );

    const data = await expectErrorResponse(
      res,
      payloadTooLargeDefaultError.statusCode,
      payloadTooLargeDefaultError.code
    );
    expect(data["message"]).toBe(payloadTooLargeDefaultError["message"]);
  });

  test("passes a body within the configured limit to the handler", async () => {
    const app = createApp(undefined, undefined, {
      maxBodySize: 10000,
      onError: vi.fn(),
    });

    const res = await app.fetch(post("/todos", { title: "New Todo" }));

    const data = await expectJson(res, 201);
    expect(data["title"]).toBe("New Todo");
  });

  test("accepts a body exactly at the configured limit", async () => {
    const app = createApp(
      undefined,
      {
        handleCreateTodo: async req => ({
          statusCode: 201,
          body: { size: String(req.body).length },
        }),
      },
      { maxBodySize: 8, onError: vi.fn() }
    );

    const res = await app.fetch(postRaw("/todos", "x".repeat(8), "text/plain"));

    const data = await expectJson(res, 201);
    expect(data["size"]).toBe(8);
  });

  test("returns 413 when the body exceeds the 1 MB default limit", async () => {
    const app = createApp(undefined, undefined, { onError: vi.fn() });
    const oneByteOverDefaultLimit = "x".repeat(1_048_577);

    const res = await app.fetch(
      postRaw("/todos", oneByteOverDefaultLimit, "text/plain")
    );

    const data = await expectErrorResponse(
      res,
      payloadTooLargeDefaultError.statusCode,
      payloadTooLargeDefaultError.code
    );
    expect(data["message"]).toBe(payloadTooLargeDefaultError["message"]);
  });

  test("accepts a body exactly at the 1 MB default limit", async () => {
    const app = createApp(undefined, {
      handleCreateTodo: async req => ({
        statusCode: 201,
        body: { size: String(req.body).length },
      }),
    });
    const defaultLimitBody = "x".repeat(1_048_576);

    const res = await app.fetch(
      postRaw("/todos", defaultLimitBody, "text/plain")
    );

    const data = await expectJson(res, 201);
    expect(data["size"]).toBe(1_048_576);
  });

  test("should return 413 for oversized body without Content-Length header", async () => {
    const app = createApp(undefined, undefined, {
      maxBodySize: 50,
      onError: vi.fn(),
    });
    const request = new Request(BASE_URL + "/todos", {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: "x".repeat(100),
    });
    request.headers.delete("content-length");

    const res = await app.fetch(request);

    const data = await expectErrorResponse(
      res,
      payloadTooLargeDefaultError.statusCode,
      payloadTooLargeDefaultError.code
    );
    expect(data["message"]).toBe(payloadTooLargeDefaultError["message"]);
  });
});

describe("Form URL-Encoded Edge Cases", () => {
  test("should handle multi-value fields in form-urlencoded body", async () => {
    const app = new TypeweaverApp();
    const router = new TestRouter({
      validateRequests: false,
      requestHandlers: {
        ...defaultHandlers(),
        handleCreateTodo: async req => ({
          statusCode: 200,
          body: req.body,
        }),
      },
    });
    app.route(router);

    const request = new Request(BASE_URL + "/todos", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "tags=a&tags=b&tags=c",
    });

    const res = await app.fetch(request);
    const data = await expectJson(res, 200);
    expect(data["tags"]).toEqual(["a", "b", "c"]);
  });
});

describe("TypeweaverApp malformed request errors", () => {
  test("should return 500 for completely malformed request URL", async () => {
    const app = createApp();

    const badRequest = get("/todos");
    Object.defineProperty(badRequest, "url", { value: "not-a-valid-url" });

    const res = await app.fetch(badRequest);

    await expectErrorResponse(res, 500, "INTERNAL_SERVER_ERROR");
  });

  test("should return 400 for malformed JSON body", async () => {
    const app = createApp();

    const res = await app.fetch(
      postRaw("/todos", "{ invalid json", "application/json")
    );

    const data = await expectErrorResponse(
      res,
      badRequestDefaultError.statusCode,
      badRequestDefaultError.code
    );
    expect(data["message"]).toBe(badRequestDefaultError["message"]);
  });

  test("should NOT call onError for handled BodyParseError", async () => {
    const onError = vi.fn();
    const app = createApp(undefined, undefined, { onError });

    const res = await app.fetch(
      postRaw("/todos", "{ invalid json", "application/json")
    );

    expect(res.status).toBe(400);
    expect(onError).not.toHaveBeenCalled();
  });

  test("should call onError for PayloadTooLargeError", async () => {
    const onError = vi.fn();
    const app = createApp(undefined, undefined, {
      maxBodySize: 50,
      onError,
    });

    const res = await app.fetch(
      postRaw("/todos", "x".repeat(100), "text/plain")
    );

    expect(res.status).toBe(413);
    expect(onError).toHaveBeenCalledOnce();
    expect(onError).toHaveBeenCalledWith(expect.any(PayloadTooLargeError));
  });

  test("should default onError to console.error", async () => {
    const app = createApp(undefined, {
      handleGetTodos: async () => {
        throw new TestApplicationError("should be logged");
      },
    });

    await withConsoleErrorSpy(async spy => {
      await app.fetch(get("/todos"));

      expect(spy).toHaveBeenCalledOnce();
    });
  });
});

describe("Request Validation", () => {
  test("should skip validation when validateRequests is false", async () => {
    const app = createApp({ validateRequests: false });
    const res = await app.fetch(post("/todos", { title: "Valid" }));
    await expectJson(res, 201);
  });

  test("should enforce validation when validateRequests is true", async () => {
    const app = createApp({ validateRequests: true });
    const res = await app.fetch(post("/todos", { title: "Any" }));
    await expectErrorResponse(res, 400, "VALIDATION_ERROR");
  });
});
