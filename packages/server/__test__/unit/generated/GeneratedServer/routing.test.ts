import {
  createCreateSubTodoRequest,
  createDeleteSubTodoRequest,
  createGetTodoRequest,
  createHeadTodoRequest,
  createListSubTodosRequest,
  createListTodosRequest,
  createOptionsTodoRequest,
  createQuerySubTodoRequest,
  createQueryTodoRequest,
  createTestApp,
  createUpdateSubTodoRequest,
  defineMiddleware,
} from "test-utils";
import { describe, expect, test } from "vitest";
import {
  BASE_URL,
  buildFetchRequest,
  expectErrorResponse,
  expectJson,
} from "../../../helpers.js";
import { expectNoBody } from "./fixtures.js";

describe("Generated Server static and nested routes", () => {
  test("routes /todos/query to the static query operation", async () => {
    const app = createTestApp();
    const requestData = createQueryTodoRequest();

    const response = await app.fetch(
      buildFetchRequest(`${BASE_URL}/todos/query`, requestData)
    );

    const data = await expectJson(response, 200);
    expect(data["results"]).toEqual(expect.any(Array));
  });

  test("decodes path parameters before passing them to generated handlers", async () => {
    const app = createTestApp({
      validateRequests: false,
      validateResponses: false,
    });
    const requestData = createGetTodoRequest();

    const response = await app.fetch(
      buildFetchRequest(`${BASE_URL}/todos/runtime%20todo%2B42`, requestData)
    );

    const data = await expectJson(response, 200);
    expect(data["id"]).toBe("runtime todo+42");
  });

  test("propagates nested subtodo route parameters", async () => {
    const app = createTestApp();
    const requestData = createUpdateSubTodoRequest({
      param: {
        todoId: "01J9Z8ZK9Y3X2W1V0T9S8R7Q6P",
        subtodoId: "01J9Z8ZK9Y3X2W1V0T9S8R7Q6Q",
      },
      body: { title: "Nested route update" },
    });

    const response = await app.fetch(
      buildFetchRequest(
        `${BASE_URL}/todos/${requestData.param.todoId}/subtodos/${requestData.param.subtodoId}`,
        requestData
      )
    );

    const data = await expectJson(response, 200);
    expect(data["parentId"]).toBe(requestData.param.todoId);
    expect(data["id"]).toBe(requestData.param.subtodoId);
    expect(data["title"]).toBe("Nested route update");
  });

  test("routes nested list requests to the subtodo collection handler", async () => {
    const app = createTestApp();
    const requestData = createListSubTodosRequest({
      param: { todoId: "01J9Z8ZK9Y3X2W1V0T9S8R7Q6P" },
    });

    const response = await app.fetch(
      buildFetchRequest(
        `${BASE_URL}/todos/${requestData.param.todoId}/subtodos`,
        requestData
      )
    );

    const data = await expectJson(response, 200);
    expect(data["results"]).toEqual(expect.any(Array));
  });
});

describe("Generated Server nested route methods", () => {
  test("returns the parent id and body fields from the create subtodo route", async () => {
    const app = createTestApp();
    const requestData = createCreateSubTodoRequest({
      param: { todoId: "01J9Z8ZK9Y3X2W1V0T9S8R7Q6P" },
      body: { title: "Create nested route" },
    });

    const response = await app.fetch(
      buildFetchRequest(
        `${BASE_URL}/todos/${requestData.param.todoId}/subtodos`,
        requestData
      )
    );

    const data = await expectJson(response, 201);
    expect(data["parentId"]).toBe(requestData.param.todoId);
    expect(data["title"]).toBe("Create nested route");
  });

  test("routes nested static query requests to the subtodo query handler", async () => {
    const app = createTestApp();
    const requestData = createQuerySubTodoRequest({
      param: { todoId: "01J9Z8ZK9Y3X2W1V0T9S8R7Q6P" },
      body: { searchText: "nested search" },
    });

    const response = await app.fetch(
      buildFetchRequest(
        `${BASE_URL}/todos/${requestData.param.todoId}/subtodos/query`,
        requestData
      )
    );

    const data = await expectJson(response, 200);
    expect(data["results"]).toEqual(expect.any(Array));
  });

  test("routes nested delete requests to the subtodo delete handler", async () => {
    const app = createTestApp();
    const requestData = createDeleteSubTodoRequest({
      param: {
        todoId: "01J9Z8ZK9Y3X2W1V0T9S8R7Q6P",
        subtodoId: "01J9Z8ZK9Y3X2W1V0T9S8R7Q6Q",
      },
    });

    const response = await app.fetch(
      buildFetchRequest(
        `${BASE_URL}/todos/${requestData.param.todoId}/subtodos/${requestData.param.subtodoId}`,
        requestData
      )
    );

    const data = await expectJson(response, 200);
    expect(data["message"]).toEqual(expect.any(String));
  });
});

