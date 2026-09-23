import { badRequestDefaultError } from "@rexeus/typeweaver-core";
import {
  createCreateTodoSuccessResponse,
  createTestHono,
  TestApplicationError,
} from "test-utils";
import { HonoBodyParseError } from "test-utils/src/test-project/output/lib/hono/index.js";
import { describe, expect, test } from "vitest";
import { expectErrorResponse } from "../../../helpers.js";
import {
  aNestedJsonPrototypePollutionPayload,
  createUnvalidatedTodoHonoWithHandlers,
  readContextString,
  requestCreateTodoWithMalformedJson,
} from "./fixtures.js";

describe("Generated Hono body parsing", () => {
  test("returns sanitized BAD_REQUEST for malformed JSON request bodies", async () => {
    const response = await requestCreateTodoWithMalformedJson(createTestHono());

    const data = await expectErrorResponse(
      response,
      badRequestDefaultError.statusCode,
      badRequestDefaultError.code
    );
    expect(data["message"]).toBe(badRequestDefaultError.message);
  });

  test("explicit body parse handling preserves the default sanitized response before unknown handlers", async () => {
    let unknownHandlerInvoked = false;
    const app = createTestHono({
      handleBodyParseErrors: true,
      handleUnknownErrors: () => {
        unknownHandlerInvoked = true;
        return {
          statusCode: 500,
          body: { code: "CUSTOM_UNKNOWN" },
        };
      },
    });

    const response = await requestCreateTodoWithMalformedJson(app);

    const data = await expectErrorResponse(
      response,
      badRequestDefaultError.statusCode,
      badRequestDefaultError.code
    );
    expect(data["message"]).toBe(badRequestDefaultError.message);
    expect(unknownHandlerInvoked).toBe(false);
  });

  test("passes body parse errors and Hono context to custom handlers", async () => {
    let capturedError: unknown;
    let capturedOperationId: string | undefined;
    const app = createTestHono({
      handleBodyParseErrors: (error, context) => {
        capturedError = error;
        capturedOperationId = readContextString(context, "operationId");
        return {
          statusCode: 422,
          header: {
            "Content-Type": "application/json",
            "X-Body-Parse-Handled": "yes",
          },
          body: {
            code: "CUSTOM_BODY_PARSE",
            message: error.message,
          },
        };
      },
    });

    const response = await requestCreateTodoWithMalformedJson(app);

    expect(response.status).toBe(422);
    expect(response.headers.get("X-Body-Parse-Handled")).toBe("yes");
    const data = (await response.json()) as Record<string, unknown>;
    expect(data).toEqual({
      code: "CUSTOM_BODY_PARSE",
      message: "Invalid JSON in request body",
    });
    expect(capturedError).toBeInstanceOf(HonoBodyParseError);
    expect(capturedOperationId).toBe("CreateTodo");
  });

  test("routes malformed vendor JSON bodies to custom body parse handlers", async () => {
    let capturedError: unknown;
    let capturedOperationId: string | undefined;
    const app = createTestHono({
      handleBodyParseErrors: (error, context) => {
        capturedError = error;
        capturedOperationId = readContextString(context, "operationId");
        return {
          statusCode: 422,
          header: { "Content-Type": "application/json" },
          body: { code: "CUSTOM_VENDOR_JSON_PARSE" },
        };
      },
    });

    const response = await requestCreateTodoWithMalformedJson(app, {
      headers: { "Content-Type": "application/vnd.api+json; charset=utf-8" },
    });

    expect(response.status).toBe(422);
    const data = (await response.json()) as Record<string, unknown>;
    expect(data["code"]).toBe("CUSTOM_VENDOR_JSON_PARSE");
    expect(capturedError).toBeInstanceOf(HonoBodyParseError);
    expect(capturedOperationId).toBe("CreateTodo");
  });
});

describe("Generated Hono body parse handlers", () => {
  test("uses custom body parse handlers before route handlers when request validation is disabled", async () => {
    let routeHandlerInvoked = false;
    const app = createUnvalidatedTodoHonoWithHandlers(
      {
        handleCreateTodoRequest: async () => {
          routeHandlerInvoked = true;
          return createCreateTodoSuccessResponse();
        },
      },
      {
        handleBodyParseErrors: () => ({
          statusCode: 422,
          header: { "Content-Type": "application/json" },
          body: { code: "CUSTOM_BODY_PARSE_WITHOUT_VALIDATION" },
        }),
      }
    );

    const response = await requestCreateTodoWithMalformedJson(app);

    expect(response.status).toBe(422);
    const data = (await response.json()) as Record<string, unknown>;
    expect(data["code"]).toBe("CUSTOM_BODY_PARSE_WITHOUT_VALIDATION");
    expect(routeHandlerInvoked).toBe(false);
  });

  test("preserves async custom body parse handler status headers and body", async () => {
    const app = createTestHono({
      handleBodyParseErrors: async () => ({
        statusCode: 409,
        header: {
          "Content-Type": "application/json",
          "X-Async-Body-Parse-Handled": "yes",
        },
        body: { code: "ASYNC_BODY_PARSE", retryable: false },
      }),
    });

    const response = await requestCreateTodoWithMalformedJson(app);

    expect(response.status).toBe(409);
    expect(response.headers.get("X-Async-Body-Parse-Handled")).toBe("yes");
    const data = (await response.json()) as Record<string, unknown>;
    expect(data).toEqual({
      code: "ASYNC_BODY_PARSE",
      retryable: false,
    });
  });

  test("falls back to sanitized BAD_REQUEST when the custom body parse error handler throws", async () => {
    const app = createTestHono({
      handleBodyParseErrors: () => {
        throw new TestApplicationError("body parse handler failed");
      },
    });

    const response = await requestCreateTodoWithMalformedJson(app);

    const data = await expectErrorResponse(
      response,
      badRequestDefaultError.statusCode,
      badRequestDefaultError.code
    );
    expect(data["message"]).toBe(badRequestDefaultError.message);
  });
});

