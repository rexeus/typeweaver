import type {
  IRawHttpRequest,
  ITypedHttpResponse,
} from "@rexeus/typeweaver-core";
import { Hono } from "hono";
import {
  createCreateTodoRequest,
  createCreateTodoSuccessResponse,
  createGetTodoSuccessResponse,
  createListTodosSuccessResponse,
  createOptionsTodoSuccessResponse,
  createTestHono,
  TestAssertionError,
  TodoHono,
} from "test-utils";
import { describe, expect, test } from "vitest";
import { prepareRequestData } from "../../helpers.js";
import type { Context } from "hono";
import type { HonoTodoApiHandler } from "test-utils";

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

function createCreateTodoRouteReturning(
  response: ITypedHttpResponse,
  options?: CreateTodoHonoOptions
): TodoHono<true> {
  type CreateTodoRouteResponse = Awaited<
    ReturnType<HonoTodoApiHandler["handleCreateTodoRequest"]>
  >;

  return createTodoHonoWithHandlers(
    {
      handleCreateTodoRequest: async () => response as CreateTodoRouteResponse,
    },
    options ?? {}
  );
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

describe("Generated Hono Blob response serialization", () => {
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
});

describe("Generated Hono repeated response headers", () => {
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