describe("Generated Server HTTP method fallbacks", () => {
  test("returns an empty body for HEAD requests", async () => {
    const app = createTestApp();
    const requestData = createHeadTodoRequest();

    const response = await app.fetch(
      buildFetchRequest(
        `${BASE_URL}/todos/${requestData.param.todoId}`,
        requestData
      )
    );

    expect(response.status).toBe(200);
    await expectNoBody(response);
  });

  test("includes the Allow header for OPTIONS requests", async () => {
    const app = createTestApp();
    const requestData = createOptionsTodoRequest();

    const response = await app.fetch(
      buildFetchRequest(
        `${BASE_URL}/todos/${requestData.param.todoId}`,
        requestData
      )
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Allow")).toBe(
      "GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS"
    );
  });

  test("returns 404 for unknown paths", async () => {
    const app = createTestApp();

    const response = await app.fetch(
      new Request(`${BASE_URL}/unknown-path`, { method: "GET" })
    );

    await expectErrorResponse(response, 404, "NOT_FOUND");
  });

  test("returns 405 with an Allow header for unsupported methods on known paths", async () => {
    const app = createTestApp();

    const response = await app.fetch(
      new Request(`${BASE_URL}/todos`, { method: "PATCH" })
    );

    await expectErrorResponse(response, 405, "METHOD_NOT_ALLOWED");
    expect(response.headers.get("Allow")).toContain("GET");
  });
});

describe("Generated Server route metadata", () => {
  test("exposes complete metadata for matched generated routes", async () => {
    let capturedRoute: unknown;
    const spy = defineMiddleware(async (ctx, next) => {
      capturedRoute = ctx.route;
      return next();
    });

    const app = createTestApp();
    app.use(spy);

    await app.fetch(
      buildFetchRequest(
        `${BASE_URL}/todos?status=TODO`,
        createListTodosRequest()
      )
    );

    expect(capturedRoute).toEqual({
      operationId: "ListTodos",
      method: "GET",
      path: "/todos",
    });
  });

  test("matches nested static subtodo query metadata before parameter routes", async () => {
    let capturedRoute: unknown;
    const spy = defineMiddleware(async (ctx, next) => {
      capturedRoute = ctx.route;
      return next();
    });

    const app = createTestApp();
    app.use(spy);
    const requestData = createQuerySubTodoRequest({
      param: { todoId: "01J9Z8ZK9Y3X2W1V0T9S8R7Q6P" },
    });

    await app.fetch(
      buildFetchRequest(
        `${BASE_URL}/todos/${requestData.param.todoId}/subtodos/query`,
        requestData
      )
    );

    expect(capturedRoute).toEqual({
      operationId: "QuerySubTodo",
      method: "POST",
      path: "/todos/:todoId/subtodos/query",
    });
  });

  test("leaves ctx.route undefined for unmatched paths", async () => {
    let capturedRoute: unknown = "not-set";
    const spy = defineMiddleware(async (ctx, next) => {
      capturedRoute = ctx.route;
      return next();
    });

    const app = createTestApp();
    app.use(spy);

    await app.fetch(new Request(`${BASE_URL}/nonexistent`, { method: "GET" }));

    expect(capturedRoute).toBeUndefined();
  });
});
