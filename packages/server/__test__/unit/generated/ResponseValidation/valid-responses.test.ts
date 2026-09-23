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
import { describe, expect, test } from "vitest";
import {
  BASE_URL,
  buildCreateTodoSuccess,
  buildFetchRequest,
  expectErrorResponse,
  expectJson,
} from "../../../helpers.js";
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
