import type { IValidatedHttpRequest } from "@rexeus/typeweaver-core";
import {
  RequestValidationError,
  validationDefaultError,
} from "@rexeus/typeweaver-core";
import {
  createCreateTodoRequest,
  createCreateTodoSuccessResponse,
  createDeleteSubTodoRequest,
  createDeleteSubTodoSuccessResponse,
  createListSubTodosRequest,
  createListSubTodosSuccessResponse,
  createListTodosRequest,
  createQuerySubTodoRequest,
  createQuerySubTodoSuccessResponse,
  createTestHono,
  createUpdateSubTodoRequest,
  createUpdateTodoRequest,
  TestAssertionError,
  TodoHono,
} from "test-utils";
import { describe, expect, test } from "vitest";
import { prepareRequestData } from "../../helpers.js";
import type {
  HonoTodoApiHandler,
  IValidationErrorResponseBody,
} from "test-utils";

type CreateTestHonoOptions = Parameters<typeof createTestHono>[0];

type CreateTodoHonoOptions = Omit<
  ConstructorParameters<typeof TodoHono<true>>[0],
  "requestHandlers"
>;

type UnvalidatedTodoHonoOptions = Omit<
  ConstructorParameters<typeof TodoHono<false>>[0],
  "requestHandlers" | "validateRequests" | "validateResponses"
>;

const readContextString = (
  context: { get: (key: string) => unknown },
  key: string
): string | undefined => {
  const value = context.get(key);
  return typeof value === "string" ? value : undefined;
};

async function requestTestHono(
  url: string,
  requestData: IValidatedHttpRequest,
  options?: CreateTestHonoOptions
): Promise<Response> {
  return await createTestHono(options).request(
    url,
    prepareRequestData(requestData)
  );
}

function createRequestHandlersProxy<TValidateRequests extends boolean>(
  handlers: Partial<HonoTodoApiHandler<TValidateRequests>>
): HonoTodoApiHandler<TValidateRequests> {
  return new Proxy(handlers as HonoTodoApiHandler<TValidateRequests>, {
    get: (target, prop) => {
      if (prop in target)
        return target[prop as keyof HonoTodoApiHandler<TValidateRequests>];
      return async () => {
        throw new TestAssertionError(
          `Missing Hono test handler: ${String(prop)}`
        );
      };
    },
  });
}

function createTodoHonoWithHandlers(
  handlers: Partial<HonoTodoApiHandler<true>>,
  options: CreateTodoHonoOptions = {}
): TodoHono<true> {
  return new TodoHono<true>({
    ...options,
    requestHandlers: createRequestHandlersProxy<true>(handlers),
    validateResponses: options.validateResponses ?? false,
  });
}

function createUnvalidatedTodoHonoWithHandlers(
  handlers: Partial<HonoTodoApiHandler<false>>,
  options: UnvalidatedTodoHonoOptions = {}
): TodoHono<false> {
  return new TodoHono<false>({
    ...options,
    validateRequests: false,
    validateResponses: false,
    requestHandlers: createRequestHandlersProxy<false>(handlers),
  });
}

describe("Generated Hono nested route dispatch", () => {
  test("dispatches GET /todos/:todoId/subtodos with the parent todo id", async () => {
    let capturedTodoId: string | undefined;
    const requestData = createListSubTodosRequest();
    const app = createUnvalidatedTodoHonoWithHandlers({
      handleListSubTodosRequest: async request => {
        capturedTodoId = request.param.todoId;
        return createListSubTodosSuccessResponse({ body: { results: [] } });
      },
    });

    const response = await app.request(
      `http://localhost/todos/${requestData.param.todoId}/subtodos`,
      prepareRequestData(requestData)
    );

    expect(response.status).toBe(200);
    expect(capturedTodoId).toBe(requestData.param.todoId);
    const data = (await response.json()) as Record<string, unknown>;
    expect(data["results"]).toEqual([]);
  });

  test("nested subtodo update routes propagate parent and subtodo ids", async () => {
    const requestData = createUpdateSubTodoRequest({
      body: {
        title: "update nested item",
        priority: "LOW",
      },
    });

    const response = await requestTestHono(
      `http://localhost/todos/${requestData.param.todoId}/subtodos/${requestData.param.subtodoId}`,
      requestData
    );

    expect(response.status).toBe(200);
    const data = (await response.json()) as Record<string, unknown>;
    expect(data["parentId"]).toBe(requestData.param.todoId);
    expect(data["id"]).toBe(requestData.param.subtodoId);
    expect(data["title"]).toBe("update nested item");
    expect(data["priority"]).toBe("LOW");
  });

  test("nested static subtodo query route hits the query operation", async () => {
    let capturedOperationId: string | undefined;
    let capturedTodoId: string | undefined;
    const requestData = createQuerySubTodoRequest();
    const app = createUnvalidatedTodoHonoWithHandlers({
      handleQuerySubTodoRequest: async (request, context) => {
        capturedOperationId = readContextString(context, "operationId");
        capturedTodoId = request.param.todoId;
        return createQuerySubTodoSuccessResponse({ body: { results: [] } });
      },
    });

    const response = await app.request(
      `http://localhost/todos/${requestData.param.todoId}/subtodos/query`,
      prepareRequestData(requestData)
    );

    expect(response.status).toBe(200);
    expect(capturedOperationId).toBe("QuerySubTodo");
    expect(capturedTodoId).toBe(requestData.param.todoId);
  });
});

