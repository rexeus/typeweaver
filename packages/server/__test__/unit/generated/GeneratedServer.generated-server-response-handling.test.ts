import type { ITypedHttpResponse } from "@rexeus/typeweaver-core";
import {
  createCreateTodoRequest,
  createDeleteTodoRequest,
  createTestApp,
  defineMiddleware,
  TestApplicationError,
} from "test-utils";
import { describe, expect, test } from "vitest";
import {
  BASE_URL,
  buildFetchRequest,
  expectErrorResponse,
  expectJson,
} from "../../helpers.js";

async function expectNoBody(response: Response): Promise<void> {
  expect(await response.text()).toBe("");
}

describe("Generated Server response handling", () => {
  test("returns JSON response bodies with the generated content type", async () => {
    const app = createTestApp();
    const requestData = createCreateTodoRequest();

    const response = await app.fetch(
      buildFetchRequest(`${BASE_URL}/todos`, requestData)
    );

    expect(response.headers.get("Content-Type")).toBe("application/json");
    const data = await expectJson(response, 201);
    expect(data["id"]).toEqual(expect.any(String));
    expect(data["title"]).toBe(requestData.body.title);
  });

  test("returns string response bodies as plain text", async () => {
    const customStringResponse = "This is a plain text response";
    const app = createTestApp({
      validateResponses: false,
      throwTodoError: {
        type: "CustomStringResponse" as const,
        statusCode: 200,
        header: { "Content-Type": "text/plain" },
        body: customStringResponse,
      } satisfies ITypedHttpResponse,
    });
    const requestData = createCreateTodoRequest();

    const response = await app.fetch(
      buildFetchRequest(`${BASE_URL}/todos`, requestData)
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toBe(customStringResponse);
  });

  test("returns an empty body for no-content responses", async () => {
    const app = createTestApp();
    const requestData = createDeleteTodoRequest();

    const response = await app.fetch(
      buildFetchRequest(
        `${BASE_URL}/todos/${requestData.param.todoId}`,
        requestData
      )
    );

    expect(response.status).toBe(204);
    await expectNoBody(response);
  });
});

describe("Generated Server typed error handling", () => {
  test("returns typed HTTP response errors through the default handler", async () => {
    const app = createTestApp({
      validateResponses: false,
      throwTodoError: {
        type: "TodoNotFoundError" as const,
        statusCode: 404,
        header: {},
        body: { errorCode: "TODO_NOT_FOUND" },
      } satisfies ITypedHttpResponse,
    });
    const requestData = createCreateTodoRequest();

    const response = await app.fetch(
      buildFetchRequest(`${BASE_URL}/todos`, requestData)
    );

    const data = await expectJson(response, 404);
    expect(data["errorCode"]).toBe("TODO_NOT_FOUND");
  });

  test("uses a custom HTTP response error handler when provided", async () => {
    const app = createTestApp({
      validateResponses: false,
      throwTodoError: {
        type: "TodoNotFoundError" as const,
        statusCode: 404,
        header: {},
        body: { errorCode: "TODO_NOT_FOUND" },
      } satisfies ITypedHttpResponse,
      handleHttpResponseErrors: () => ({
        statusCode: 404,
        body: { customMessage: "Custom error handling" },
      }),
    });
    const requestData = createCreateTodoRequest();

    const response = await app.fetch(
      buildFetchRequest(`${BASE_URL}/todos`, requestData)
    );

    const data = await expectJson(response, 404);
    expect(data["customMessage"]).toBe("Custom error handling");
  });

  test("fails closed with a sanitized 500 for invalid generated responses", async () => {
    const app = createTestApp({
      validateResponses: true,
      throwTodoError: {
        type: "CreateTodoSuccess" as const,
        statusCode: 201,
        header: { "Content-Type": "application/json" },
        body: { id: 42, title: true },
      } satisfies ITypedHttpResponse,
    });
    const requestData = createCreateTodoRequest();

    const response = await app.fetch(
      buildFetchRequest(`${BASE_URL}/todos`, requestData)
    );

    const data = await expectErrorResponse(
      response,
      500,
      "INTERNAL_SERVER_ERROR"
    );
    expect(JSON.stringify(data)).not.toContain("CreateTodoSuccess");
  });
});

describe("Generated Server unknown and handler errors", () => {
  test("returns the default 500 response for unknown errors", async () => {
    const app = createTestApp({
      throwTodoError: new TestApplicationError("Something went wrong"),
    });
    const requestData = createCreateTodoRequest();

    const response = await app.fetch(
      buildFetchRequest(`${BASE_URL}/todos`, requestData)
    );

    await expectErrorResponse(response, 500, "INTERNAL_SERVER_ERROR");
  });

  test("uses a custom unknown error handler when provided", async () => {
    const app = createTestApp({
      throwTodoError: new TestApplicationError("Something went wrong"),
      handleUnknownErrors: () => ({
        statusCode: 500,
        body: { customUnknownError: "Custom unknown error handling" },
      }),
    });
    const requestData = createCreateTodoRequest();

    const response = await app.fetch(
      buildFetchRequest(`${BASE_URL}/todos`, requestData)
    );

    const data = await expectJson(response, 500);
    expect(data["customUnknownError"]).toBe("Custom unknown error handling");
  });

  test("returns the default 500 response when the request validation error handler throws", async () => {
    const app = createTestApp({
      handleRequestValidationErrors: () => {
        throw new TestApplicationError("Validation handler failed");
      },
    });
    const requestData = createCreateTodoRequest({
      body: { priority: "INVALID_PRIORITY" as never },
    });

    const response = await app.fetch(
      buildFetchRequest(`${BASE_URL}/todos`, requestData)
    );

    await expectErrorResponse(response, 500, "INTERNAL_SERVER_ERROR");
  });

  test("returns the default 500 response when the HTTP response error handler throws", async () => {
    const app = createTestApp({
      validateResponses: false,
      throwTodoError: {
        type: "TodoNotFoundError" as const,
        statusCode: 404,
        header: {},
        body: { code: "TODO_NOT_FOUND", message: "Todo not found" },
      } satisfies ITypedHttpResponse,
      handleHttpResponseErrors: () => {
        throw new TestApplicationError("HTTP handler failed");
      },
    });
    const requestData = createCreateTodoRequest();

    const response = await app.fetch(
      buildFetchRequest(`${BASE_URL}/todos`, requestData)
    );

    await expectErrorResponse(response, 500, "INTERNAL_SERVER_ERROR");
  });
});

describe("Generated Server middleware", () => {
  test("passes middleware state in registration order", async () => {
    const order: string[] = [];
    let capturedTrace: readonly string[] | undefined;
    const app = createTestApp()
      .use(
        defineMiddleware<{ trace: readonly string[] }>(async (_ctx, next) => {
          order.push("first");
          return next({ trace: ["first"] });
        })
      )
      .use(
        defineMiddleware<{}, { trace: readonly string[] }>(
          async (ctx, next) => {
            order.push("second");
            capturedTrace = ctx.state.get("trace");
            return next();
          }
        )
      );
    const requestData = createCreateTodoRequest();

    await app.fetch(buildFetchRequest(`${BASE_URL}/todos`, requestData));

    expect(order).toEqual(["first", "second"]);
    expect(capturedTrace).toEqual(["first"]);
  });

  test("runs middleware before returning 404 responses", async () => {
    const app = createTestApp();
    let middlewareExecuted = false;
    app.use(
      defineMiddleware(async (_ctx, next) => {
        middlewareExecuted = true;
        return next();
      })
    );

    await app.fetch(new Request(`${BASE_URL}/unknown-path`, { method: "GET" }));

    expect(middlewareExecuted).toBe(true);
  });

  test("returns middleware short-circuit responses before generated handlers", async () => {
    const app = createTestApp();
    app.use(
      defineMiddleware(async (_ctx, _next) => ({
        statusCode: 418,
        body: { message: "I'm a teapot" },
      }))
    );
    const requestData = createCreateTodoRequest();

    const response = await app.fetch(
      buildFetchRequest(`${BASE_URL}/todos`, requestData)
    );

    const data = await expectJson(response, 418);
    expect(data["message"]).toBe("I'm a teapot");
  });

  test("returns middleware short-circuit responses before request validation", async () => {
    const app = createTestApp();
    app.use(
      defineMiddleware(async (_ctx, _next) => ({
        statusCode: 418,
        body: { message: "I'm still a teapot" },
      }))
    );
    const requestData = createCreateTodoRequest({
      body: { priority: "INVALID_PRIORITY" as never },
    });

    const response = await app.fetch(
      buildFetchRequest(`${BASE_URL}/todos`, requestData)
    );

    const data = await expectJson(response, 418);
    expect(data["message"]).toBe("I'm still a teapot");
    expect(data["code"]).toBeUndefined();
  });
});
