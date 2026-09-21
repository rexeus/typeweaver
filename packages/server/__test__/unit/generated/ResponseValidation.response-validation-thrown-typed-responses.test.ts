import { internalServerErrorDefaultError } from "@rexeus/typeweaver-core";
import type { ITypedHttpResponse } from "@rexeus/typeweaver-core";
import {
  createCreateTodoRequest,
  createTestApp,
  TestApplicationError,
} from "test-utils";
import { describe, expect, test } from "vitest";
import {
  BASE_URL,
  buildCreateTodoSuccess,
  buildFetchRequest,
  expectErrorResponse,
  expectJson,
} from "../../helpers.js";

describe("Response Validation thrown typed responses", () => {
  test("should strip extra fields from thrown typed responses", async () => {
    const thrownResponse = buildCreateTodoSuccess({
      extraField: "thrown-extra",
    });
    const app = createTestApp({
      validateResponses: true,
      throwTodoError: thrownResponse,
    });
    const requestData = createCreateTodoRequest();

    const response = await app.fetch(
      buildFetchRequest(`${BASE_URL}/todos`, requestData)
    );

    const data = await expectJson(response, 201);
    expect(data).not.toHaveProperty("extraField");
    expect(data["id"]).toBeDefined();
  });

  test("should omit undefined header values from thrown typed responses", async () => {
    const thrownResponse: ITypedHttpResponse = {
      ...buildCreateTodoSuccess(),
      header: {
        "Content-Type": "application/json",
        "X-Single-Value": undefined,
      },
    };
    const app = createTestApp({
      validateResponses: true,
      throwTodoError: thrownResponse,
    });
    const requestData = createCreateTodoRequest();

    const response = await app.fetch(
      buildFetchRequest(`${BASE_URL}/todos`, requestData)
    );

    expect(response.status).toBe(201);
    expect(response.headers.get("x-single-value")).toBeNull();
  });

  test("should return 500 for thrown typed response with invalid body", async () => {
    const thrownInvalid: ITypedHttpResponse = {
      type: "CreateTodoSuccess" as const,
      statusCode: 201,
      header: { "Content-Type": "application/json" },
      body: { wrongField: "completely wrong structure" },
    };
    const app = createTestApp({
      validateResponses: true,
      throwTodoError: thrownInvalid,
    });
    const requestData = createCreateTodoRequest();

    const response = await app.fetch(
      buildFetchRequest(`${BASE_URL}/todos`, requestData)
    );

    await expectErrorResponse(response, 500, "INTERNAL_SERVER_ERROR");
  });
});

describe("Response Validation pass-through mode", () => {
  test("should return the invalid response as-is when handleResponseValidationErrors is false", async () => {
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
      handleResponseValidationErrors: false,
      throwTodoError: invalidResponse,
    });
    const requestData = createCreateTodoRequest();

    const response = await app.fetch(
      buildFetchRequest(`${BASE_URL}/todos`, requestData)
    );

    const data = await expectJson(response, 201);
    expect(data).toEqual({ id: 12345, title: true });
  });

  test("should still strip extra fields from valid responses when handleResponseValidationErrors is false", async () => {
    const app = createTestApp({
      validateResponses: true,
      handleResponseValidationErrors: false,
      throwTodoError: buildCreateTodoSuccess({ extraField: "should-strip" }),
    });
    const requestData = createCreateTodoRequest();

    const response = await app.fetch(
      buildFetchRequest(`${BASE_URL}/todos`, requestData)
    );

    const data = await expectJson(response, 201);
    expect(data).not.toHaveProperty("extraField");
    expect(data["id"]).toBeDefined();
    expect(data["title"]).toBeDefined();
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

describe("Response Validation body edge cases", () => {
  test("should handle response with undefined body", async () => {
    const app = createTestApp({
      validateResponses: true,
      throwTodoError: {
        type: "CreateTodoSuccess" as const,
        statusCode: 201,
        header: { "Content-Type": "application/json" },
        body: undefined,
      } satisfies ITypedHttpResponse,
    });
    const requestData = createCreateTodoRequest();

    const response = await app.fetch(
      buildFetchRequest(`${BASE_URL}/todos`, requestData)
    );

    await expectErrorResponse(response, 500, "INTERNAL_SERVER_ERROR");
  });

  test("should handle response with null body", async () => {
    const app = createTestApp({
      validateResponses: true,
      throwTodoError: {
        type: "CreateTodoSuccess" as const,
        statusCode: 201,
        header: { "Content-Type": "application/json" },
        body: null,
      } satisfies ITypedHttpResponse,
    });
    const requestData = createCreateTodoRequest();

    const response = await app.fetch(
      buildFetchRequest(`${BASE_URL}/todos`, requestData)
    );

    await expectErrorResponse(response, 500, "INTERNAL_SERVER_ERROR");
  });

  test("should handle response with empty object body", async () => {
    const app = createTestApp({
      validateResponses: true,
      throwTodoError: {
        type: "CreateTodoSuccess" as const,
        statusCode: 201,
        header: { "Content-Type": "application/json" },
        body: {},
      } satisfies ITypedHttpResponse,
    });
    const requestData = createCreateTodoRequest();

    const response = await app.fetch(
      buildFetchRequest(`${BASE_URL}/todos`, requestData)
    );

    await expectErrorResponse(response, 500, "INTERNAL_SERVER_ERROR");
  });
});