describe("Generated Hono route fallthrough", () => {
  test("dispatches DELETE /todos/:todoId/subtodos/:subtodoId with parent and subtodo ids", async () => {
    let capturedTodoId: string | undefined;
    let capturedSubtodoId: string | undefined;
    const requestData = createDeleteSubTodoRequest();
    const app = createUnvalidatedTodoHonoWithHandlers({
      handleDeleteSubTodoRequest: async request => {
        capturedTodoId = request.param.todoId;
        capturedSubtodoId = request.param.subtodoId;
        return createDeleteSubTodoSuccessResponse({
          body: { message: "deleted subtodo" },
        });
      },
    });

    const response = await app.request(
      `http://localhost/todos/${requestData.param.todoId}/subtodos/${requestData.param.subtodoId}`,
      prepareRequestData(requestData)
    );

    expect(response.status).toBe(200);
    const data = (await response.json()) as Record<string, unknown>;
    expect(data["message"]).toBe("deleted subtodo");
    expect(capturedTodoId).toBe(requestData.param.todoId);
    expect(capturedSubtodoId).toBe(requestData.param.subtodoId);
  });

  test("unknown paths use Hono's public 404 behavior", async () => {
    const response = await createTestHono().request(
      "http://localhost/not-a-generated-route",
      { method: "GET" }
    );

    expect(response.status).toBe(404);
    expect(await response.text()).toBe("404 Not Found");
  });

  test("returns 404 without Allow for unsupported methods on known paths", async () => {
    const response = await createTestHono().request("http://localhost/todos", {
      method: "PUT",
    });

    expect(response.status).toBe(404);
    expect(response.headers.get("Allow")).toBeNull();
  });
});

describe("Generated Hono request validation", () => {
  test("rejects invalid request body", async () => {
    const requestData = createCreateTodoRequest({
      body: {
        priority: "INVALID_PRIORITY" as never,
      },
    });

    const response = await requestTestHono(
      "http://localhost/todos",
      requestData
    );

    expect(response.status).toBe(400);
    const data = (await response.json()) as IValidationErrorResponseBody;
    expect(data.code).toBe(validationDefaultError.code);
    expect(data.message).toBe(validationDefaultError.message);
    expect(data.issues.body).toHaveLength(1);
  });

  test("rejects invalid request headers", async () => {
    const requestData = createCreateTodoRequest({
      header: {
        "Content-Type": "text/plain" as never,
      },
    });

    const response = await requestTestHono(
      "http://localhost/todos",
      requestData
    );

    expect(response.status).toBe(400);
    const data = (await response.json()) as IValidationErrorResponseBody;
    expect(data.issues.header).toHaveLength(1);
  });

  test("rejects invalid path parameters", async () => {
    const requestData = createUpdateTodoRequest();

    const response = await createTestHono().request(
      "http://localhost/todos/invalid-uuid-format",
      prepareRequestData(requestData)
    );

    expect(response.status).toBe(400);
    const data = (await response.json()) as IValidationErrorResponseBody;
    expect(data.issues.param).toHaveLength(1);
  });

  test("rejects invalid query parameters", async () => {
    const requestData = createListTodosRequest();

    const response = await createTestHono().request(
      "http://localhost/todos?status=INVALID_STATUS",
      prepareRequestData(requestData)
    );

    expect(response.status).toBe(400);
    const data = (await response.json()) as IValidationErrorResponseBody;
    expect(data.issues.query).toHaveLength(1);
  });

  test("bypasses validation when validateRequests is disabled", async () => {
    const requestData = createCreateTodoRequest({
      body: {
        title: "",
      },
    });

    const response = await createTestHono({
      validateRequests: false,
    }).request("http://localhost/todos", prepareRequestData(requestData));

    expect(response.status).toBe(201);
    expect(await response.json()).toBeDefined();
  });
});

describe("Generated Hono request validation handlers", () => {
  test("passes request validation errors and Hono context to custom handlers", async () => {
    let capturedError: unknown;
    let capturedOperationId: string | undefined;
    const app = createTestHono({
      handleRequestValidationErrors: (error, context) => {
        capturedError = error;
        capturedOperationId = readContextString(context, "operationId");
        return {
          statusCode: 422,
          header: {
            "Content-Type": "application/json",
          },
          body: {
            code: "CUSTOM_REQUEST_VALIDATION",
            bodyIssueCount: error.bodyIssues.length,
          },
        };
      },
    });
    const requestData = createCreateTodoRequest({
      body: {
        priority: "INVALID_PRIORITY" as never,
      },
    });

    const response = await app.request(
      "http://localhost/todos",
      prepareRequestData(requestData)
    );

    expect(response.status).toBe(422);
    const errorData = (await response.json()) as Record<string, unknown>;
    expect(errorData["code"]).toBe("CUSTOM_REQUEST_VALIDATION");
    expect(errorData["bodyIssueCount"]).toBe(1);
    expect(capturedError).toBeInstanceOf(RequestValidationError);
    expect((capturedError as RequestValidationError).bodyIssues).toHaveLength(
      1
    );
    expect(capturedOperationId).toBe("CreateTodo");
  });

  test("does not invoke route handlers for schema-invalid requests", async () => {
    let handlerInvoked = false;
    const app = createTodoHonoWithHandlers({
      handleCreateTodoRequest: async () => {
        handlerInvoked = true;
        return createCreateTodoSuccessResponse();
      },
    });
    const requestData = createCreateTodoRequest({
      body: {
        priority: "INVALID_PRIORITY" as never,
      },
    });

    const response = await app.request(
      "http://localhost/todos",
      prepareRequestData(requestData)
    );

    expect(response.status).toBe(400);
    const data = (await response.json()) as IValidationErrorResponseBody;
    expect(data.issues.body).toHaveLength(1);
    expect(handlerInvoked).toBe(false);
  });
});
