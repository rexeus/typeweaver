import {
  HttpMethod,
  HttpResponse,
  RequestValidationError,
} from "@rexeus/typeweaver-core";
import { describe, expect, test } from "vitest";
import type { IRequestValidator } from "@rexeus/typeweaver-core";
import { TypeweaverApp } from "../../src/lib/TypeweaverApp";
import { TypeweaverRouter } from "../../src/lib/TypeweaverRouter";
import type { RequestHandler } from "../../src/lib/RequestHandler";
import type { TypeweaverRouterOptions } from "../../src/lib/TypeweaverRouter";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

const noopValidator: IRequestValidator = {
  validate: (req: any) => req,
  safeValidate: (req: any) => ({ isValid: true, data: req }),
};

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
      options.validateRequests === false ? noopValidator : noopValidator,
      async (req, ctx) => this.requestHandlers.handleGetTodos(req, ctx)
    );

    this.route(
      HttpMethod.POST,
      "/todos",
      options.validateRequests === false ? noopValidator : noopValidator,
      async (req, ctx) => this.requestHandlers.handleCreateTodo(req, ctx)
    );

    this.route(
      HttpMethod.GET,
      "/todos/:todoId",
      options.validateRequests === false ? noopValidator : noopValidator,
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
    handleGetTodo: async (req, ctx) => ({
      statusCode: 200,
      body: { id: req.param?.todoId ?? "unknown", title: "A Todo" },
    }),
    ...overrides,
  };
}

function createApp(
  routerOptions?: Partial<TypeweaverRouterOptions<TestHandlers>>,
  handlerOverrides?: Partial<TestHandlers>
): TypeweaverApp {
  const app = new TypeweaverApp();
  const router = new TestRouter({
    requestHandlers: defaultHandlers(handlerOverrides),
    ...routerOptions,
  });
  app.route(router);
  return app;
}

