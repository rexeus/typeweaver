import type { IHttpRequest, ITypedHttpResponse } from "@rexeus/typeweaver-core";
import {
  badRequestDefaultError,
  RequestValidationError,
  validationDefaultError,
} from "@rexeus/typeweaver-core";
import { Hono } from "hono";
import {
  createCreateSubTodoRequest,
  createCreateTodoRequest,
  createCreateTodoSuccessResponse,
  createDeleteSubTodoRequest,
  createDeleteSubTodoSuccessResponse,
  createDeleteTodoRequest,
  createGetTodoSuccessResponse,
  createHeadTodoRequest,
  createListSubTodosRequest,
  createListSubTodosSuccessResponse,
  createListTodosRequest,
  createListTodosSuccessResponse,
  createOptionsTodoRequest,
  createOptionsTodoSuccessResponse,
  createPutTodoRequest,
  createQuerySubTodoRequest,
  createQuerySubTodoSuccessResponse,
  createQueryTodoRequest,
  createQueryTodoSuccessResponse,
  createTestHono,
  createUpdateSubTodoRequest,
  createUpdateTodoRequest,
  createUpdateTodoStatusRequest,
  TodoHono,
} from "test-utils";
import { describe, expect, test } from "vitest";
import { expectErrorResponse, prepareRequestData } from "../../helpers.js";
import type { Context } from "hono";
import type {
  HonoTodoApiHandler,
  IValidationErrorResponseBody,
} from "test-utils";

type CreateTestHonoOptions = Parameters<typeof createTestHono>[0];
type CreateTodoHonoOptions = Omit<
  ConstructorParameters<typeof TodoHono>[0],
  "requestHandlers"
>;

async function requestTestHono(
  url: string,
  requestData: IHttpRequest,
  options?: CreateTestHonoOptions
): Promise<Response> {
  return await createTestHono(options).request(
    url,
    prepareRequestData(requestData)
  );
}

function createTodoHonoWithHandlers(
  handlers: Partial<HonoTodoApiHandler>,
  options?: CreateTodoHonoOptions
): TodoHono {
  const requestHandlers = new Proxy(handlers as HonoTodoApiHandler, {
    get: (target, prop) => {
      if (prop in target) return target[prop as keyof HonoTodoApiHandler];
      return async () => {
        throw new Error(`Missing Hono test handler: ${String(prop)}`);
      };
    },
  });

  return new TodoHono({
    ...options,
    requestHandlers,
    validateResponses: options?.validateResponses ?? false,
  });
}

function createCreateTodoRouteReturning(
  response: ITypedHttpResponse,
  options?: CreateTodoHonoOptions
): TodoHono {
  type CreateTodoRouteResponse = Awaited<
    ReturnType<HonoTodoApiHandler["handleCreateTodoRequest"]>
  >;

  return createTodoHonoWithHandlers(
    {
      handleCreateTodoRequest: async () => response as CreateTodoRouteResponse,
    },
    options
  );
}

function createUnvalidatedTodoHonoWithHandlers(
  handlers: Partial<HonoTodoApiHandler>
): TodoHono {
  return createTodoHonoWithHandlers(handlers, {
    validateRequests: false,
    validateResponses: false,
  });
}

function getHeaderValues(headers: Headers, name: string): string[] {
  const setCookieHeaders = (
    headers as Headers & { getSetCookie?: () => string[] }
  ).getSetCookie?.();

  if (
    name.toLowerCase() === "set-cookie" &&
    setCookieHeaders &&
    setCookieHeaders.length > 0
  ) {
    return setCookieHeaders;
  }

  return headers.get(name)?.split(", ") ?? [];
}

function aNestedJsonPrototypePollutionPayload(): string {
  return (
    '{"title":"safe title","meta":{"label":"nested","__proto__":{"polluted":true}},' +
    '"items":[{"value":"array nested","__proto__":{"polluted":true}}],' +
    '"__proto__":{"polluted":true}}'
  );
}

