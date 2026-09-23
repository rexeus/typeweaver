import type { ITypedHttpResponse } from "@rexeus/typeweaver-core";
import {
  createCreateTodoRequest,
  createTestHono,
  TestApplicationError,
} from "test-utils";
import { describe, expect, test } from "vitest";
import {
  expectErrorResponse,
  prepareRequestData,
  readJsonRecord,
  withBodyFields,
} from "../../../helpers.js";
import { readContextString } from "./fixtures.js";

describe("Generated Hono typed error handling", () => {
  test("serializes thrown typed HTTP responses with the default HTTP response error handler", async () => {
    const errorResponse = {
      type: "TodoNotFoundError" as const,
      statusCode: 404,
      header: {},
      body: {
        errorCode: "TODO_NOT_FOUND",
      },
    };
    const app = createTestHono({
      validateResponses: false,
      throwTodoError: errorResponse,
    });
    const requestData = createCreateTodoRequest();

    const response = await app.request(
      "http://localhost/todos",
      prepareRequestData(requestData)
    );

    expect(response.status).toBe(404);
    const data = await readJsonRecord(response);
    expect(data["errorCode"]).toBe("TODO_NOT_FOUND");
  });

  test("passes typed HTTP response errors and Hono context to custom handlers", async () => {
    const errorResponse = {
      type: "TodoNotFoundError" as const,
      statusCode: 404,
      header: {},
      body: {
        errorCode: "TODO_NOT_FOUND",
      },
    };
    let capturedError: ITypedHttpResponse | undefined;
    let capturedOperationId: string | undefined;
    const app = createTestHono({
      validateResponses: false,
      throwTodoError: errorResponse,
      handleHttpResponseErrors: (error, context) => {
        capturedError = error;
        capturedOperationId = readContextString(context, "operationId");
        return {
          statusCode: 409,
          header: { "Content-Type": "application/json" },
          body: {
            code: "CUSTOM_HTTP_RESPONSE_ERROR",
          },
        };
      },
    });
    const requestData = createCreateTodoRequest();

    const response = await app.request(
      "http://localhost/todos",
      prepareRequestData(requestData)
    );

    expect(response.status).toBe(409);
    const data = await readJsonRecord(response);
    expect(data["code"]).toBe("CUSTOM_HTTP_RESPONSE_ERROR");
    expect(capturedError).toBe(errorResponse);
    expect(capturedOperationId).toBe("CreateTodo");
  });

  test("returns sanitized 500 for unknown handler errors by default", async () => {
    const app = createTestHono({
      throwTodoError: new TestApplicationError("Something went wrong"),
    });
    const requestData = createCreateTodoRequest();

    const response = await app.request(
      "http://localhost/todos",
      prepareRequestData(requestData)
    );

    await expectErrorResponse(response, 500, "INTERNAL_SERVER_ERROR");
  });

  test("delegates thrown plain errors to Hono fallback behavior when unknown error handling is disabled", async () => {
    const app = createTestHono({
      throwTodoError: new TestApplicationError("boom"),
      handleUnknownErrors: false,
    });
    const requestData = createCreateTodoRequest();

    const response = await app.request(
      "http://localhost/todos",
      prepareRequestData(requestData)
    );

    expect(response.status).toBe(500);
    expect(await response.text()).toBe("Internal Server Error");
  });
});

