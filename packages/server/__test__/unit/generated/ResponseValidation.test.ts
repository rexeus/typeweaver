import assert from "node:assert";
import {
  internalServerErrorDefaultError,
  HttpStatusCode,
  ResponseValidationError,
} from "@rexeus/typeweaver-core";
import type { ITypedHttpResponse } from "@rexeus/typeweaver-core";
import {
  createCreateTodoRequest,
  createCreateTodoSuccessResponse,
  createCreateTodoSuccessResponseBody,
  createTestApp,
  TestAssertionError,
  TodoRouter,
  TypeweaverApp,
} from "test-utils";
import { describe, expect, test, vi } from "vitest";
import {
  BASE_URL,
  buildCreateTodoSuccess,
  buildFetchRequest,
  expectErrorResponse,
  expectJson,
} from "../../helpers.js";
import type { CreateTodoResponse, ServerTodoApiHandler } from "test-utils";

const unhandledServerTodoRequest = async (): Promise<never> => {
  throw new TestAssertionError("Unexpected test route invocation");
};

const createServerTodoHandlersReturning = (
  response: CreateTodoResponse
): ServerTodoApiHandler<Record<string, unknown>, false> => ({
  handleListTodosRequest: unhandledServerTodoRequest,
  handleCreateTodoRequest: async () => response,
  handleQueryTodoRequest: unhandledServerTodoRequest,
  handleGetTodoRequest: unhandledServerTodoRequest,
  handlePutTodoRequest: unhandledServerTodoRequest,
  handleUpdateTodoRequest: unhandledServerTodoRequest,
  handleDeleteTodoRequest: unhandledServerTodoRequest,
  handleOptionsTodoRequest: unhandledServerTodoRequest,
  handleUpdateTodoStatusRequest: unhandledServerTodoRequest,
  handleListSubTodosRequest: unhandledServerTodoRequest,
  handleCreateSubTodoRequest: unhandledServerTodoRequest,
  handleQuerySubTodoRequest: unhandledServerTodoRequest,
  handleUpdateSubTodoRequest: unhandledServerTodoRequest,
  handleDeleteSubTodoRequest: unhandledServerTodoRequest,
});

const createTodoAppReturning = (
  response: CreateTodoResponse
): TypeweaverApp => {
  const app = new TypeweaverApp();
  app.route(
    new TodoRouter<Record<string, unknown>, false>({
      requestHandlers: createServerTodoHandlersReturning(response),
      validateRequests: false,
      validateResponses: true,
    })
  );
  return app;
};

describe("Response Validation field stripping", () => {
  test("should strip extra body fields from a valid response", async () => {
    const responseWithExtra = buildCreateTodoSuccess({
      extraField: "should-be-stripped",
      anotherExtra: 42,
    });
    const app = createTestApp({
      validateResponses: true,
      throwTodoError: responseWithExtra,
    });
    const requestData = createCreateTodoRequest();

    const response = await app.fetch(
      buildFetchRequest(`${BASE_URL}/todos`, requestData)
    );

    const data = await expectJson(response, 201);
    expect(data).not.toHaveProperty("extraField");
    expect(data).not.toHaveProperty("anotherExtra");
    expect(data["id"]).toBeDefined();
    expect(data["title"]).toBeDefined();
  });

  test("should preserve all schema-defined fields after stripping", async () => {
    const body = createCreateTodoSuccessResponseBody();
    const responseWithExtra = buildCreateTodoSuccess({
      ...body,
      extraField: "noise",
    });
    const app = createTestApp({
      validateResponses: true,
      throwTodoError: responseWithExtra,
    });
    const requestData = createCreateTodoRequest();

    const response = await app.fetch(
      buildFetchRequest(`${BASE_URL}/todos`, requestData)
    );

    const data = await expectJson(response, 201);
    expect(data["id"]).toBe(body.id);
    expect(data["accountId"]).toBe(body.accountId);
    expect(data["title"]).toBe(body.title);
    expect(data["status"]).toBe(body.status);
    expect(data["createdAt"]).toBe(body.createdAt);
    expect(data["modifiedAt"]).toBe(body.modifiedAt);
    expect(data["createdBy"]).toBe(body.createdBy);
    expect(data["modifiedBy"]).toBe(body.modifiedBy);
  });
});

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
      statusCode: 299 as HttpStatusCode,
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

describe("Response Validation disabled", () => {
  test("should pass through extra body fields when validation is disabled", async () => {
    const responseWithExtra = buildCreateTodoSuccess({
      extraField: "should-remain",
      secretData: { nested: true },
    });
    const app = createTestApp({
      validateResponses: false,
      throwTodoError: responseWithExtra,
    });
    const requestData = createCreateTodoRequest();

    const response = await app.fetch(
      buildFetchRequest(`${BASE_URL}/todos`, requestData)
    );

    const data = await expectJson(response, 201);
    expect(data["extraField"]).toBe("should-remain");
    expect(data["secretData"]).toEqual({ nested: true });
  });

  test("should pass through invalid response types when validation is disabled", async () => {
    const invalidResponse: ITypedHttpResponse = {
      type: "CreateTodoSuccess" as const,
      statusCode: 201,
      header: { "Content-Type": "application/json" },
      body: { id: 12345, title: true },
    };
    const app = createTestApp({
      validateResponses: false,
      throwTodoError: invalidResponse,
    });
    const requestData = createCreateTodoRequest();

    const response = await app.fetch(
      buildFetchRequest(`${BASE_URL}/todos`, requestData)
    );

    const data = await expectJson(response, 201);
    expect(data["id"]).toBe(12345);
    expect(data["title"]).toBe(true);
  });

  test("should omit undefined header values from thrown typed responses when validation is disabled", async () => {
    const thrownResponse: ITypedHttpResponse = {
      ...buildCreateTodoSuccess(),
      header: { "X-Single-Value": undefined },
    };
    const app = createTestApp({
      validateResponses: false,
      throwTodoError: thrownResponse,
    });
    const requestData = createCreateTodoRequest();

    const response = await app.fetch(
      buildFetchRequest(`${BASE_URL}/todos`, requestData)
    );

    const data = await expectJson(response, 201);
    expect(data).toEqual(thrownResponse.body);
    expect(response.headers.get("x-single-value")).toBeNull();
  });
});

describe("Response Validation returned typed responses", () => {
  test("should omit undefined header values from returned typed responses", async () => {
    const returnedResponse = createCreateTodoSuccessResponse({
      header: {
        "X-Single-Value": "defined",
        "X-Multi-Value": undefined,
      },
    });
    const app = createTodoAppReturning(returnedResponse);
    const requestData = createCreateTodoRequest();

    const response = await app.fetch(
      buildFetchRequest(`${BASE_URL}/todos`, requestData)
    );

    const data = await expectJson(response, 201);
    expect(data).toEqual(returnedResponse.body);
    expect(response.headers.get("x-single-value")).toBe("defined");
    expect(response.headers.get("x-multi-value")).toBeNull();
    expect(response.headers.get("x-multi-value")).not.toBe("undefined");
  });
});
