import {
  HttpMethod,
  HttpResponse,
  RequestValidationError,
} from "@rexeus/typeweaver-core";
import { describe, expect, test, vi } from "vitest";
import type { IRequestValidator } from "@rexeus/typeweaver-core";
import { PayloadTooLargeError } from "../../src/lib/Errors";
import { TypeweaverApp } from "../../src/lib/TypeweaverApp";
import { TypeweaverRouter } from "../../src/lib/TypeweaverRouter";
import {
  BASE_URL,
  del,
  expectErrorResponse,
  expectJson,
  get,
  head,
  noopValidator,
  post,
  postRaw,
  put,
} from "../helpers";
import type { RequestHandler } from "../../src/lib/RequestHandler";
import type { TypeweaverAppOptions } from "../../src/lib/TypeweaverApp";
import type { TypeweaverRouterOptions } from "../../src/lib/TypeweaverRouter";

const failingValidator: IRequestValidator = {
  validate: () => {
    throw new RequestValidationError({
      headerIssues: [{ code: "custom", message: "bad header", path: [] }],
      bodyIssues: [{ code: "custom", message: "bad body", path: [] }],
    });
  },
  safeValidate: () => ({
    isValid: false,
    error: new RequestValidationError(),
  }),
};

const bodyOnlyFailingValidator: IRequestValidator = {
  validate: () => {
    throw new RequestValidationError({
      bodyIssues: [
        {
          code: "invalid_type",
          expected: "string",
          input: 42,
          message: "Expected string",
          path: ["title"],
        },
      ],
    });
  },
  safeValidate: () => ({
    isValid: false,
    error: new RequestValidationError(),
  }),
};

type TestHandlers = {
  handleGetTodos: RequestHandler;
  handleCreateTodo: RequestHandler;
  handleGetTodo: RequestHandler;
};

class TestRouter extends TypeweaverRouter<TestHandlers> {
  constructor(options: TypeweaverRouterOptions<TestHandlers>) {
    super(options);

    this.route(
      HttpMethod.GET,
      "/todos",
      options.validateRequests === false ? noopValidator : failingValidator,
      async (req, ctx) => this.requestHandlers.handleGetTodos(req, ctx)
    );

    this.route(
      HttpMethod.POST,
      "/todos",
      options.validateRequests === false ? noopValidator : failingValidator,
      async (req, ctx) => this.requestHandlers.handleCreateTodo(req, ctx)
    );

    this.route(
      HttpMethod.GET,
      "/todos/:todoId",
      options.validateRequests === false ? noopValidator : failingValidator,
      async (req, ctx) => this.requestHandlers.handleGetTodo(req, ctx)
    );
  }
}

class ValidatingTestRouter extends TypeweaverRouter<TestHandlers> {
  constructor(options: TypeweaverRouterOptions<TestHandlers>) {
    super(options);

    this.route(HttpMethod.POST, "/todos", failingValidator, async (req, ctx) =>
      this.requestHandlers.handleCreateTodo(req, ctx)
    );
  }
}

class BodyOnlyValidatingRouter extends TypeweaverRouter<TestHandlers> {
  constructor(options: TypeweaverRouterOptions<TestHandlers>) {
    super(options);

    this.route(
      HttpMethod.POST,
      "/todos",
      bodyOnlyFailingValidator,
      async (req, ctx) => this.requestHandlers.handleCreateTodo(req, ctx)
    );
  }
}

function defaultHandlers(overrides: Partial<TestHandlers> = {}): TestHandlers {
  return {
    handleGetTodos: async () => ({
      statusCode: 200,
      body: [
        { id: "1", title: "First" },
        { id: "2", title: "Second" },
      ],
    }),
    handleCreateTodo: async req => ({
      statusCode: 201,
      header: { "Content-Type": "application/json" },
      body: { id: "3", title: req.body?.title ?? "Untitled" },
    }),
    handleGetTodo: async (req, _ctx) => ({
      statusCode: 200,
      body: { id: req.param?.todoId ?? "unknown", title: "A Todo" },
    }),
    ...overrides,
  };
}

