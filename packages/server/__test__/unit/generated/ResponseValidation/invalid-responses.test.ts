import assert from "node:assert";
import {
  internalServerErrorDefaultError,
  ResponseValidationError,
} from "@rexeus/typeweaver-core";
import type { ITypedHttpResponse } from "@rexeus/typeweaver-core";
import {
  createCreateTodoRequest,
  createTestApp,
  TestApplicationError,
} from "test-utils";
import { describe, expect, test, vi } from "vitest";
import {
  BASE_URL,
  buildFetchRequest,
  expectErrorResponse,
  expectJson,
} from "../../../helpers.js";

// 299 is no HttpStatusCode member; TypeScript admits a `number` wherever the
// numeric enum is expected, so the out-of-contract status needs no assertion.
const UNRECOGNIZED_STATUS_CODE: number = 299;

describe("Response Validation invalid responses", () => {
  test("should return 500 when response body has wrong field types", async () => {
    const invalidResponse: ITypedHttpResponse = {
      type: "CreateTodoSuccess" as const,
      statusCode: 201,
      header: { "Content-Type": "application/json" },
      body: {
        id: 12345,
        title: true,
      },
    };
    const app = createTestApp({
      validateResponses: true,
      throwTodoError: invalidResponse,
    });
    const requestData = createCreateTodoRequest();

    const response = await app.fetch(
      buildFetchRequest(`${BASE_URL}/todos`, requestData)
    );

    const data = await expectErrorResponse(
      response,
      internalServerErrorDefaultError.statusCode,
      internalServerErrorDefaultError.code
    );
    expect(data["message"]).toBe(internalServerErrorDefaultError.message);
  });

  test("should return 500 when response has unrecognized status code", async () => {
    const unknownStatusResponse: ITypedHttpResponse = {
      type: "UnknownResponse" as const,
      statusCode: UNRECOGNIZED_STATUS_CODE,
      header: { "Content-Type": "application/json" },
      body: { message: "unexpected" },
    };
    const app = createTestApp({
      validateResponses: true,
      throwTodoError: unknownStatusResponse,
    });
    const requestData = createCreateTodoRequest();

    const response = await app.fetch(
      buildFetchRequest(`${BASE_URL}/todos`, requestData)
    );

    await expectErrorResponse(response, 500, "INTERNAL_SERVER_ERROR");
  });
});

describe("Response Validation custom handler", () => {
  test("should pass response validation details and context to custom handlers", async () => {
    const handler = vi.fn<import("test-utils").ResponseValidationErrorHandler>(
      () => ({
        statusCode: 502,
        body: { code: "CUSTOM_VALIDATION_FAILURE", detail: "body mismatch" },
      })
    );
    const invalidResponse: ITypedHttpResponse = {
      type: "CreateTodoSuccess" as const,
      statusCode: 201,
      header: { "Content-Type": "application/json" },
      body: { id: 12345 },
    };
    const app = createTestApp({
      validateResponses: true,
      handleResponseValidationErrors: handler,
      throwTodoError: invalidResponse,
    });
    const requestData = createCreateTodoRequest();

    const response = await app.fetch(
      buildFetchRequest(`${BASE_URL}/todos`, requestData)
    );

    const data = await expectJson(response, 502);
    expect(data["code"]).toBe("CUSTOM_VALIDATION_FAILURE");

    expect(handler).toHaveBeenCalledOnce();
    const args = handler.mock.calls[0];
    assert(args !== undefined);
    assert(args[0] instanceof ResponseValidationError);
    expect(args[2]).toBeDefined();
    expect(args[2].request).toBeDefined();
  });

  test("should pass a strict HTTP response to custom handlers", async () => {
    const handler = vi.fn<import("test-utils").ResponseValidationErrorHandler>(
      () => ({
        statusCode: 502,
        body: { code: "CUSTOM_VALIDATION_FAILURE" },
      })
    );
    const invalidResponse: ITypedHttpResponse = {
      type: "CreateTodoSuccess" as const,
      statusCode: 201,
      header: {
        "Content-Type": "application/json",
        "X-Single-Value": "defined",
        "X-Multi-Value": undefined,
      },
      body: { id: 12345 },
    };
    const app = createTestApp({
      validateResponses: true,
      handleResponseValidationErrors: handler,
      throwTodoError: invalidResponse,
    });
    const requestData = createCreateTodoRequest();

    await app.fetch(buildFetchRequest(`${BASE_URL}/todos`, requestData));

    const call = handler.mock.calls[0];
    assert(call !== undefined);
    const response = call[1];
    expect(response).not.toHaveProperty("type");
    expect(response.header).toEqual({
      "Content-Type": "application/json",
      "X-Single-Value": "defined",
    });
    expect(response.body).toEqual(invalidResponse.body);
  });

  test("should send the custom handler's response to the client", async () => {
    const app = createTestApp({
      validateResponses: true,
      handleResponseValidationErrors: () => ({
        statusCode: 503,
        header: { "X-Custom": "response-validation" },
        body: { reason: "schema mismatch" },
      }),
      throwTodoError: {
        type: "CreateTodoSuccess" as const,
        statusCode: 201,
        header: { "Content-Type": "application/json" },
        body: { id: 999 },
      } satisfies ITypedHttpResponse,
    });
    const requestData = createCreateTodoRequest();

    const response = await app.fetch(
      buildFetchRequest(`${BASE_URL}/todos`, requestData)
    );

    const data = await expectJson(response, 503);
    expect(data["reason"]).toBe("schema mismatch");
    expect(response.headers.get("X-Custom")).toBe("response-validation");
  });
});