describe("Generated Hono Router", () => {
  describe("route dispatch and precedence", () => {
    test("dispatches GET /todos to the list operation", async () => {
      const requestData = createListTodosRequest();

      const response = await requestTestHono(
        "http://localhost/todos?status=TODO",
        requestData
      );

      expect(response.status).toBe(200);
      const data = (await response.json()) as Record<string, unknown>;
      expect(data.results).toHaveLength(2);
      expect(data.nextToken).toEqual(expect.any(String));
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
      expect(data.title).toBe("ship hono hardening");
      expect(data.priority).toBe("HIGH");
      expect(data.status).toBe("TODO");
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
      expect(data.id).toBe(requestData.param.todoId);
      expect(data.title).toBe("replace todo");
      expect(data.priority).toBe("LOW");
      expect(data.status).toBe("IN_PROGRESS");
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
      expect(data.id).toBe(requestData.param.todoId);
      expect(data.title).toBe("patch todo");
      expect(data.priority).toBe("MEDIUM");
    });

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
      expect(data.id).toBe(requestData.param.todoId);
      expect(data.status).toBe("DONE");
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
          capturedOperationId = context.get("operationId");
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
      expect(data.parentId).toBe(requestData.param.todoId);
      expect(data.title).toBe("create nested item");
      expect(data.priority).toBe("HIGH");
    });

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
      expect(data.results).toEqual([]);
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
      expect(data.parentId).toBe(requestData.param.todoId);
      expect(data.id).toBe(requestData.param.subtodoId);
      expect(data.title).toBe("update nested item");
      expect(data.priority).toBe("LOW");
    });

    test("nested static subtodo query route hits the query operation", async () => {
      let capturedOperationId: string | undefined;
      let capturedTodoId: string | undefined;
      const requestData = createQuerySubTodoRequest();
      const app = createUnvalidatedTodoHonoWithHandlers({
        handleQuerySubTodoRequest: async (request, context) => {
          capturedOperationId = context.get("operationId");
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
      expect(data.message).toBe("deleted subtodo");
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
      const response = await createTestHono().request(
        "http://localhost/todos",
        { method: "PUT" }
      );

      expect(response.status).toBe(404);
      expect(response.headers.get("Allow")).toBeNull();
    });
  });

  describe("request validation", () => {
    test("rejects invalid request body", async () => {
      const requestData = createCreateTodoRequest({
        body: {
          priority: "INVALID_PRIORITY" as any,
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
          "Content-Type": "text/plain" as any,
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

    test("passes request validation errors and Hono context to custom handlers", async () => {
      let capturedError: unknown;
      let capturedOperationId: string | undefined;
      const app = createTestHono({
        handleRequestValidationErrors: (error, context) => {
          capturedError = error;
          capturedOperationId = context.get("operationId");
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
          priority: "INVALID_PRIORITY" as any,
        },
      });

      const response = await app.request(
        "http://localhost/todos",
        prepareRequestData(requestData)
      );

      expect(response.status).toBe(422);
      const errorData = (await response.json()) as Record<string, unknown>;
      expect(errorData.code).toBe("CUSTOM_REQUEST_VALIDATION");
      expect(errorData.bodyIssueCount).toBe(1);
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
          priority: "INVALID_PRIORITY" as any,
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

  describe("request adaptation and body parsing", () => {
    test("returns sanitized BAD_REQUEST for malformed JSON request bodies", async () => {
      const response = await createTestHono().request(
        "http://localhost/todos",
        {
          method: "POST",
          headers: {
            Accept: "application/json",
            Authorization: "Bearer token",
            "Content-Type": "application/json",
          },
          body: "{",
        }
      );

      const data = await expectErrorResponse(
        response,
        badRequestDefaultError.statusCode,
        badRequestDefaultError.code
      );
      expect(data.message).toBe(badRequestDefaultError.message);
    });

    test("passes JSON request bodies to handlers as null-prototype records when request validation is disabled", async () => {
      let bodyPrototype: object | null | undefined;
      let nestedPrototype: object | null | undefined;
      let arrayItemPrototype: object | null | undefined;
      let handlerSawArray = false;
      const app = createUnvalidatedTodoHonoWithHandlers({
        handleCreateTodoRequest: async request => {
          const body = request.body as Record<string, unknown>;
          const meta = body.meta as Record<string, unknown>;
          const items = body.items as Record<string, unknown>[];
          bodyPrototype = Object.getPrototypeOf(body);
          nestedPrototype = Object.getPrototypeOf(meta);
          handlerSawArray = Array.isArray(items);
          arrayItemPrototype = Object.getPrototypeOf(items[0]);
          return createCreateTodoSuccessResponse({
            body: { title: String(body.title) },
          });
        },
      });

      const response = await app.request("http://localhost/todos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: aNestedJsonPrototypePollutionPayload(),
      });

      expect(response.status).toBe(201);
      const data = (await response.json()) as Record<string, unknown>;
      expect(data.title).toBe("safe title");
      expect(bodyPrototype).toBeNull();
      expect(nestedPrototype).toBeNull();
      expect(handlerSawArray).toBe(true);
      expect(arrayItemPrototype).toBeNull();
    });

    test("removes __proto__ keys from nested JSON request bodies without polluting Object.prototype", async () => {
      let handlerSawUnsafeKey = true;
      let handlerSawNestedUnsafeKey = true;
      let handlerSawArrayUnsafeKey = true;
      let handlerSawPollution: unknown = true;
      const app = createUnvalidatedTodoHonoWithHandlers({
        handleCreateTodoRequest: async request => {
          const body = request.body as Record<string, unknown>;
          const meta = body.meta as Record<string, unknown>;
          const items = body.items as Record<string, unknown>[];
          handlerSawUnsafeKey = Object.prototype.hasOwnProperty.call(
            body,
            "__proto__"
          );
          handlerSawNestedUnsafeKey = Object.prototype.hasOwnProperty.call(
            meta,
            "__proto__"
          );
          handlerSawArrayUnsafeKey = Object.prototype.hasOwnProperty.call(
            items[0],
            "__proto__"
          );
          handlerSawPollution = ({} as Record<string, unknown>).polluted;
          return createCreateTodoSuccessResponse({
            body: { title: String(body.title) },
          });
        },
      });

      const response = await app.request("http://localhost/todos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: aNestedJsonPrototypePollutionPayload(),
      });

      expect(response.status).toBe(201);
      expect(handlerSawUnsafeKey).toBe(false);
      expect(handlerSawNestedUnsafeKey).toBe(false);
      expect(handlerSawArrayUnsafeKey).toBe(false);
      expect(handlerSawPollution).toBeUndefined();
      expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    });

    test("parses vendor JSON media types when request validation is disabled", async () => {
      let handlerBody: Record<string, unknown> | undefined;
      const app = createUnvalidatedTodoHonoWithHandlers({
        handleCreateTodoRequest: async request => {
          handlerBody = request.body as Record<string, unknown>;
          return createCreateTodoSuccessResponse({
            body: { title: String(handlerBody.title) },
          });
        },
      });

      const response = await app.request("http://localhost/todos", {
        method: "POST",
        headers: { "Content-Type": "application/vnd.api+json; charset=utf-8" },
        body: '{"title":"vendor json title"}',
      });

      expect(response.status).toBe(201);
      expect(handlerBody?.title).toBe("vendor json title");
      expect(Object.getPrototypeOf(handlerBody!)).toBeNull();
    });

    test("returns sanitized BAD_REQUEST for malformed vendor JSON request bodies", async () => {
      const response = await createTestHono({
        validateRequests: false,
      }).request("http://localhost/todos", {
        method: "POST",
        headers: { "Content-Type": "application/vnd.api+json; charset=utf-8" },
        body: "{",
      });

      await expectErrorResponse(
        response,
        badRequestDefaultError.statusCode,
        badRequestDefaultError.code
      );
    });

    test("returns sanitized BAD_REQUEST for malformed JSON before invoking handlers when validation is disabled", async () => {
      let handlerInvoked = false;
      const app = createUnvalidatedTodoHonoWithHandlers({
        handleCreateTodoRequest: async () => {
          handlerInvoked = true;
          return createCreateTodoSuccessResponse();
        },
      });

      const response = await app.request("http://localhost/todos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{",
      });

      await expectErrorResponse(
        response,
        badRequestDefaultError.statusCode,
        badRequestDefaultError.code
      );
      expect(handlerInvoked).toBe(false);
    });

    test("keeps malformed JSON as BAD_REQUEST when a custom unknown error handler is configured", async () => {
      const response = await createTestHono({
        handleUnknownErrors: () => ({
          statusCode: 500,
          body: { code: "CUSTOM_UNKNOWN" },
        }),
      }).request("http://localhost/todos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{",
      });

      await expectErrorResponse(
        response,
        badRequestDefaultError.statusCode,
        badRequestDefaultError.code
      );
    });

    test("passes text request bodies to handlers as strings when validation is disabled", async () => {
      let handlerBody: unknown;
      const app = createUnvalidatedTodoHonoWithHandlers({
        handleCreateTodoRequest: async request => {
          handlerBody = request.body;
          return createCreateTodoSuccessResponse({
            body: { title: String(request.body) },
          });
        },
      });

      const response = await app.request("http://localhost/todos", {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: "plain text todo",
      });

      expect(response.status).toBe(201);
      expect(handlerBody).toBe("plain text todo");
    });

    test("passes unknown-content-type request bodies to handlers as raw text when request validation is disabled", async () => {
      let handlerBody: unknown;
      const app = createUnvalidatedTodoHonoWithHandlers({
        handleCreateTodoRequest: async request => {
          handlerBody = request.body;
          return createCreateTodoSuccessResponse({
            body: { title: String(request.body) },
          });
        },
      });

      const response = await app.request("http://localhost/todos", {
        method: "POST",
        headers: { "Content-Type": "application/octet-stream" },
        body: "raw bytes as text",
      });

      expect(response.status).toBe(201);
      const data = (await response.json()) as Record<string, unknown>;
      expect(handlerBody).toBe("raw bytes as text");
      expect(data.title).toBe("raw bytes as text");
    });

    test("parses repeated form-url-encoded fields into safe records when validation is disabled", async () => {
      let handlerBody: Record<string, unknown> | undefined;
      const app = createUnvalidatedTodoHonoWithHandlers({
        handleCreateTodoRequest: async request => {
          handlerBody = request.body as Record<string, unknown>;
          return createCreateTodoSuccessResponse({
            body: {
              title: handlerBody.title as string,
              priority: handlerBody.priority as "HIGH",
            },
          });
        },
      });

      const response = await app.request("http://localhost/todos", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: "title=first&title=second&priority=HIGH",
      });

      expect(response.status).toBe(201);
      const data = (await response.json()) as Record<string, unknown>;
      expect(data.title).toEqual(["first", "second"]);
      expect(data.priority).toBe("HIGH");
      expect(Object.getPrototypeOf(handlerBody!)).toBeNull();
    });

    test("preserves repeated empty query parameter values when validation is disabled", async () => {
      let handlerQuery: Record<string, unknown> | undefined;
      const app = createUnvalidatedTodoHonoWithHandlers({
        handleQueryTodoRequest: async request => {
          handlerQuery = request.query as Record<string, unknown>;
          return createQueryTodoSuccessResponse({
            body: {
              results: [],
              nextToken: handlerQuery.nextToken as string,
            },
          });
        },
      });

      const response = await app.request(
        "http://localhost/todos/query?nextToken=&nextToken=second",
        { method: "POST" }
      );

      expect(response.status).toBe(200);
      const data = (await response.json()) as Record<string, unknown>;
      expect(data.nextToken).toEqual(["", "second"]);
      expect(handlerQuery?.nextToken).toEqual(["", "second"]);
    });

    test("does not pollute Object.prototype from form-url-encoded __proto__ fields", async () => {
      let handlerBody: Record<string, unknown> | undefined;
      const app = createUnvalidatedTodoHonoWithHandlers({
        handleCreateTodoRequest: async request => {
          handlerBody = request.body as Record<string, unknown>;
          return createCreateTodoSuccessResponse({
            body: { title: String(handlerBody.title) },
          });
        },
      });

      const response = await app.request("http://localhost/todos", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: "title=safe&__proto__=polluted",
      });

      expect(response.status).toBe(201);
      expect(handlerBody?.title).toBe("safe");
      expect(Object.getPrototypeOf(handlerBody!)).toBeNull();
      expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    });

    test("does not pollute Object.prototype from query string __proto__ values", async () => {
      let handlerQuery: Record<string, unknown> | undefined;
      const app = createUnvalidatedTodoHonoWithHandlers({
        handleQueryTodoRequest: async request => {
          handlerQuery = request.query as Record<string, unknown>;
          return createQueryTodoSuccessResponse({
            body: { results: [], nextToken: String(handlerQuery.nextToken) },
          });
        },
      });

      const response = await app.request(
        "http://localhost/todos/query?nextToken=safe&__proto__=polluted",
        { method: "POST" }
      );

      expect(response.status).toBe(200);
      expect(handlerQuery?.nextToken).toBe("safe");
      expect(Object.getPrototypeOf(handlerQuery!)).toBeNull();
      expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    });
  });

  describe("response serialization", () => {
    test("serializes typed responses returned by route handlers as JSON", async () => {
      const requestData = createCreateTodoRequest({
        body: {
          title: "serialize typed response",
          priority: "HIGH",
        },
      });
      const app = createTodoHonoWithHandlers(
        {
          handleCreateTodoRequest: async request =>
            createCreateTodoSuccessResponse({
              body: {
                title: request.body.title,
                priority: request.body.priority,
                status: "TODO",
              },
            }),
        },
        { validateResponses: true }
      );

      const response = await app.request(
        "http://localhost/todos",
        prepareRequestData(requestData)
      );

      expect(response.status).toBe(201);
      expect(response.headers.get("Content-Type")).toBe("application/json");
      const data = (await response.json()) as Record<string, unknown>;
      expect(data.title).toBe("serialize typed response");
      expect(data.priority).toBe("HIGH");
      expect(data.status).toBe("TODO");
    });

    test("returns string response bodies unchanged", async () => {
      const customStringResponse = "This is a plain text response";
      const app = createCreateTodoRouteReturning({
        type: "CustomStringResponse" as const,
        statusCode: 200,
        header: { "Content-Type": "text/plain" },
        body: customStringResponse,
      });
      const requestData = createCreateTodoRequest();

      const response = await app.request(
        "http://localhost/todos",
        prepareRequestData(requestData)
      );

      expect(response.status).toBe(200);
      expect(await response.text()).toBe(customStringResponse);
    });

    test("returns ArrayBuffer response bodies with octet-stream headers and preserved bytes", async () => {
      const body = new TextEncoder().encode("binary data").buffer;
      const app = createCreateTodoRouteReturning({
        type: "CustomArrayBufferResponse" as const,
        statusCode: 200,
        header: { "Content-Type": "application/octet-stream" },
        body,
      });
      const requestData = createCreateTodoRequest();

      const response = await app.request(
        "http://localhost/todos",
        prepareRequestData(requestData)
      );

      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toBe(
        "application/octet-stream"
      );
      expect(Buffer.from(await response.arrayBuffer())).toEqual(
        Buffer.from(body)
      );
    });

    test("returns Blob response bodies with their configured content type", async () => {
      const blob = new Blob(["binary data"], {
        type: "application/octet-stream",
      });
      const app = createCreateTodoRouteReturning({
        type: "CustomBlobResponse" as const,
        statusCode: 200,
        header: { "Content-Type": "application/octet-stream" },
        body: blob,
      });
      const requestData = createCreateTodoRequest();

      const response = await app.request(
        "http://localhost/todos",
        prepareRequestData(requestData)
      );

      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toBe(
        "application/octet-stream"
      );
      const responseBlob = await response.blob();
      expect(responseBlob.size).toBe(blob.size);
    });

    test("infers Blob response Content-Type when no response header is supplied", async () => {
      const blob = new Blob(["data"], {
        type: "application/custom-binary",
      });
      const app = createCreateTodoRouteReturning({
        type: "CustomBlobResponse" as const,
        statusCode: 200,
        header: undefined,
        body: blob,
      });
      const requestData = createCreateTodoRequest();

      const response = await app.request(
        "http://localhost/todos",
        prepareRequestData(requestData)
      );

      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toBe(
        "application/custom-binary"
      );
      expect(await response.text()).toBe("data");
    });

    test("preserves custom single-value response headers", async () => {
      const app = createCreateTodoRouteReturning({
        type: "CreateTodoSuccess" as const,
        statusCode: 201,
        header: {
          "Content-Type": "application/json",
          "X-Test-Header": "single",
        },
        body: { ok: true },
      });
      const requestData = createCreateTodoRequest();

      const response = await app.request(
        "http://localhost/todos",
        prepareRequestData(requestData)
      );

      expect(response.status).toBe(201);
      expect(response.headers.get("X-Test-Header")).toBe("single");
    });

    test("joins array-valued response headers into comma-separated Fetch headers", async () => {
      const app = createCreateTodoRouteReturning({
        type: "CreateTodoSuccess" as const,
        statusCode: 201,
        header: {
          "Content-Type": "application/json",
          "X-Multi-Value": ["first", "second"],
        },
        body: { ok: true },
      });
      const requestData = createCreateTodoRequest();

      const response = await app.request(
        "http://localhost/todos",
        prepareRequestData(requestData)
      );

      expect(response.status).toBe(201);
      expect(response.headers.get("X-Multi-Value")).toBe("first, second");
    });

    test("exposes repeated Set-Cookie response headers when response validation is disabled", async () => {
      const app = createCreateTodoRouteReturning({
        type: "CreateTodoSuccess" as const,
        statusCode: 201,
        header: {
          "Content-Type": "application/json",
          "Set-Cookie": ["a=1", "b=2"],
        },
        body: { ok: true },
      });
      const requestData = createCreateTodoRequest();

      const response = await app.request(
        "http://localhost/todos",
        prepareRequestData(requestData)
      );

      expect(response.status).toBe(201);
      expect(getHeaderValues(response.headers, "Set-Cookie")).toEqual([
        "a=1",
        "b=2",
      ]);
    });
  });

  describe("operation metadata", () => {
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
          [handlerName]: async (_request: IHttpRequest, context: Context) => {
            capturedOperationId = context.get("operationId");
            return responseFactory();
          },
        } as Partial<HonoTodoApiHandler>);

        const response = await app.request(route, { method });

        expect(response.status).toBe(expectedStatus);
        expect(capturedOperationId).toBe(expectedOperationId);
      }
    );
  });

  describe("middleware composition", () => {
    test("app middleware can short-circuit before generated validation", async () => {
      const requestData = createCreateTodoRequest({
        body: { priority: "INVALID_PRIORITY" as any },
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
            capturedTraceId = context.get("traceId");
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

  describe("error handling", () => {
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
      const data = (await response.json()) as Record<string, unknown>;
      expect(data.errorCode).toBe("TODO_NOT_FOUND");
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
          capturedOperationId = context.get("operationId");
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
      const data = (await response.json()) as Record<string, unknown>;
      expect(data.code).toBe("CUSTOM_HTTP_RESPONSE_ERROR");
      expect(capturedError).toBe(errorResponse);
      expect(capturedOperationId).toBe("CreateTodo");
    });

    test("returns sanitized 500 for unknown handler errors by default", async () => {
      const app = createTestHono({
        throwTodoError: new Error("Something went wrong"),
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
        throwTodoError: new Error("boom"),
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

    test("passes unknown handler errors and Hono context to custom handlers", async () => {
      const unknownError = new Error("Something went wrong");
      let capturedError: unknown;
      let capturedOperationId: string | undefined;
      const app = createTestHono({
        throwTodoError: unknownError,
        handleUnknownErrors: (error, context) => {
          capturedError = error;
          capturedOperationId = context.get("operationId");
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
      const data = (await response.json()) as Record<string, unknown>;
      expect(data.code).toBe("CUSTOM_UNKNOWN_ERROR");
      expect(capturedError).toBe(unknownError);
      expect(capturedOperationId).toBe("CreateTodo");
    });

    test("delegates thrown custom unknown error handlers to Hono fallback behavior", async () => {
      const app = createTestHono({
        throwTodoError: new Error("boom"),
        handleUnknownErrors: () => {
          throw new Error("unknown handler failed");
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
          throw new Error("Validation handler failed");
        },
      });
      const requestData = createCreateTodoRequest({
        body: {
          priority: "INVALID_PRIORITY" as any,
        },
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
          throw new Error("Validation handler rejected");
        },
      });
      const requestData = createCreateTodoRequest({
        body: {
          priority: "INVALID_PRIORITY" as any,
        },
      });

      const response = await app.request(
        "http://localhost/todos",
        prepareRequestData(requestData)
      );

      await expectErrorResponse(response, 500, "INTERNAL_SERVER_ERROR");
    });

    test("falls through to the unknown error handler when request validation error handling is disabled", async () => {
      const app = createTestHono({
        handleRequestValidationErrors: false,
      });
      const requestData = createCreateTodoRequest({
        body: {
          priority: "INVALID_PRIORITY" as any,
        },
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
          throw new Error("HTTP handler failed");
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
});