describe("Generated Hono body parse fallthrough", () => {
  test("routes body parse errors to the unknown error handler when body parse handling is disabled", async () => {
    let capturedError: unknown;
    let capturedOperationId: string | undefined;
    const app = createTestHono({
      handleBodyParseErrors: false,
      handleUnknownErrors: (error, context) => {
        capturedError = error;
        capturedOperationId = readContextString(context, "operationId");
        return {
          statusCode: 418,
          header: { "Content-Type": "application/json" },
          body: { code: "CUSTOM_UNKNOWN_BODY_PARSE" },
        };
      },
    });

    const response = await requestCreateTodoWithMalformedJson(app);

    expect(response.status).toBe(418);
    const data = (await response.json()) as Record<string, unknown>;
    expect(data["code"]).toBe("CUSTOM_UNKNOWN_BODY_PARSE");
    expect(capturedError).toBeInstanceOf(HonoBodyParseError);
    expect(capturedOperationId).toBe("CreateTodo");
  });

  test("passes body parse errors to Hono error handling when body and unknown handlers are disabled", async () => {
    let capturedError: unknown;
    let capturedOperationId: string | undefined;
    const app = createTestHono({
      handleBodyParseErrors: false,
      handleUnknownErrors: false,
    });
    app.onError((error, context) => {
      capturedError = error;
      const operationId = readContextString(context, "operationId");
      capturedOperationId =
        typeof operationId === "string" ? operationId : undefined;
      return context.json({ code: "HONO_ERROR" }, 502);
    });

    const response = await requestCreateTodoWithMalformedJson(app);

    expect(response.status).toBe(502);
    const data = (await response.json()) as Record<string, unknown>;
    expect(data["code"]).toBe("HONO_ERROR");
    expect(capturedError).toBeInstanceOf(HonoBodyParseError);
    expect(capturedOperationId).toBe("CreateTodo");
  });

  test("passes JSON request bodies to handlers as null-prototype records when request validation is disabled", async () => {
    let bodyPrototype: unknown;
    let nestedPrototype: unknown;
    let arrayItemPrototype: unknown;
    let handlerSawArray = false;
    const app = createUnvalidatedTodoHonoWithHandlers({
      handleCreateTodoRequest: async request => {
        const body = request.body as Record<string, unknown>;
        const meta = body["meta"] as Record<string, unknown>;
        const items = body["items"] as Record<string, unknown>[];
        bodyPrototype = Object.getPrototypeOf(body);
        nestedPrototype = Object.getPrototypeOf(meta);
        handlerSawArray = Array.isArray(items);
        arrayItemPrototype = Object.getPrototypeOf(items[0]);
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
    const data = (await response.json()) as Record<string, unknown>;
    expect(data["title"]).toBe("safe title");
    expect(bodyPrototype).toBeNull();
    expect(nestedPrototype).toBeNull();
    expect(handlerSawArray).toBe(true);
    expect(arrayItemPrototype).toBeNull();
  });
});

describe("Generated Hono runtime exports", () => {
  test("exports HonoBodyParseError from the generated Hono lib barrel without the plain server error name", async () => {
    let capturedError: unknown;
    const app = createTestHono({
      handleBodyParseErrors: error => {
        capturedError = error;
        return {
          statusCode: 422,
          body: { code: "CUSTOM_BODY_PARSE" },
        };
      },
    });
    const honoRuntime =
      await import("test-utils/src/test-project/output/lib/hono/index.js");
    const error = new HonoBodyParseError("Invalid JSON in request body");

    const response = await requestCreateTodoWithMalformedJson(app);

    expect(response.status).toBe(422);
    expect(error).toBeInstanceOf(HonoBodyParseError);
    expect(error.name).toBe("HonoBodyParseError");
    expect(capturedError).toBeInstanceOf(HonoBodyParseError);
    expect("BodyParseError" in honoRuntime).toBe(false);
  });
});