function createApp(
  routerOptions?: Partial<TypeweaverRouterOptions<TestHandlers>>,
  handlerOverrides?: Partial<TestHandlers>,
  appOptions?: TypeweaverAppOptions
): TypeweaverApp {
  const app = new TypeweaverApp(appOptions);
  const router = new TestRouter({
    validateRequests: false,
    requestHandlers: defaultHandlers(handlerOverrides),
    ...routerOptions,
  });
  app.route(router);
  return app;
}

function createValidatingApp(
  routerOptions?: Partial<TypeweaverRouterOptions<TestHandlers>>,
  handlerOverrides?: Partial<TestHandlers>,
  appOptions?: TypeweaverAppOptions
): TypeweaverApp {
  const app = new TypeweaverApp(appOptions);
  const router = new ValidatingTestRouter({
    requestHandlers: defaultHandlers(handlerOverrides),
    ...routerOptions,
  });
  app.route(router);
  return app;
}

describe("TypeweaverApp", () => {
  describe("Route Matching", () => {
    test("should handle GET request to static path", async () => {
      const app = createApp();

      const res = await app.fetch(get("/todos"));

      const data = await expectJson(res, 200);
      expect(data).toHaveLength(2);
    });

    test("should handle POST request", async () => {
      const app = createApp();

      const res = await app.fetch(post("/todos", { title: "New Todo" }));

      const data = await expectJson(res, 201);
      expect(data.title).toBe("New Todo");
    });

    test("should extract path parameters", async () => {
      const app = createApp();

      const res = await app.fetch(get("/todos/todo-42"));

      const data = await expectJson(res, 200);
      expect(data.id).toBe("todo-42");
    });

    test("should return 404 for unregistered paths", async () => {
      const app = createApp();

      const res = await app.fetch(get("/nonexistent"));

      await expectErrorResponse(res, 404, "NOT_FOUND");
    });

    test("should return 405 for wrong HTTP method on existing path", async () => {
      const app = createApp();

      const res = await app.fetch(del("/todos"));

      await expectErrorResponse(res, 405, "METHOD_NOT_ALLOWED");
      const allow = res.headers.get("allow");
      expect(allow).toContain("GET");
      expect(allow).toContain("POST");
      expect(allow).toContain("HEAD");
    });

    test("should return 405 with correct Allow header for parameterized paths", async () => {
      const app = createApp();

      const res = await app.fetch(put("/todos/t1"));

      expect(res.status).toBe(405);
      const allow = res.headers.get("allow");
      expect(allow).toContain("GET");
      expect(allow).toContain("HEAD");
    });
  });

  describe("HEAD Request Support", () => {
    test("should handle HEAD request by falling back to GET handler", async () => {
      const app = createApp();

      const res = await app.fetch(head("/todos"));

      expect(res.status).toBe(200);
      const body = await res.text();
      expect(body).toBe("");
    });

    test("should handle HEAD request for parameterized paths", async () => {
      const app = createApp();

      const res = await app.fetch(head("/todos/t1"));

      expect(res.status).toBe(200);
      const body = await res.text();
      expect(body).toBe("");
    });

    test("should preserve response headers for HEAD request", async () => {
      const app = createApp(undefined, {
        handleGetTodos: async () => ({
          statusCode: 200,
          header: { "X-Custom": "value" },
          body: [{ id: "1" }],
        }),
      });

      const res = await app.fetch(head("/todos"));

      expect(res.status).toBe(200);
      expect(res.headers.get("x-custom")).toBe("value");
      const body = await res.text();
      expect(body).toBe("");
    });

    test("should return 404 for HEAD request on nonexistent path", async () => {
      const app = createApp();

      const res = await app.fetch(head("/nonexistent"));

      expect(res.status).toBe(404);
    });
  });

  describe("Middleware", () => {
    test("should execute global middleware for all requests", async () => {
      const app = createApp();
      const seen: string[] = [];

      app.use(async (ctx, next) => {
        seen.push(ctx.request.path);
        return next();
      });

      await app.fetch(get("/todos"));
      await app.fetch(get("/todos/t1"));

      expect(seen).toEqual(["/todos", "/todos/t1"]);
    });

    test("should execute path-scoped middleware only for matching paths", async () => {
      const app = new TypeweaverApp();
      const router = new TestRouter({
        validateRequests: false,
        requestHandlers: defaultHandlers(),
      });
      app.route(router);

      const scoped: string[] = [];

      app.use("/todos/*", async (ctx, next) => {
        scoped.push(ctx.request.path);
        return next();
      });

      await app.fetch(get("/todos"));
      await app.fetch(get("/todos/t1"));

      expect(scoped).toEqual(["/todos", "/todos/t1"]);
    });

    test("should allow middleware to short-circuit with a response", async () => {
      const app = createApp();

      app.use(async () => ({
        statusCode: 503,
        body: { message: "Service Unavailable" },
      }));

      const res = await app.fetch(get("/todos"));

      expect(res.status).toBe(503);
    });

    test("should allow middleware to modify response", async () => {
      const app = createApp();

      app.use(async (_ctx, next) => {
        const response = await next();
        return {
          ...response,
          header: {
            ...response.header,
            "x-request-id": "req-001",
          },
        };
      });

      const res = await app.fetch(get("/todos"));

      expect(res.status).toBe(200);
      expect(res.headers.get("x-request-id")).toBe("req-001");
    });

    test("should pass state between middleware and handler", async () => {
      const app = new TypeweaverApp();
      const router = new TestRouter({
        validateRequests: false,
        requestHandlers: {
          ...defaultHandlers(),
          handleGetTodos: async (_req, ctx) => ({
            statusCode: 200,
            body: { userId: ctx.state.get("userId") },
          }),
        },
      });
      app.route(router);

      app.use(async (ctx, next) => {
        ctx.state.set("userId", "user-99");
        return next();
      });

      const res = await app.fetch(get("/todos"));

      const data = await expectJson(res, 200);
      expect(data.userId).toBe("user-99");
    });

    test("should execute global middleware even for 404 requests", async () => {
      const app = createApp();
      const seen: string[] = [];

      app.use(async (ctx, next) => {
        seen.push(ctx.request.path);
        return next();
      });

      const res = await app.fetch(get("/nonexistent"));

      expect(res.status).toBe(404);
      expect(seen).toContain("/nonexistent");
    });

    test("should execute global middleware even for 405 requests", async () => {
      const app = createApp();
      const seen: string[] = [];

      app.use(async (ctx, next) => {
        seen.push(`${ctx.request.method} ${ctx.request.path}`);
        return next();
      });

      const res = await app.fetch(del("/todos"));

      expect(res.status).toBe(405);
      expect(seen).toContain("DELETE /todos");
    });

    test("should execute multiple global middlewares in registration order", async () => {
      const app = createApp();
      const order: number[] = [];

      app.use(async (_ctx, next) => { order.push(1); const r = await next(); order.push(6); return r; });
      app.use(async (_ctx, next) => { order.push(2); const r = await next(); order.push(5); return r; });
      app.use(async (_ctx, next) => { order.push(3); const r = await next(); order.push(4); return r; });

      await app.fetch(get("/todos"));

      expect(order).toEqual([1, 2, 3, 4, 5, 6]);
    });

    test("should allow middleware to intercept 404 responses", async () => {
      const app = createApp();

      app.use(async (_ctx, next) => {
        const response = await next();
        if (response.statusCode === 404) {
          return {
            statusCode: 404,
            body: { custom: true, message: "Custom not found" },
          };
        }
        return response;
      });

      const res = await app.fetch(get("/nonexistent"));

      const data = await expectJson(res, 404);
      expect(data.custom).toBe(true);
    });
  });

  describe("Router Prefix", () => {
    test("should mount router with prefix", async () => {
      const app = new TypeweaverApp();
      const router = new TestRouter({
        validateRequests: false,
        requestHandlers: defaultHandlers(),
      });

      app.route("/api/v1", router);

      const res = await app.fetch(get("/api/v1/todos"));

      const data = await expectJson(res, 200);
      expect(data).toHaveLength(2);
    });

    test("should not match unprefixed path when prefix is used", async () => {
      const app = new TypeweaverApp();
      const router = new TestRouter({
        validateRequests: false,
        requestHandlers: defaultHandlers(),
      });

      app.route("/api/v1", router);

      const res = await app.fetch(get("/todos"));

      expect(res.status).toBe(404);
    });

    test("should extract path params with prefix", async () => {
      const app = new TypeweaverApp();
      const router = new TestRouter({
        validateRequests: false,
        requestHandlers: defaultHandlers(),
      });

      app.route("/api", router);

      const res = await app.fetch(get("/api/todos/my-todo"));

      const data = await expectJson(res, 200);
      expect(data.id).toBe("my-todo");
    });

    test("should normalize trailing slashes on prefix", async () => {
      const app = new TypeweaverApp();
      const router = new TestRouter({
        validateRequests: false,
        requestHandlers: defaultHandlers(),
      });

      app.route("/api/v1/", router);

      const res = await app.fetch(get("/api/v1/todos"));

      expect(res.status).toBe(200);
    });
  });

  describe("Multiple Routers", () => {
    test("should support mounting multiple routers", async () => {
      type UserHandlers = {
        handleGetUsers: RequestHandler;
      };

      class UserRouter extends TypeweaverRouter<UserHandlers> {
        constructor(options: TypeweaverRouterOptions<UserHandlers>) {
          super(options);
          this.route(
            HttpMethod.GET,
            "/users",
            noopValidator,
            async (req, ctx) => this.requestHandlers.handleGetUsers(req, ctx)
          );
        }
      }

      const app = new TypeweaverApp();

      app.route(
        new TestRouter({
          validateRequests: false,
          requestHandlers: defaultHandlers(),
        })
      );

      app.route(
        new UserRouter({
          requestHandlers: {
            handleGetUsers: async () => ({
              statusCode: 200,
              body: [{ id: "u1", name: "Alice" }],
            }),
          },
        })
      );

      const todosRes = await app.fetch(get("/todos"));
      expect(todosRes.status).toBe(200);

      const usersRes = await app.fetch(get("/users"));
      const users = await expectJson(usersRes, 200);
      expect(users[0].name).toBe("Alice");
    });
  });

  describe("Error Handling", () => {
    test("should handle validation errors with default handler and not call onError", async () => {
      const onError = vi.fn();
      const app = createValidatingApp(undefined, undefined, { onError });

      const res = await app.fetch(post("/todos", { title: "bad" }));

      const data = await expectErrorResponse(res, 400, "VALIDATION_ERROR");
      expect(data.issues).toBeDefined();
      expect(data.issues.header[0]).toEqual({
        message: "bad header",
        path: [],
      });
      expect(data.issues.header[0]).not.toHaveProperty("code");
      expect(data.issues.body[0]).toEqual({ message: "bad body", path: [] });
      expect(data.issues.body[0]).not.toHaveProperty("code");
      expect(onError).not.toHaveBeenCalled();
    });

    test("should omit empty issue categories from sanitized response", async () => {
      const app = new TypeweaverApp();
      const router = new BodyOnlyValidatingRouter({
        requestHandlers: defaultHandlers(),
      });
      app.route(router);

      const res = await app.fetch(post("/todos", { title: 123 }));

      const data = await expectErrorResponse(res, 400, "VALIDATION_ERROR");
      expect(data.issues.body).toHaveLength(1);
      expect(data.issues.body[0]).toEqual({
        message: "Expected string",
        path: ["title"],
      });
      expect(data.issues.body[0]).not.toHaveProperty("code");
      expect(data.issues.body[0]).not.toHaveProperty("expected");
      expect(data.issues.body[0]).not.toHaveProperty("input");
      expect(data.issues.header).toBeUndefined();
      expect(data.issues.query).toBeUndefined();
      expect(data.issues.param).toBeUndefined();
    });

    test("should handle validation errors with custom handler", async () => {
      const app = createValidatingApp({
        handleValidationErrors: async err => ({
          statusCode: 422,
          body: { custom: true, message: err.message },
        }),
      });

      const res = await app.fetch(post("/todos", {}));

      const data = await expectJson(res, 422);
      expect(data.custom).toBe(true);
    });

    test("should handle HttpResponse errors with default handler and not call onError", async () => {
      const onError = vi.fn();
      const app = createApp(
        undefined,
        {
          handleCreateTodo: async () => {
            throw new HttpResponse(409, {}, { code: "CONFLICT" });
          },
        },
        { onError }
      );

      const res = await app.fetch(post("/todos", { title: "dup" }));

      await expectErrorResponse(res, 409, "CONFLICT");
      expect(onError).not.toHaveBeenCalled();
    });

    test("should handle HttpResponse errors with custom handler", async () => {
      const app = createApp(
        {
          handleHttpResponseErrors: async err => ({
            statusCode: err.statusCode,
            body: { wrapped: true, original: err.body },
          }),
        },
        {
          handleCreateTodo: async () => {
            throw new HttpResponse(409, {}, { code: "CONFLICT" });
          },
        }
      );

      const res = await app.fetch(post("/todos", {}));

      const data = await expectJson(res, 409);
      expect(data.wrapped).toBe(true);
    });

    test("should handle unknown errors with default handler and call onError", async () => {
      const onError = vi.fn();
      const app = createApp(
        undefined,
        {
          handleGetTodos: async () => {
            throw new Error("Unexpected failure");
          },
        },
        { onError }
      );

      const res = await app.fetch(get("/todos"));

      await expectErrorResponse(res, 500, "INTERNAL_SERVER_ERROR");
      expect(onError).toHaveBeenCalledOnce();
      expect(onError).toHaveBeenCalledWith(expect.any(Error));
    });

    test("should handle unknown errors with custom handler", async () => {
      const app = createApp(
        {
          handleUnknownErrors: async (err, _ctx) => ({
            statusCode: 500,
            body: {
              custom: true,
              message: err instanceof Error ? err.message : "Unknown",
            },
          }),
        },
        {
          handleGetTodos: async () => {
            throw new Error("Boom");
          },
        }
      );

      const res = await app.fetch(get("/todos"));

      const data = await expectJson(res, 500);
      expect(data.custom).toBe(true);
      expect(data.message).toBe("Boom");
    });

    test("should call onError for errors that escape to the safety net", async () => {
      const onError = vi.fn();
      const app = createApp(
        { handleUnknownErrors: false },
        {
          handleGetTodos: async () => {
            throw new Error("Unhandled");
          },
        },
        { onError }
      );

      const res = await app.fetch(get("/todos"));

      expect(res.status).toBe(500);
      expect(onError).toHaveBeenCalledOnce();
    });

    test("should bubble RequestValidationError to safety net when both validation and unknown handlers are disabled", async () => {
      const onError = vi.fn();
      const app = createValidatingApp(
        {
          handleValidationErrors: false,
          handleUnknownErrors: false,
        },
        undefined,
        { onError }
      );

      const res = await app.fetch(post("/todos", {}));

      await expectErrorResponse(res, 500, "INTERNAL_SERVER_ERROR");
      expect(onError).toHaveBeenCalledOnce();
      expect(onError).toHaveBeenCalledWith(expect.any(RequestValidationError));
    });

    test("should bubble HttpResponse to safety net when both http response and unknown handlers are disabled", async () => {
      const onError = vi.fn();
      const app = createApp(
        {
          handleHttpResponseErrors: false,
          handleUnknownErrors: false,
        },
        {
          handleCreateTodo: async () => {
            throw new HttpResponse(409, {}, { code: "CONFLICT" });
          },
        },
        { onError }
      );

      const res = await app.fetch(post("/todos", { title: "dup" }));

      await expectErrorResponse(res, 500, "INTERNAL_SERVER_ERROR");
      expect(onError).toHaveBeenCalledOnce();
      expect(onError).toHaveBeenCalledWith(expect.any(HttpResponse));
    });

    test("should return 500 when error handler throws", async () => {
      const app = createValidatingApp({
        handleValidationErrors: () => {
          throw new Error("Handler crashed");
        },
      });

      const res = await app.fetch(post("/todos", {}));

      await expectErrorResponse(res, 500, "INTERNAL_SERVER_ERROR");
    });

    test("should still return 500 when onError throws", async () => {
      const app = createApp(
        undefined,
        {
          handleGetTodos: async () => {
            throw new Error("Unexpected failure");
          },
        },
        {
          onError: () => {
            throw new Error("Observer crashed");
          },
        }
      );

      const res = await app.fetch(get("/todos"));

      await expectErrorResponse(res, 500, "INTERNAL_SERVER_ERROR");
    });

    test("should call console.error as last-resort when onError throws in safety net", async () => {
      const spy = vi.spyOn(console, "error").mockImplementation(vi.fn());
      const originalError = new Error("Unexpected failure");
      const onErrorFailure = new Error("Observer crashed");
      const app = createApp(
        undefined,
        {
          handleGetTodos: async () => {
            throw originalError;
          },
        },
        {
          onError: () => {
            throw onErrorFailure;
          },
        }
      );

      await app.fetch(get("/todos"));

      expect(spy).toHaveBeenCalledWith(
        "TypeweaverApp: onError callback threw while handling error",
        { onErrorFailure, originalError }
      );
      spy.mockRestore();
    });

    test("should call console.error as last-resort when onError throws in defaultUnknownHandler", async () => {
      const spy = vi.spyOn(console, "error").mockImplementation(vi.fn());
      const originalError = new Error("Handler failure");
      const onErrorFailure = new Error("onError crashed");
      const app = createApp(
        undefined,
        {
          handleGetTodos: async () => {
            throw originalError;
          },
        },
        {
          onError: () => {
            throw onErrorFailure;
          },
        }
      );

      const res = await app.fetch(get("/todos"));

      expect(res.status).toBe(500);
      expect(spy).toHaveBeenCalledWith(
        "TypeweaverApp: onError callback threw while handling error",
        { onErrorFailure, originalError }
      );
      spy.mockRestore();
    });

    test("should return 500 for completely malformed request URL", async () => {
      const app = createApp();

      const badRequest = get("/todos");
      Object.defineProperty(badRequest, "url", { value: "not-a-valid-url" });

      const res = await app.fetch(badRequest);

      await expectErrorResponse(res, 500, "INTERNAL_SERVER_ERROR");
    });

    test("should return 400 for malformed JSON body", async () => {
      const app = createApp();

      const res = await app.fetch(
        postRaw("/todos", "{ invalid json", "application/json")
      );

      const data = await expectErrorResponse(res, 400, "BAD_REQUEST");
      expect(data.message).toContain("Invalid JSON");
    });

    test("should NOT call onError for handled BodyParseError", async () => {
      const onError = vi.fn();
      const app = createApp(undefined, undefined, { onError });

      const res = await app.fetch(
        postRaw("/todos", "{ invalid json", "application/json")
      );

      expect(res.status).toBe(400);
      expect(onError).not.toHaveBeenCalled();
    });

    test("should call onError for PayloadTooLargeError", async () => {
      const onError = vi.fn();
      const app = createApp(undefined, undefined, {
        maxBodySize: 50,
        onError,
      });

      const res = await app.fetch(
        postRaw("/todos", "x".repeat(100), "text/plain")
      );

      expect(res.status).toBe(413);
      expect(onError).toHaveBeenCalledOnce();
      expect(onError).toHaveBeenCalledWith(expect.any(PayloadTooLargeError));
    });

    test("should default onError to console.error", async () => {
      const spy = vi.spyOn(console, "error").mockImplementation(vi.fn());
      const app = createApp(undefined, {
        handleGetTodos: async () => {
          throw new Error("should be logged");
        },
      });

      await app.fetch(get("/todos"));

      expect(spy).toHaveBeenCalledOnce();
      spy.mockRestore();
    });

    test("should handle errors thrown inside middleware", async () => {
      const onError = vi.fn();
      const app = createApp(undefined, undefined, { onError });

      app.use(async () => { throw new Error("middleware boom"); });

      const res = await app.fetch(get("/todos"));

      await expectErrorResponse(res, 500, "INTERNAL_SERVER_ERROR");
      expect(onError).toHaveBeenCalledOnce();
    });
  });

  describe("Response Conversion", () => {
    test("should set Content-Type to application/json for object bodies", async () => {
      const app = createApp();

      const res = await app.fetch(get("/todos"));

      expect(res.headers.get("content-type")).toBe("application/json");
    });

    test("should handle empty response bodies", async () => {
      const app = createApp(undefined, {
        handleGetTodos: async () => ({ statusCode: 204 }),
      });

      const res = await app.fetch(get("/todos"));

      expect(res.status).toBe(204);
      const text = await res.text();
      expect(text).toBe("");
    });

    test("should preserve custom response headers", async () => {
      const app = createApp(undefined, {
        handleGetTodos: async () => ({
          statusCode: 200,
          header: {
            "X-Custom": "value",
            "X-Multi": ["a", "b"],
          },
          body: {},
        }),
      });

      const res = await app.fetch(get("/todos"));

      expect(res.headers.get("x-custom")).toBe("value");
      expect(res.headers.get("x-multi")).toContain("a");
      expect(res.headers.get("x-multi")).toContain("b");
    });

    test("should return string body without auto-setting Content-Type to JSON", async () => {
      const app = createApp(undefined, {
        handleGetTodos: async () => ({ statusCode: 200, body: "plain text" }),
      });
      const res = await app.fetch(get("/todos"));

      expect(res.status).toBe(200);
      expect(await res.text()).toBe("plain text");
      expect(res.headers.get("content-type")).not.toBe("application/json");
    });

    test("should preserve explicit Content-Type for string body", async () => {
      const app = createApp(undefined, {
        handleGetTodos: async () => ({
          statusCode: 200,
          header: { "Content-Type": "text/plain" },
          body: "plain text",
        }),
      });
      const res = await app.fetch(get("/todos"));

      expect(res.headers.get("content-type")).toBe("text/plain");
      expect(await res.text()).toBe("plain text");
    });
  });

  describe("Body Size Limit", () => {
    test("should return 413 for oversized body with maxBodySize set", async () => {
      const app = createApp(undefined, undefined, {
        maxBodySize: 50,
        onError: vi.fn(),
      });
      const res = await app.fetch(
        postRaw("/todos", "x".repeat(100), "text/plain")
      );

      await expectErrorResponse(res, 413, "PAYLOAD_TOO_LARGE");
    });

    test("should accept normal bodies within the limit", async () => {
      const app = createApp(undefined, undefined, {
        maxBodySize: 10000,
        onError: vi.fn(),
      });

      const res = await app.fetch(post("/todos", { title: "New Todo" }));

      expect(res.status).toBe(201);
    });

    test("should use 1 MB default when maxBodySize is not configured", async () => {
      const app = createApp();

      const res = await app.fetch(post("/todos", { title: "Large" }));

      expect(res.status).toBe(201);
    });

    test("should return 413 for oversized body without Content-Length header", async () => {
      const app = createApp(undefined, undefined, {
        maxBodySize: 50,
        onError: vi.fn(),
      });
      const request = new Request(BASE_URL + "/todos", {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: "x".repeat(100),
      });
      request.headers.delete("content-length");

      const res = await app.fetch(request);

      await expectErrorResponse(res, 413, "PAYLOAD_TOO_LARGE");
    });
  });

  describe("Fluent API", () => {
    test("should return this from use() for chaining", () => {
      const app = new TypeweaverApp();

      expect(app.use(async (_ctx, next) => next())).toBe(app);
    });

    test("should return this from route() for chaining", () => {
      const app = new TypeweaverApp();
      const router = new TestRouter({ requestHandlers: defaultHandlers() });

      expect(app.route(router)).toBe(app);
    });

    test("should return this from route() with prefix for chaining", () => {
      const app = new TypeweaverApp();
      const router = new TestRouter({ requestHandlers: defaultHandlers() });

      expect(app.route("/api", router)).toBe(app);
    });
  });

  describe("Request Validation", () => {
    test("should skip validation when validateRequests is false", async () => {
      const app = createApp({ validateRequests: false });
      const res = await app.fetch(post("/todos", { title: "Valid" }));
      await expectJson(res, 201);
    });

    test("should enforce validation when validateRequests is true", async () => {
      const app = createApp({ validateRequests: true });
      const res = await app.fetch(post("/todos", { title: "Any" }));
      await expectErrorResponse(res, 400, "VALIDATION_ERROR");
    });
  });

  describe("Defensive Validation", () => {
    test("should throw when use() is called with path but no middleware", () => {
      const app = new TypeweaverApp();
      // @ts-expect-error — testing runtime guard
      expect(() => app.use("/path")).toThrow(
        "Middleware handler is required when registering path-scoped middleware"
      );
    });

    test("should throw when route() is called with prefix but no router", () => {
      const app = new TypeweaverApp();
      // @ts-expect-error — testing runtime guard
      expect(() => app.route("/prefix")).toThrow(
        "Router is required when mounting with a prefix"
      );
    });
  });

  describe("Error Handler Fallthrough", () => {
    test("should fall through to unknown handler when validation handler is disabled", async () => {
      const unknownHandler = vi.fn((_err: unknown) => ({
        statusCode: 500,
        body: { code: "CUSTOM_UNKNOWN", message: "Caught by unknown handler" },
      }));
      const app = createValidatingApp({
        handleValidationErrors: false,
        handleUnknownErrors: unknownHandler,
      });

      const res = await app.fetch(post("/todos", {}));

      await expectErrorResponse(res, 500, "CUSTOM_UNKNOWN");
      expect(unknownHandler).toHaveBeenCalledOnce();
      expect(unknownHandler).toHaveBeenCalledWith(
        expect.any(RequestValidationError),
        expect.anything()
      );
    });

    test("should fall through to unknown handler when HttpResponse handler is disabled", async () => {
      const unknownHandler = vi.fn((_err: unknown) => ({
        statusCode: 500,
        body: { code: "CUSTOM_UNKNOWN", message: "Caught by unknown handler" },
      }));
      const app = createApp(
        {
          handleHttpResponseErrors: false,
          handleUnknownErrors: unknownHandler,
        },
        {
          handleCreateTodo: async () => {
            throw new HttpResponse(409, {}, { code: "CONFLICT" });
          },
        }
      );

      const res = await app.fetch(post("/todos", {}));

      await expectErrorResponse(res, 500, "CUSTOM_UNKNOWN");
      expect(unknownHandler).toHaveBeenCalledOnce();
      expect(unknownHandler).toHaveBeenCalledWith(
        expect.any(HttpResponse),
        expect.anything()
      );
    });

    test("should return 500 via handler path when defaultUnknownHandler onError throws", async () => {
      const spy = vi.spyOn(console, "error").mockImplementation(vi.fn());
      const app = createApp(
        undefined,
        {
          handleGetTodos: async () => {
            throw new Error("Handler failure");
          },
        },
        {
          onError: () => {
            throw new Error("onError also failed");
          },
        }
      );

      const res = await app.fetch(get("/todos"));

      await expectErrorResponse(res, 500, "INTERNAL_SERVER_ERROR");
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });
  });

  describe("Concurrent Request Isolation", () => {
    test("should isolate state across concurrent requests", async () => {
      const app = new TypeweaverApp();
      const router = new TestRouter({
        validateRequests: false,
        requestHandlers: {
          ...defaultHandlers(),
          handleGetTodo: async (_req, ctx) => {
            const id = _req.param?.todoId ?? "unknown";
            ctx.state.set("id", id);
            await new Promise(r => setTimeout(r, 5));
            return {
              statusCode: 200,
              body: { id, stateId: ctx.state.get("id") },
            };
          },
        },
      });
      app.route(router);

      const results = await Promise.all(
        Array.from({ length: 10 }, (_, i) =>
          app.fetch(get(`/todos/todo-${i}`)).then(r => r.json())
        )
      );

      for (let i = 0; i < 10; i++) {
        expect(results[i].id).toBe(`todo-${i}`);
        expect(results[i].stateId).toBe(`todo-${i}`);
      }
    });
  });

  describe("Middleware Error Propagation", () => {
    test("should propagate errors thrown after next() resolves", async () => {
      const onError = vi.fn();
      const app = createApp(undefined, undefined, { onError });

      app.use(async (_ctx, next) => {
        await next();
        throw new Error("Post-next failure");
      });

      const res = await app.fetch(get("/todos"));

      await expectErrorResponse(res, 500, "INTERNAL_SERVER_ERROR");
      expect(onError).toHaveBeenCalledOnce();
    });

    test("should not trigger path-scoped middleware for non-matching paths", async () => {
      const app = createApp();
      const scoped = vi.fn();

      app.use("/admin/*", async (_ctx, next) => {
        scoped();
        return next();
      });

      await app.fetch(get("/todos"));

      expect(scoped).not.toHaveBeenCalled();
    });
  });

  describe("Form URL-Encoded Edge Cases", () => {
    test("should handle multi-value fields in form-urlencoded body", async () => {
      const app = new TypeweaverApp();
      const router = new TestRouter({
        validateRequests: false,
        requestHandlers: {
          ...defaultHandlers(),
          handleCreateTodo: async req => ({
            statusCode: 200,
            body: req.body,
          }),
        },
      });
      app.route(router);

      const request = new Request(BASE_URL + "/todos", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: "tags=a&tags=b&tags=c",
      });

      const res = await app.fetch(request);
      const data = await expectJson(res, 200);
      expect(data.tags).toEqual(["a", "b", "c"]);
    });
  });
});
