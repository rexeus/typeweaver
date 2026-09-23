import {
  createCreateSubTodoRequest,
  createCreateTodoRequest,
  createDeleteSubTodoRequest,
  createDeleteSubTodoSuccessResponse,
  createDeleteTodoRequest,
  createHeadTodoRequest,
  createListSubTodosRequest,
  createListSubTodosSuccessResponse,
  createListTodosRequest,
  createOptionsTodoRequest,
  createPutTodoRequest,
  createQuerySubTodoRequest,
  createQuerySubTodoSuccessResponse,
  createQueryTodoRequest,
  createQueryTodoSuccessResponse,
  createTestHono,
  createUpdateSubTodoRequest,
  createUpdateTodoRequest,
  createUpdateTodoStatusRequest,
} from "test-utils";
import { describe, expect, test } from "vitest";
import { prepareRequestData } from "../../../helpers.js";
import {
  createUnvalidatedTodoHonoWithHandlers,
  readContextString,
  requestTestHono,
} from "./fixtures.js";

describe("Generated Hono route dispatch", () => {
  test("dispatches GET /todos to the list operation", async () => {
    const requestData = createListTodosRequest();

    const response = await requestTestHono(
      "http://localhost/todos?status=TODO",
      requestData
    );

    expect(response.status).toBe(200);
    const data = (await response.json()) as Record<string, unknown>;
    expect(data["results"]).toHaveLength(2);
    expect(data["nextToken"]).toEqual(expect.any(String));
  });

  test("dispatches POST /todos with the validated request body", async () => {
    const requestData = createCreateTodoRequest({
      body: {
        title: "ship hono hardening",
        priority: "HIGH",
      },
    });

    const response = await requestTestHono(
      "http://localhost/todos",
      requestData
    );

    expect(response.status).toBe(201);
    const data = (await response.json()) as Record<string, unknown>;
    expect(data["title"]).toBe("ship hono hardening");
    expect(data["priority"]).toBe("HIGH");
    expect(data["status"]).toBe("TODO");
  });

  test("dispatches PUT /todos/:todoId with path params and body fields", async () => {
    const requestData = createPutTodoRequest({
      body: {
        title: "replace todo",
        priority: "LOW",
        status: "IN_PROGRESS",
      },
    });

    const response = await requestTestHono(
      `http://localhost/todos/${requestData.param.todoId}`,
      requestData
    );

    expect(response.status).toBe(200);
    const data = (await response.json()) as Record<string, unknown>;
    expect(data["id"]).toBe(requestData.param.todoId);
    expect(data["title"]).toBe("replace todo");
    expect(data["priority"]).toBe("LOW");
    expect(data["status"]).toBe("IN_PROGRESS");
  });

  test("dispatches PATCH /todos/:todoId with path params and body fields", async () => {
    const requestData = createUpdateTodoRequest({
      body: {
        title: "patch todo",
        priority: "MEDIUM",
      },
    });

    const response = await requestTestHono(
      `http://localhost/todos/${requestData.param.todoId}`,
      requestData
    );

    expect(response.status).toBe(200);
    const data = (await response.json()) as Record<string, unknown>;
    expect(data["id"]).toBe(requestData.param.todoId);
    expect(data["title"]).toBe("patch todo");
    expect(data["priority"]).toBe("MEDIUM");
  });
});

describe("Generated Hono todo route precedence", () => {
  test("dispatches PUT /todos/:todoId/status with the requested status", async () => {
    const requestData = createUpdateTodoStatusRequest({
      body: { value: "DONE" },
    });

    const response = await requestTestHono(
      `http://localhost/todos/${requestData.param.todoId}/status`,
      requestData
    );

    expect(response.status).toBe(200);
    const data = (await response.json()) as Record<string, unknown>;
    expect(data["id"]).toBe(requestData.param.todoId);
    expect(data["status"]).toBe("DONE");
  });

  test("dispatches DELETE /todos/:todoId as a 204 empty response", async () => {
    const requestData = createDeleteTodoRequest();

    const response = await requestTestHono(
      `http://localhost/todos/${requestData.param.todoId}`,
      requestData
    );

    expect(response.status).toBe(204);
    expect(await response.text()).toBe("");
  });

  test("dispatches OPTIONS /todos/:todoId and preserves the Allow header", async () => {
    const requestData = createOptionsTodoRequest();

    const response = await requestTestHono(
      `http://localhost/todos/${requestData.param.todoId}`,
      requestData
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Allow")).toBe(
      "GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS"
    );
  });

  test("returns 200 with an empty body for HEAD /todos/:todoId", async () => {
    const requestData = createHeadTodoRequest();

    const response = await requestTestHono(
      `http://localhost/todos/${requestData.param.todoId}`,
      requestData
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("");
  });

  test("static todo query route wins over the dynamic todo route", async () => {
    let capturedOperationId: string | undefined;
    const requestData = createQueryTodoRequest();
    const app = createUnvalidatedTodoHonoWithHandlers({
      handleQueryTodoRequest: async (_request, context) => {
        capturedOperationId = readContextString(context, "operationId");
        return createQueryTodoSuccessResponse({ body: { results: [] } });
      },
    });

    const response = await app.request(
      "http://localhost/todos/query",
      prepareRequestData(requestData)
    );

    expect(response.status).toBe(200);
    expect(capturedOperationId).toBe("QueryTodo");
  });

  test("nested subtodo create routes propagate parent ids and body fields", async () => {
    const requestData = createCreateSubTodoRequest({
      body: {
        title: "create nested item",
        priority: "HIGH",
      },
    });

    const response = await requestTestHono(
      `http://localhost/todos/${requestData.param.todoId}/subtodos`,
      requestData
    );

    expect(response.status).toBe(201);
    const data = (await response.json()) as Record<string, unknown>;
    expect(data["parentId"]).toBe(requestData.param.todoId);
    expect(data["title"]).toBe("create nested item");
    expect(data["priority"]).toBe("HIGH");
  });
});

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