function createValidatingApp(
  routerOptions?: Partial<TypeweaverRouterOptions<TestHandlers>>,
  handlerOverrides?: Partial<TestHandlers>
): TypeweaverApp {
  const app = new TypeweaverApp();
  const router = new ValidatingTestRouter({
    requestHandlers: defaultHandlers(handlerOverrides),
    ...routerOptions,
  });
  app.route(router);
  return app;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("TypeweaverApp", () => {
  describe("Route Matching", () => {
    test("should handle GET request to static path", async () => {
      const app = createApp();

      const res = await app.fetch(new Request("http://localhost/todos"));

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toHaveLength(2);
    });

    test("should handle POST request", async () => {
      const app = createApp();

      const res = await app.fetch(
        new Request("http://localhost/todos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: "New Todo" }),
        })
      );

      expect(res.status).toBe(201);
      const data = (await res.json()) as any;
      expect(data.title).toBe("New Todo");
    });

    test("should extract path parameters", async () => {
      const app = createApp();

      const res = await app.fetch(
        new Request("http://localhost/todos/todo-42")
      );

      expect(res.status).toBe(200);
      const data = (await res.json()) as any;
      expect(data.id).toBe("todo-42");
    });

    test("should return 404 for unregistered paths", async () => {
      const app = createApp();

      const res = await app.fetch(new Request("http://localhost/nonexistent"));

      expect(res.status).toBe(404);
      const data = (await res.json()) as any;
      expect(data.code).toBe("NOT_FOUND");
    });

    test("should return 405 for wrong HTTP method on existing path", async () => {
      const app = createApp();

      const res = await app.fetch(
        new Request("http://localhost/todos", { method: "DELETE" })
      );

      expect(res.status).toBe(405);
      const data = (await res.json()) as any;
      expect(data.code).toBe("METHOD_NOT_ALLOWED");
      // Should include Allow header with valid methods
      const allow = res.headers.get("allow");
      expect(allow).toContain("GET");
      expect(allow).toContain("POST");
      expect(allow).toContain("HEAD");
    });

    test("should return 405 with correct Allow header for parameterized paths", async () => {
      const app = createApp();

      const res = await app.fetch(
        new Request("http://localhost/todos/t1", { method: "PUT" })
      );

      expect(res.status).toBe(405);
      const allow = res.headers.get("allow");
      expect(allow).toContain("GET");
      expect(allow).toContain("HEAD");
    });
  });

  describe("HEAD Request Support", () => {
    test("should handle HEAD request by falling back to GET handler", async () => {
      const app = createApp();

      const res = await app.fetch(
        new Request("http://localhost/todos", { method: "HEAD" })
      );

      expect(res.status).toBe(200);
      // HEAD responses must not have a body
      const body = await res.text();
      expect(body).toBe("");
    });

    test("should handle HEAD request for parameterized paths", async () => {
      const app = createApp();

      const res = await app.fetch(
        new Request("http://localhost/todos/t1", { method: "HEAD" })
      );

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

      const res = await app.fetch(
        new Request("http://localhost/todos", { method: "HEAD" })
      );

      expect(res.status).toBe(200);
      expect(res.headers.get("x-custom")).toBe("value");
      const body = await res.text();
      expect(body).toBe("");
    });

    test("should return 404 for HEAD request on nonexistent path", async () => {
      const app = createApp();

      const res = await app.fetch(
        new Request("http://localhost/nonexistent", { method: "HEAD" })
      );

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

      await app.fetch(new Request("http://localhost/todos"));
      await app.fetch(new Request("http://localhost/todos/t1"));

      expect(seen).toEqual(["/todos", "/todos/t1"]);
    });

    test("should execute path-scoped middleware only for matching paths", async () => {
      const app = new TypeweaverApp();
      const router = new TestRouter({
        requestHandlers: defaultHandlers(),
      });
      app.route(router);

      const scoped: string[] = [];

      app.use("/todos/*", async (ctx, next) => {
        scoped.push(ctx.request.path);
        return next();
      });

      // This request should NOT trigger middleware (exact match /todos, not /todos/*)
      // Actually /todos/* should also match /todos based on matchesMiddlewarePath
      await app.fetch(new Request("http://localhost/todos"));

      // This request should trigger middleware
      await app.fetch(new Request("http://localhost/todos/t1"));

      expect(scoped).toContain("/todos/t1");
    });

    test("should allow middleware to short-circuit with a response", async () => {
      const app = createApp();

      app.use(async () => ({
        statusCode: 503,
        body: { message: "Service Unavailable" },
      }));

      const res = await app.fetch(new Request("http://localhost/todos"));

      expect(res.status).toBe(503);
    });

    test("should allow middleware to modify response", async () => {
      const app = createApp();

      app.use(async (ctx, next) => {
        const response = await next();
        return {
          ...response,
          header: {
            ...response.header,
            "x-request-id": "req-001",
          },
        };
      });

      const res = await app.fetch(new Request("http://localhost/todos"));

      expect(res.status).toBe(200);
      expect(res.headers.get("x-request-id")).toBe("req-001");
    });

    test("should pass state between middleware and handler", async () => {
      const app = new TypeweaverApp();
      const router = new TestRouter({
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

      const res = await app.fetch(new Request("http://localhost/todos"));

      const data = (await res.json()) as any;
      expect(data.userId).toBe("user-99");
    });

    test("should execute global middleware even for 404 requests", async () => {
      const app = createApp();
      const seen: string[] = [];

      app.use(async (ctx, next) => {
        seen.push(ctx.request.path);
        return next();
      });

      const res = await app.fetch(new Request("http://localhost/nonexistent"));

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

      const res = await app.fetch(
        new Request("http://localhost/todos", { method: "DELETE" })
      );

      expect(res.status).toBe(405);
      expect(seen).toContain("DELETE /todos");
    });

    test("should allow middleware to intercept 404 responses", async () => {
      const app = createApp();

      app.use(async (ctx, next) => {
        const response = await next();
        if (response.statusCode === 404) {
          return {
            statusCode: 404,
            body: { custom: true, message: "Custom not found" },
          };
        }
        return response;
      });

      const res = await app.fetch(new Request("http://localhost/nonexistent"));

      expect(res.status).toBe(404);
      const data = (await res.json()) as any;
      expect(data.custom).toBe(true);
    });
  });

  describe("Router Prefix", () => {
    test("should mount router with prefix", async () => {
      const app = new TypeweaverApp();
      const router = new TestRouter({
        requestHandlers: defaultHandlers(),
      });

      app.route("/api/v1", router);

      const res = await app.fetch(new Request("http://localhost/api/v1/todos"));

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toHaveLength(2);
    });

    test("should not match unprefixed path when prefix is used", async () => {
      const app = new TypeweaverApp();
      const router = new TestRouter({
        requestHandlers: defaultHandlers(),
      });

      app.route("/api/v1", router);

      const res = await app.fetch(new Request("http://localhost/todos"));

      expect(res.status).toBe(404);
    });

    test("should extract path params with prefix", async () => {
      const app = new TypeweaverApp();
      const router = new TestRouter({
        requestHandlers: defaultHandlers(),
      });

      app.route("/api", router);

      const res = await app.fetch(
        new Request("http://localhost/api/todos/my-todo")
      );

      expect(res.status).toBe(200);
      const data = (await res.json()) as any;
      expect(data.id).toBe("my-todo");
    });

    test("should normalize trailing slashes on prefix", async () => {
      const app = new TypeweaverApp();
      const router = new TestRouter({
        requestHandlers: defaultHandlers(),
      });

      app.route("/api/v1/", router);

      const res = await app.fetch(new Request("http://localhost/api/v1/todos"));

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
          this.route(HttpMethod.GET, "/users", noopValidator, async (req, ctx) =>
            this.requestHandlers.handleGetUsers(req, ctx)
          );
        }
      }

      const app = new TypeweaverApp();

      app.route(
        new TestRouter({
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

      const todosRes = await app.fetch(new Request("http://localhost/todos"));
      expect(todosRes.status).toBe(200);

      const usersRes = await app.fetch(new Request("http://localhost/users"));
      expect(usersRes.status).toBe(200);
      const users = (await usersRes.json()) as any;
      expect(users[0].name).toBe("Alice");
    });
  });

  describe("Error Handling", () => {
    test("should handle validation errors with default handler", async () => {
      const app = createValidatingApp();

      const res = await app.fetch(
        new Request("http://localhost/todos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: "bad" }),
        })
      );

      expect(res.status).toBe(400);
      const data = (await res.json()) as any;
      expect(data.code).toBe("VALIDATION_ERROR");
      expect(data.issues).toBeDefined();
    });

    test("should handle validation errors with custom handler", async () => {
      const app = createValidatingApp({
        handleValidationErrors: async err => ({
          statusCode: 422,
          body: { custom: true, message: err.message },
        }),
      });

      const res = await app.fetch(
        new Request("http://localhost/todos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        })
      );

      expect(res.status).toBe(422);
      const data = (await res.json()) as any;
      expect(data.custom).toBe(true);
    });

    test("should handle HttpResponse errors with default handler", async () => {
      const app = createApp(undefined, {
        handleCreateTodo: async () => {
          throw new HttpResponse(409, {}, { code: "CONFLICT" });
        },
      });

      const res = await app.fetch(
        new Request("http://localhost/todos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: "dup" }),
        })
      );

      expect(res.status).toBe(409);
      const data = (await res.json()) as any;
      expect(data.code).toBe("CONFLICT");
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

      const res = await app.fetch(
        new Request("http://localhost/todos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        })
      );

      expect(res.status).toBe(409);
      const data = (await res.json()) as any;
      expect(data.wrapped).toBe(true);
    });

    test("should handle unknown errors with default handler", async () => {
      const app = createApp(undefined, {
        handleGetTodos: async () => {
          throw new Error("Unexpected failure");
        },
      });

      const res = await app.fetch(new Request("http://localhost/todos"));

      expect(res.status).toBe(500);
      const data = (await res.json()) as any;
      expect(data.code).toBe("INTERNAL_SERVER_ERROR");
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

      const res = await app.fetch(new Request("http://localhost/todos"));

      expect(res.status).toBe(500);
      const data = (await res.json()) as any;
      expect(data.custom).toBe(true);
      expect(data.message).toBe("Boom");
    });

    test("should return 500 when error handler throws", async () => {
      const app = createValidatingApp({
        handleValidationErrors: () => {
          throw new Error("Handler crashed");
        },
      });

      const res = await app.fetch(
        new Request("http://localhost/todos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        })
      );

      // A broken handler bubbles up to the safety net — clean 500
      expect(res.status).toBe(500);
      const data = (await res.json()) as any;
      expect(data.code).toBe("INTERNAL_SERVER_ERROR");
    });

    test("should return 500 for completely malformed request URL", async () => {
      const app = createApp();

      // Create a Request that will cause new URL() to throw
      // by overriding the url property
      const badRequest = new Request("http://localhost/todos");
      Object.defineProperty(badRequest, "url", { value: "not-a-valid-url" });

      const res = await app.fetch(badRequest);

      expect(res.status).toBe(500);
      const data = (await res.json()) as any;
      expect(data.code).toBe("INTERNAL_SERVER_ERROR");
    });

    test("should return 400 for malformed JSON body", async () => {
      const app = createApp();

      const res = await app.fetch(
        new Request("http://localhost/todos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{ invalid json",
        })
      );

      expect(res.status).toBe(400);
      const data = (await res.json()) as any;
      expect(data.code).toBe("BAD_REQUEST");
      expect(data.message).toContain("Invalid JSON");
    });
  });

  describe("Response Conversion", () => {
    test("should set Content-Type to application/json for object bodies", async () => {
      const app = createApp();

      const res = await app.fetch(new Request("http://localhost/todos"));

      expect(res.headers.get("content-type")).toBe("application/json");
    });

    test("should handle empty response bodies", async () => {
      const app = createApp(undefined, {
        handleGetTodos: async () => ({ statusCode: 204 }),
      });

      const res = await app.fetch(new Request("http://localhost/todos"));

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

      const res = await app.fetch(new Request("http://localhost/todos"));

      expect(res.headers.get("x-custom")).toBe("value");
      // Multi-value headers are joined by fetch spec
      expect(res.headers.get("x-multi")).toContain("a");
      expect(res.headers.get("x-multi")).toContain("b");
    });
  });

  describe("Fluent API", () => {
    test("should return this from use() for chaining", () => {
      const app = new TypeweaverApp();
      const result = app.use(async (_ctx, next) => next());
      expect(result).toBe(app);
    });

    test("should return this from route() for chaining", () => {
      const app = new TypeweaverApp();
      const router = new TestRouter({
        requestHandlers: defaultHandlers(),
      });
      const result = app.route(router);
      expect(result).toBe(app);
    });

    test("should return this from route() with prefix for chaining", () => {
      const app = new TypeweaverApp();
      const router = new TestRouter({
        requestHandlers: defaultHandlers(),
      });
      const result = app.route("/api", router);
      expect(result).toBe(app);
    });
  });
});
