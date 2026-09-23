import type { IRawHttpRequest } from "@rexeus/typeweaver-core";
import { Hono } from "hono";
import {
  createCreateTodoRequest,
  createCreateTodoSuccessResponse,
  createGetTodoSuccessResponse,
  createListTodosSuccessResponse,
  createOptionsTodoSuccessResponse,
  createTestHono,
} from "test-utils";
import { describe, expect, test } from "vitest";
import { prepareRequestData } from "../../../helpers.js";
import {
  createUnvalidatedTodoHonoWithHandlers,
  readContextString,
} from "./fixtures.js";
import type { Context } from "hono";
import type { HonoTodoApiHandler } from "test-utils";

describe("Generated Hono operation metadata", () => {
  test.each([
    {
      scenario: "GET /todos",
      route: "http://localhost/todos",
      method: "GET",
      handlerName: "handleListTodosRequest",
      expectedOperationId: "ListTodos",
      expectedStatus: 200,
      responseFactory: createListTodosSuccessResponse,
    },
    {
      scenario: "POST /todos",
      route: "http://localhost/todos",
      method: "POST",
      handlerName: "handleCreateTodoRequest",
      expectedOperationId: "CreateTodo",
      expectedStatus: 201,
      responseFactory: createCreateTodoSuccessResponse,
    },
    {
      scenario: "GET /todos/:todoId",
      route: "http://localhost/todos/t1",
      method: "GET",
      handlerName: "handleGetTodoRequest",
      expectedOperationId: "GetTodo",
      expectedStatus: 200,
      responseFactory: createGetTodoSuccessResponse,
    },
    {
      scenario: "OPTIONS /todos/:todoId",
      route: "http://localhost/todos/t1",
      method: "OPTIONS",
      handlerName: "handleOptionsTodoRequest",
      expectedOperationId: "optionsTodo",
      expectedStatus: 200,
      responseFactory: createOptionsTodoSuccessResponse,
    },
  ] as const)(
    "sets $expectedOperationId operationId for $scenario",
    async ({
      route,
      method,
      handlerName,
      expectedOperationId,
      expectedStatus,
      responseFactory,
    }) => {
      let capturedOperationId: string | undefined;
      const app = createUnvalidatedTodoHonoWithHandlers({
        [handlerName]: async (_request: IRawHttpRequest, context: Context) => {
          capturedOperationId = readContextString(context, "operationId");
          return responseFactory();
        },
      } as Partial<HonoTodoApiHandler<false>>);

      const response = await app.request(route, { method });

      expect(response.status).toBe(expectedStatus);
      expect(capturedOperationId).toBe(expectedOperationId);
    }
  );
});

describe("Generated Hono middleware composition", () => {
  test("app middleware can short-circuit before generated validation", async () => {
    const requestData = createCreateTodoRequest({
      body: { priority: "INVALID_PRIORITY" as never },
    });
    const app = createTestHono({
      customResponses: {
        statusCode: 418,
        body: { code: "SHORT_CIRCUITED" },
      },
    });

    const response = await app.request(
      "http://localhost/todos",
      prepareRequestData(requestData)
    );

    expect(response.status).toBe(418);
    expect(await response.json()).toEqual({ code: "SHORT_CIRCUITED" });
  });

  test("upstream middleware state is visible to generated route handlers", async () => {
    let capturedTraceId: string | undefined;
    const root = new Hono<{ Variables: { traceId: string } }>();
    root.use("*", async (context, next) => {
      context.set("traceId", "trace-from-middleware");
      return next();
    });
    root.route(
      "/",
      createUnvalidatedTodoHonoWithHandlers({
        handleListTodosRequest: async (_request, context) => {
          capturedTraceId = readContextString(context, "traceId");
          return createListTodosSuccessResponse();
        },
      })
    );

    const response = await root.request("http://localhost/todos", {
      method: "GET",
    });

    expect(response.status).toBe(200);
    expect(capturedTraceId).toBe("trace-from-middleware");
  });
});