describe("Generated Hono unknown error handling", () => {
  test("passes unknown handler errors and Hono context to custom handlers", async () => {
    const unknownError = new TestApplicationError("Something went wrong");
    let capturedError: unknown;
    let capturedOperationId: string | undefined;
    const app = createTestHono({
      throwTodoError: unknownError,
      handleUnknownErrors: (error, context) => {
        capturedError = error;
        capturedOperationId = readContextString(context, "operationId");
        return {
          statusCode: 500,
          header: { "Content-Type": "application/json" },
          body: {
            code: "CUSTOM_UNKNOWN_ERROR",
          },
        };
      },
    });
    const requestData = createCreateTodoRequest();

    const response = await app.request(
      "http://localhost/todos",
      prepareRequestData(requestData)
    );

    expect(response.status).toBe(500);
    const data = await readJsonRecord(response);
    expect(data["code"]).toBe("CUSTOM_UNKNOWN_ERROR");
    expect(capturedError).toBe(unknownError);
    expect(capturedOperationId).toBe("CreateTodo");
  });

  test("delegates thrown custom unknown error handlers to Hono fallback behavior", async () => {
    const app = createTestHono({
      throwTodoError: new TestApplicationError("boom"),
      handleUnknownErrors: () => {
        throw new TestApplicationError("unknown handler failed");
      },
    });
    const requestData = createCreateTodoRequest();

    const response = await app.request(
      "http://localhost/todos",
      prepareRequestData(requestData)
    );

    expect(response.status).toBe(500);
    expect(await response.text()).toBe("Internal Server Error");
  });

  test("returns sanitized 500 when the request validation error handler throws", async () => {
    const app = createTestHono({
      handleRequestValidationErrors: () => {
        throw new TestApplicationError("Validation handler failed");
      },
    });
    const requestData = withBodyFields(createCreateTodoRequest(), {
      priority: "INVALID_PRIORITY",
    });

    const response = await app.request(
      "http://localhost/todos",
      prepareRequestData(requestData)
    );

    await expectErrorResponse(response, 500, "INTERNAL_SERVER_ERROR");
  });

  test("returns sanitized 500 when the request validation error handler rejects", async () => {
    const app = createTestHono({
      handleRequestValidationErrors: async () => {
        throw new TestApplicationError("Validation handler rejected");
      },
    });
    const requestData = withBodyFields(createCreateTodoRequest(), {
      priority: "INVALID_PRIORITY",
    });

    const response = await app.request(
      "http://localhost/todos",
      prepareRequestData(requestData)
    );

    await expectErrorResponse(response, 500, "INTERNAL_SERVER_ERROR");
  });
});

describe("Generated Hono error handler fallthrough", () => {
  test("falls through to the unknown error handler when request validation error handling is disabled", async () => {
    const app = createTestHono({
      handleRequestValidationErrors: false,
    });
    const requestData = withBodyFields(createCreateTodoRequest(), {
      priority: "INVALID_PRIORITY",
    });

    const response = await app.request(
      "http://localhost/todos",
      prepareRequestData(requestData)
    );

    await expectErrorResponse(response, 500, "INTERNAL_SERVER_ERROR");
  });

  test("falls through to the unknown error handler when HTTP response error handling is disabled", async () => {
    const originalError = {
      type: "TodoNotFoundError" as const,
      statusCode: 404,
      header: {},
      body: { code: "TODO_NOT_FOUND", message: "Todo not found" },
    };
    const app = createTestHono({
      validateResponses: false,
      throwTodoError: originalError,
      handleHttpResponseErrors: false,
    });
    const requestData = createCreateTodoRequest();

    const response = await app.request(
      "http://localhost/todos",
      prepareRequestData(requestData)
    );

    await expectErrorResponse(response, 500, "INTERNAL_SERVER_ERROR");
  });

  test("returns sanitized 500 when the HTTP response error handler throws", async () => {
    const originalError = {
      type: "TodoNotFoundError" as const,
      statusCode: 404,
      header: {},
      body: { code: "TODO_NOT_FOUND", message: "Todo not found" },
    };
    const app = createTestHono({
      validateResponses: false,
      throwTodoError: originalError,
      handleHttpResponseErrors: () => {
        throw new TestApplicationError("HTTP handler failed");
      },
    });
    const requestData = createCreateTodoRequest();

    const response = await app.request(
      "http://localhost/todos",
      prepareRequestData(requestData)
    );

    await expectErrorResponse(response, 500, "INTERNAL_SERVER_ERROR");
  });
});