describe("Response Validation custom handler recovery", () => {
  test("returns a sanitized 500 when custom handler throws", async () => {
    const invalidResponse: ITypedHttpResponse = {
      type: "CreateTodoSuccess" as const,
      statusCode: 201,
      header: { "Content-Type": "application/json" },
      body: { id: 12345, secret: "invalid response detail" },
    };
    const app = createTestApp({
      validateResponses: true,
      handleResponseValidationErrors: () => {
        throw new TestApplicationError("handler crashed");
      },
      throwTodoError: invalidResponse,
    });
    const requestData = createCreateTodoRequest();

    const response = await app.fetch(
      buildFetchRequest(`${BASE_URL}/todos`, requestData)
    );

    const data = await expectErrorResponse(
      response,
      internalServerErrorDefaultError.statusCode,
      internalServerErrorDefaultError.code
    );
    expect(JSON.stringify(data)).not.toContain("invalid response detail");
  });

  test("returns a sanitized 500 when async custom handler rejects", async () => {
    const invalidResponse: ITypedHttpResponse = {
      type: "CreateTodoSuccess" as const,
      statusCode: 201,
      header: { "Content-Type": "application/json" },
      body: { id: 12345, secret: "async invalid response detail" },
    };
    const app = createTestApp({
      validateResponses: true,
      handleResponseValidationErrors: async () => {
        throw new TestApplicationError("async crash");
      },
      throwTodoError: invalidResponse,
    });
    const requestData = createCreateTodoRequest();

    const response = await app.fetch(
      buildFetchRequest(`${BASE_URL}/todos`, requestData)
    );

    const data = await expectErrorResponse(
      response,
      internalServerErrorDefaultError.statusCode,
      internalServerErrorDefaultError.code
    );
    expect(JSON.stringify(data)).not.toContain("async invalid response detail");
  });
});

describe("Response Validation non-typed errors", () => {
  test("should route non-typed errors to error handler, not response validation", async () => {
    // Arrange
    const plainError = new TestApplicationError("handler crashed");
    const app = createTestApp({
      validateResponses: true,
      throwTodoError: plainError,
    });
    const requestData = createCreateTodoRequest();

    // Act
    const response = await app.fetch(
      buildFetchRequest(`${BASE_URL}/todos`, requestData)
    );

    // Assert
    await expectErrorResponse(response, 500, "INTERNAL_SERVER_ERROR");
  });
});
