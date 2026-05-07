import type { IHttpRequest, ITypedHttpResponse } from "@rexeus/typeweaver-core";
import { createCreateSubTodoRequest, createCreateTodoRequest, createDeleteSubTodoRequest, createDeleteTodoRequest, createGetTodoRequest, createHeadTodoRequest, createListSubTodosRequest, createListTodosRequest, createOptionsTodoRequest, createPutTodoRequest, createQuerySubTodoRequest, createQueryTodoRequest, createTestApp, createUpdateSubTodoRequest, createUpdateTodoRequest, createUpdateTodoStatusRequest, defineMiddleware } from 'test-utils';
import type { IValidationErrorResponseBody } from 'test-utils';
import { describe, expect, test, vi } from "vitest";
import {
  BASE_URL,
  buildFetchRequest,
  expectErrorResponse,
  expectJson,
  postRaw,
} from "../../helpers.js";

async function expectNoBody(response: Response): Promise<void> {
  expect(await response.text()).toBe("");
}

async function expectValidationIssue(
  response: Response,
  issueKey: keyof IValidationErrorResponseBody["issues"]
): Promise<void> {
  const data = (await expectErrorResponse(
    response,
    400,
    "VALIDATION_ERROR"
  )) as IValidationErrorResponseBody;
  expect(data.issues[issueKey]).toHaveLength(1);
}

function buildRawBodyFetchRequest(
  url: string,
  requestData: IHttpRequest,
  body: string
): Request {
  return buildFetchRequest(url, { ...requestData, body });
}

function aCreateTodoJsonBodyWithPrototypePollutionPayload(
  validBody: object
): string {
  const payload = Object.assign(Object.create(null), validBody, {
    constructor: { prototype: { polluted: "yes" } },
    prototype: { polluted: "yes" },
  }) as Record<string, unknown>;

  Object.defineProperty(payload, "__proto__", {
    value: { polluted: "yes" },
    enumerable: true,
  });

  return JSON.stringify(payload);
}

