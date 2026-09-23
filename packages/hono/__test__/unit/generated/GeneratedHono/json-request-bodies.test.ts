import { badRequestDefaultError } from "@rexeus/typeweaver-core";
import { createCreateTodoSuccessResponse, createTestHono } from "test-utils";
import { describe, expect, test } from "vitest";
import { expectErrorResponse } from "../../../helpers.js";
import {
  aNestedJsonPrototypePollutionPayload,
  createUnvalidatedTodoHonoWithHandlers,
  requestCreateTodoWithMalformedJson,
} from "./fixtures.js";

describe("Generated Hono JSON sanitization", () => {
  test("removes __proto__ keys from nested JSON request bodies without polluting Object.prototype", async () => {
    let handlerSawUnsafeKey = true;
    let handlerSawNestedUnsafeKey = true;
    let handlerSawArrayUnsafeKey = true;
    let handlerSawPollution: unknown = true;
    const app = createUnvalidatedTodoHonoWithHandlers({
      handleCreateTodoRequest: async request => {
        const body = request.body as Record<string, unknown>;
        const meta = body["meta"] as Record<string, unknown>;
        const items = body["items"] as Record<string, unknown>[];
        handlerSawUnsafeKey = Object.prototype.hasOwnProperty.call(
          body,
          "__proto__"
        );
        handlerSawNestedUnsafeKey = Object.prototype.hasOwnProperty.call(
          meta,
          "__proto__"
        );
        handlerSawArrayUnsafeKey = Object.prototype.hasOwnProperty.call(
          items[0],
          "__proto__"
        );
        handlerSawPollution = ({} as Record<string, unknown>)["polluted"];
        return createCreateTodoSuccessResponse({
          body: { title: String(body["title"]) },
        });
      },
    });

    const response = await app.request("http://localhost/todos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: aNestedJsonPrototypePollutionPayload(),
    });

    expect(response.status).toBe(201);
    expect(handlerSawUnsafeKey).toBe(false);
    expect(handlerSawNestedUnsafeKey).toBe(false);
    expect(handlerSawArrayUnsafeKey).toBe(false);
    expect(handlerSawPollution).toBeUndefined();
    expect(({} as Record<string, unknown>)["polluted"]).toBeUndefined();
  });

  test("preserves top-level JSON array request bodies when validation is disabled", async () => {
    let handlerBody: unknown;
    let bodyIsArray = false;
    const app = createUnvalidatedTodoHonoWithHandlers({
      handleCreateTodoRequest: async request => {
        handlerBody = request.body;
        bodyIsArray = Array.isArray(request.body);
        return createCreateTodoSuccessResponse();
      },
    });

    const response = await app.request("http://localhost/todos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: '[{"value":"x"},{"value":"y"}]',
    });

    expect(response.status).toBe(201);
    expect(bodyIsArray).toBe(true);
    expect(handlerBody).toEqual([{ value: "x" }, { value: "y" }]);
  });
});

describe("Generated Hono JSON arrays and vendor media types", () => {
  test("strips __proto__ keys from top-level JSON array elements without polluting Object.prototype", async () => {
    let elementUnsafeKey = true;
    let elementPollution: unknown = true;
    const app = createUnvalidatedTodoHonoWithHandlers({
      handleCreateTodoRequest: async request => {
        const [first] = request.body as unknown as Record<string, unknown>[];
        elementUnsafeKey = Object.prototype.hasOwnProperty.call(
          first,
          "__proto__"
        );
        elementPollution = ({} as Record<string, unknown>)["polluted"];
        return createCreateTodoSuccessResponse();
      },
    });

    const response = await app.request("http://localhost/todos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: '[{"__proto__":{"polluted":true},"value":"x"}]',
    });

    expect(response.status).toBe(201);
    expect(elementUnsafeKey).toBe(false);
    expect(elementPollution).toBeUndefined();
    expect(({} as Record<string, unknown>)["polluted"]).toBeUndefined();
  });

  test("parses vendor JSON media types when request validation is disabled", async () => {
    let handlerBody: Record<string, unknown> | undefined;
    const app = createUnvalidatedTodoHonoWithHandlers({
      handleCreateTodoRequest: async request => {
        handlerBody = request.body as Record<string, unknown>;
        return createCreateTodoSuccessResponse({
          body: { title: String(handlerBody["title"]) },
        });
      },
    });

    const response = await app.request("http://localhost/todos", {
      method: "POST",
      headers: { "Content-Type": "application/vnd.api+json; charset=utf-8" },
      body: '{"title":"vendor json title"}',
    });

    expect(response.status).toBe(201);
    expect(handlerBody?.["title"]).toBe("vendor json title");
    expect(
      Object.getPrototypeOf(handlerBody as Record<string, unknown>)
    ).toBeNull();
  });

  test("returns sanitized BAD_REQUEST for malformed vendor JSON request bodies", async () => {
    const response = await requestCreateTodoWithMalformedJson(
      createTestHono({
        validateRequests: false,
      }),
      {
        headers: {
          "Content-Type": "application/vnd.api+json; charset=utf-8",
        },
      }
    );

    await expectErrorResponse(
      response,
      badRequestDefaultError.statusCode,
      badRequestDefaultError.code
    );
  });
});

describe("Generated Hono malformed JSON handling", () => {
  test("returns sanitized BAD_REQUEST for malformed JSON before invoking handlers when validation is disabled", async () => {
    let handlerInvoked = false;
    const app = createUnvalidatedTodoHonoWithHandlers({
      handleCreateTodoRequest: async () => {
        handlerInvoked = true;
        return createCreateTodoSuccessResponse();
      },
    });

    const response = await requestCreateTodoWithMalformedJson(app);

    await expectErrorResponse(
      response,
      badRequestDefaultError.statusCode,
      badRequestDefaultError.code
    );
    expect(handlerInvoked).toBe(false);
  });

  test("keeps malformed JSON as BAD_REQUEST when a custom unknown error handler is configured", async () => {
    const response = await requestCreateTodoWithMalformedJson(
      createTestHono({
        handleUnknownErrors: () => ({
          statusCode: 500,
          body: { code: "CUSTOM_UNKNOWN" },
        }),
      })
    );

    await expectErrorResponse(
      response,
      badRequestDefaultError.statusCode,
      badRequestDefaultError.code
    );
  });

  test("passes text request bodies to handlers as strings when validation is disabled", async () => {
    let handlerBody: unknown;
    const app = createUnvalidatedTodoHonoWithHandlers({
      handleCreateTodoRequest: async request => {
        handlerBody = request.body;
        return createCreateTodoSuccessResponse({
          body: { title: String(request.body) },
        });
      },
    });

    const response = await app.request("http://localhost/todos", {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: "plain text todo",
    });

    expect(response.status).toBe(201);
    expect(handlerBody).toBe("plain text todo");
  });

  test("passes unknown-content-type request bodies to handlers as raw text when request validation is disabled", async () => {
    let handlerBody: unknown;
    const app = createUnvalidatedTodoHonoWithHandlers({
      handleCreateTodoRequest: async request => {
        handlerBody = request.body;
        return createCreateTodoSuccessResponse({
          body: { title: String(request.body) },
        });
      },
    });

    const response = await app.request("http://localhost/todos", {
      method: "POST",
      headers: { "Content-Type": "application/octet-stream" },
      body: "raw bytes as text",
    });

    expect(response.status).toBe(201);
    const data = (await response.json()) as Record<string, unknown>;
    expect(handlerBody).toBe("raw bytes as text");
    expect(data["title"]).toBe("raw bytes as text");
  });
});