describe("Generated Server Router", () => {
  describe("Generated Route Requests", () => {
    test("returns request body fields from the create todo route", async () => {
      const app = createTestApp();
      const requestData = createCreateTodoRequest({
        body: { title: "Write generated server tests", priority: "HIGH" },
      });

      const response = await app.fetch(
        buildFetchRequest(`${BASE_URL}/todos`, requestData)
      );

      const data = await expectJson(response, 201);
      expect(data.title).toBe("Write generated server tests");
      expect(data.priority).toBe("HIGH");
      expect(data.status).toBe("TODO");
    });

    test("merges route params into the replace todo response", async () => {
      const app = createTestApp();
      const requestData = createPutTodoRequest({
        param: { todoId: "01J9Z8ZK9Y3X2W1V0T9S8R7Q6P" },
        body: { title: "Replace from route params" },
      });

      const response = await app.fetch(
        buildFetchRequest(
          `${BASE_URL}/todos/${requestData.param.todoId}`,
          requestData
        )
      );

      const data = await expectJson(response, 200);
      expect(data.id).toBe(requestData.param.todoId);
      expect(data.title).toBe("Replace from route params");
    });

    test("merges route params and body into the update todo response", async () => {
      const app = createTestApp();
      const requestData = createUpdateTodoRequest({
        param: { todoId: "01J9Z8ZK9Y3X2W1V0T9S8R7Q6P" },
        body: { title: "Patch from route params" },
      });

      const response = await app.fetch(
        buildFetchRequest(
          `${BASE_URL}/todos/${requestData.param.todoId}`,
          requestData
        )
      );

      const data = await expectJson(response, 200);
      expect(data.id).toBe(requestData.param.todoId);
      expect(data.title).toBe("Patch from route params");
    });

    test("returns the requested todo status update", async () => {
      const app = createTestApp();
      const requestData = createUpdateTodoStatusRequest({
        param: { todoId: "01J9Z8ZK9Y3X2W1V0T9S8R7Q6P" },
        body: { value: "DONE" },
      });

      const response = await app.fetch(
        buildFetchRequest(
          `${BASE_URL}/todos/${requestData.param.todoId}/status`,
          requestData
        )
      );

      const data = await expectJson(response, 200);
      expect(data.id).toBe(requestData.param.todoId);
      expect(data.status).toBe("DONE");
    });

    test("returns the decoded nextToken from the query todo request", async () => {
      const app = createTestApp();
      const requestData = createQueryTodoRequest({
        query: { nextToken: "runtime query+token" },
      });

      const response = await app.fetch(
        buildFetchRequest(
          `${BASE_URL}/todos/query?nextToken=runtime%20query%2Btoken`,
          requestData
        )
      );

      const data = await expectJson(response, 200);
      expect(data.nextToken).toBe("runtime query+token");
    });

    test("routes /todos/query to the static query operation", async () => {
      const app = createTestApp();
      const requestData = createQueryTodoRequest();

      const response = await app.fetch(
        buildFetchRequest(`${BASE_URL}/todos/query`, requestData)
      );

      const data = await expectJson(response, 200);
      expect(data.results).toEqual(expect.any(Array));
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
      expect(data.id).toBe("runtime todo+42");
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
      expect(data.parentId).toBe(requestData.param.todoId);
      expect(data.id).toBe(requestData.param.subtodoId);
      expect(data.title).toBe("Nested route update");
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
      expect(data.results).toEqual(expect.any(Array));
    });

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
      expect(data.parentId).toBe(requestData.param.todoId);
      expect(data.title).toBe("Create nested route");
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
      expect(data.results).toEqual(expect.any(Array));
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
      expect(data.message).toEqual(expect.any(String));
    });

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

  describe("Route Metadata", () => {
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

      await app.fetch(
        new Request(`${BASE_URL}/nonexistent`, { method: "GET" })
      );

      expect(capturedRoute).toBeUndefined();
    });
  });

  describe("Request Validation", () => {
    test.each([
      {
        name: "body",
        createRequest: () =>
          createCreateTodoRequest({
            body: { priority: "INVALID_PRIORITY" as any },
          }),
        url: `${BASE_URL}/todos`,
        issueKey: "body" as const,
      },
      {
        name: "headers",
        createRequest: () =>
          createCreateTodoRequest({
            header: { "Content-Type": "text/plain" as any },
          }),
        url: `${BASE_URL}/todos`,
        issueKey: "header" as const,
      },
      {
        name: "path parameters",
        createRequest: () => createUpdateTodoRequest(),
        url: `${BASE_URL}/todos/invalid-uuid-format`,
        issueKey: "param" as const,
      },
      {
        name: "query parameters",
        createRequest: () => createListTodosRequest(),
        url: `${BASE_URL}/todos?status=INVALID_STATUS`,
        issueKey: "query" as const,
      },
    ])("rejects invalid $name", async ({ createRequest, url, issueKey }) => {
      const app = createTestApp();
      const requestData = createRequest();

      const response = await app.fetch(buildFetchRequest(url, requestData));

      await expectValidationIssue(response, issueKey);
    });

    test("bypasses body validation when validateRequests is disabled", async () => {
      const app = createTestApp({ validateRequests: false });
      const requestData = createCreateTodoRequest({ body: { title: "" } });

      const response = await app.fetch(
        buildFetchRequest(`${BASE_URL}/todos`, requestData)
      );

      expect(response.status).toBe(201);
    });

    test("bypasses path validation when validateRequests is disabled", async () => {
      const app = createTestApp({
        validateRequests: false,
        validateResponses: false,
      });
      const requestData = createGetTodoRequest();

      const response = await app.fetch(
        buildFetchRequest(`${BASE_URL}/todos/not-a-ulid`, requestData)
      );

      const data = await expectJson(response, 200);
      expect(data.id).toBe("not-a-ulid");
    });

    test("bypasses query validation when validateRequests is disabled", async () => {
      const app = createTestApp({ validateRequests: false });
      const requestData = createListTodosRequest();

      const response = await app.fetch(
        buildFetchRequest(
          `${BASE_URL}/todos?status=INVALID_STATUS`,
          requestData
        )
      );

      const data = await expectJson(response, 200);
      expect(data.results).toEqual(expect.any(Array));
    });

    test("preserves encoded dangerous path parameters at the fetch boundary", async () => {
      const app = createTestApp({
        validateRequests: false,
        validateResponses: false,
      });
      const requestData = createGetTodoRequest();

      const response = await app.fetch(
        buildFetchRequest(`${BASE_URL}/todos/a%2Fb`, requestData)
      );

      const data = await expectJson(response, 200);
      expect(data.id).toBe("a%2Fb");
    });

    test("uses a custom request validation error handler when provided", async () => {
      const app = createTestApp({
        handleRequestValidationErrors: () => ({
          statusCode: 400,
          header: { "Content-Type": "application/json" },
          body: { message: "Custom validation error" },
        }),
      });
      const requestData = createCreateTodoRequest({
        body: { priority: "INVALID_PRIORITY" as any },
      });

      const response = await app.fetch(
        buildFetchRequest(`${BASE_URL}/todos`, requestData)
      );

      const data = await expectJson(response, 400);
      expect(data.message).toBe("Custom validation error");
    });

    test("returns a sanitized bad request response for malformed JSON", async () => {
      const app = createTestApp();

      const response = await app.fetch(
        postRaw("/todos", '{"title":', "application/json")
      );

      const data = await expectErrorResponse(response, 400, "BAD_REQUEST");
      expect(data.message).toBe("Malformed request body");
      expect(JSON.stringify(data)).not.toContain("title");
    });

    test("returns payload too large when the generated app body limit is exceeded", async () => {
      const consoleError = vi
        .spyOn(console, "error")
        .mockImplementation(() => undefined);
      const app = createTestApp({ maxBodySize: 16 });

      try {
        const response = await app.fetch(
          postRaw("/todos", "x".repeat(32), "text/plain")
        );

        await expectErrorResponse(response, 413, "PAYLOAD_TOO_LARGE");
      } finally {
        consoleError.mockRestore();
      }
    });

    test("does not pollute Object.prototype from generated JSON request bodies", async () => {
      const app = createTestApp();
      const requestData = createCreateTodoRequest({
        body: { title: "Pollution guard" },
      });
      const rawBody = aCreateTodoJsonBodyWithPrototypePollutionPayload(
        requestData.body
      );

      try {
        const response = await app.fetch(
          buildRawBodyFetchRequest(`${BASE_URL}/todos`, requestData, rawBody)
        );

        const data = await expectJson(response, 201);
        expect(data.title).toBe("Pollution guard");
        expect(Object.prototype).not.toHaveProperty("polluted");
      } finally {
        delete (Object.prototype as { polluted?: unknown }).polluted;
      }
    });
  });

  describe("Response Handling", () => {
    test("returns JSON response bodies with the generated content type", async () => {
      const app = createTestApp();
      const requestData = createCreateTodoRequest();

      const response = await app.fetch(
        buildFetchRequest(`${BASE_URL}/todos`, requestData)
      );

      expect(response.headers.get("Content-Type")).toBe("application/json");
      const data = await expectJson(response, 201);
      expect(data.id).toEqual(expect.any(String));
      expect(data.title).toBe(requestData.body.title);
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

  describe("Error Handling", () => {
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
      expect(data.errorCode).toBe("TODO_NOT_FOUND");
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
      expect(data.customMessage).toBe("Custom error handling");
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

    test("returns the default 500 response for unknown errors", async () => {
      const app = createTestApp({
        throwTodoError: new Error("Something went wrong"),
      });
      const requestData = createCreateTodoRequest();

      const response = await app.fetch(
        buildFetchRequest(`${BASE_URL}/todos`, requestData)
      );

      await expectErrorResponse(response, 500, "INTERNAL_SERVER_ERROR");
    });

    test("uses a custom unknown error handler when provided", async () => {
      const app = createTestApp({
        throwTodoError: new Error("Something went wrong"),
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
      expect(data.customUnknownError).toBe("Custom unknown error handling");
    });

    test("returns the default 500 response when the request validation error handler throws", async () => {
      const app = createTestApp({
        handleRequestValidationErrors: () => {
          throw new Error("Validation handler failed");
        },
      });
      const requestData = createCreateTodoRequest({
        body: { priority: "INVALID_PRIORITY" as any },
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
          throw new Error("HTTP handler failed");
        },
      });
      const requestData = createCreateTodoRequest();

      const response = await app.fetch(
        buildFetchRequest(`${BASE_URL}/todos`, requestData)
      );

      await expectErrorResponse(response, 500, "INTERNAL_SERVER_ERROR");
    });
  });

  describe("Middleware", () => {
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

      await app.fetch(
        new Request(`${BASE_URL}/unknown-path`, { method: "GET" })
      );

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
      expect(data.message).toBe("I'm a teapot");
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
        body: { priority: "INVALID_PRIORITY" as any },
      });

      const response = await app.fetch(
        buildFetchRequest(`${BASE_URL}/todos`, requestData)
      );

      const data = await expectJson(response, 418);
      expect(data.message).toBe("I'm still a teapot");
      expect(data.code).toBeUndefined();
    });
  });
});
