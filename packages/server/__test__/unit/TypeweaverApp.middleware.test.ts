import { HttpMethod, RequestValidationError } from "@rexeus/typeweaver-core";
import type {
  IRawHttpRequest,
  IRequestValidator,
} from "@rexeus/typeweaver-core";
import { describe, expect, test } from "vitest";
import { defineMiddleware } from "../../src/lib/TypedMiddleware.js";
import { TypeweaverApp } from "../../src/lib/TypeweaverApp.js";
import { TypeweaverRouter } from "../../src/lib/TypeweaverRouter.js";
import {
  del,
  expectJson,
  get,
  noopResponseValidator,
  noopValidator,
} from "../helpers.js";
import type { RequestHandler } from "../../src/lib/RequestHandler.js";
import type { TypeweaverAppOptions } from "../../src/lib/TypeweaverApp.js";
import type { TypeweaverRouterOptions } from "../../src/lib/TypeweaverRouter.js";

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

function isUnknownRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

type TestHandlers = {
  handleGetTodos: RequestHandler;
  handleCreateTodo: RequestHandler;
  handleGetTodo: RequestHandler;
};

class TestRouter extends TypeweaverRouter<TestHandlers, boolean> {
  constructor(options: TypeweaverRouterOptions<TestHandlers, boolean>) {
    super(options);

    this.route({
      operationId: "listTodos",
      method: HttpMethod.GET,
      path: "/todos",
      requestValidator:
        options.validateRequests === false ? noopValidator : failingValidator,
      responseValidator: noopResponseValidator,
      handler: async (req: IRawHttpRequest, ctx) =>
        this.requestHandlers.handleGetTodos(req, ctx),
    });

    this.route({
      operationId: "createTodo",
      method: HttpMethod.POST,
      path: "/todos",
      requestValidator:
        options.validateRequests === false ? noopValidator : failingValidator,
      responseValidator: noopResponseValidator,
      handler: async (req: IRawHttpRequest, ctx) =>
        this.requestHandlers.handleCreateTodo(req, ctx),
    });

    this.route({
      operationId: "getTodo",
      method: HttpMethod.GET,
      path: "/todos/:todoId",
      requestValidator:
        options.validateRequests === false ? noopValidator : failingValidator,
      responseValidator: noopResponseValidator,
      handler: async (req: IRawHttpRequest, ctx) =>
        this.requestHandlers.handleGetTodo(req, ctx),
    });
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
    handleCreateTodo: async req => {
      const title =
        isUnknownRecord(req.body) && typeof req.body["title"] === "string"
          ? req.body["title"]
          : "Untitled";
      return {
        statusCode: 201,
        header: { "Content-Type": "application/json" },
        body: { id: "3", title },
      };
    },
    handleGetTodo: async (req, _ctx) => ({
      statusCode: 200,
      body: { id: req.param?.["todoId"] ?? "unknown", title: "A Todo" },
    }),
    ...overrides,
  };
}

function createApp(
  routerOptions?: Partial<TypeweaverRouterOptions<TestHandlers, boolean>>,
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

describe("Middleware", () => {
  test("should execute global middleware for all requests", async () => {
    const seen: string[] = [];
    const logger = defineMiddleware(async (ctx, next) => {
      seen.push(ctx.request.path);
      return next();
    });

    const app = createApp();
    app.use(logger);

    await app.fetch(get("/todos"));
    await app.fetch(get("/todos/t1"));

    expect(seen).toEqual(["/todos", "/todos/t1"]);
  });

  test("should allow middleware to short-circuit with a response", async () => {
    const maintenance = defineMiddleware(async () => ({
      statusCode: 503,
      body: { message: "Service Unavailable" },
    }));

    const app = createApp();
    app.use(maintenance);

    const res = await app.fetch(get("/todos"));

    expect(res.status).toBe(503);
  });

  test("should allow middleware to modify response", async () => {
    const addRequestId = defineMiddleware(async (_ctx, next) => {
      const response = await next();
      return {
        ...response,
        header: {
          ...response.header,
          "x-request-id": "req-001",
        },
      };
    });

    const app = createApp();
    app.use(addRequestId);

    const res = await app.fetch(get("/todos"));

    expect(res.status).toBe(200);
    expect(res.headers.get("x-request-id")).toBe("req-001");
  });

  test("should pass state between middleware and handler via next(state)", async () => {
    const auth = defineMiddleware<{ userId: string }>(async (_ctx, next) =>
      next({ userId: "user-99" })
    );

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
    app.use(auth).route(router);

    const res = await app.fetch(get("/todos"));

    const data = await expectJson(res, 200);
    expect(data["userId"]).toBe("user-99");
  });
});

describe("TypeweaverApp middleware state and fallback routes", () => {
  test("ignores middleware state keys that could pollute object prototypes", async () => {
    const suspiciousState = JSON.parse(
      '{"__proto__":{"polluted":true},"constructor":"bad","prototype":"bad","safe":"ok"}'
    ) as Record<string, unknown>;
    const suspiciousMiddleware = defineMiddleware<Record<string, unknown>>(
      async (_ctx, next) => next(suspiciousState)
    );
    const app = new TypeweaverApp();
    const router = new TestRouter({
      validateRequests: false,
      requestHandlers: {
        ...defaultHandlers(),
        handleGetTodos: async (_req, ctx) => ({
          statusCode: 200,
          body: {
            safe: ctx.state.get("safe"),
            hasPoisonKeys:
              ctx.state.has("__proto__") ||
              ctx.state.has("constructor") ||
              ctx.state.has("prototype"),
            polluted: ({} as { polluted?: unknown }).polluted,
          },
        }),
      },
    });
    app.use(suspiciousMiddleware).route(router);

    const res = await app.fetch(get("/todos"));

    const data = await expectJson(res, 200);
    expect(data).toEqual({ safe: "ok", hasPoisonKeys: false });
    expect(({} as { polluted?: unknown }).polluted).toBeUndefined();
  });

  test("should execute global middleware even for 404 requests", async () => {
    const seen: string[] = [];
    const logger = defineMiddleware(async (ctx, next) => {
      seen.push(ctx.request.path);
      return next();
    });

    const app = createApp();
    app.use(logger);

    const res = await app.fetch(get("/nonexistent"));

    expect(res.status).toBe(404);
    expect(seen).toContain("/nonexistent");
  });

  test("should execute global middleware even for 405 requests", async () => {
    const seen: string[] = [];
    const logger = defineMiddleware(async (ctx, next) => {
      seen.push(`${ctx.request.method} ${ctx.request.path}`);
      return next();
    });

    const app = createApp();
    app.use(logger);

    const res = await app.fetch(del("/todos"));

    expect(res.status).toBe(405);
    expect(seen).toContain("DELETE /todos");
  });

  test("should execute multiple global middlewares in registration order", async () => {
    const order: number[] = [];

    const mw1 = defineMiddleware(async (_ctx, next) => {
      order.push(1);
      const r = await next();
      order.push(6);
      return r;
    });
    const mw2 = defineMiddleware(async (_ctx, next) => {
      order.push(2);
      const r = await next();
      order.push(5);
      return r;
    });
    const mw3 = defineMiddleware(async (_ctx, next) => {
      order.push(3);
      const r = await next();
      order.push(4);
      return r;
    });

    const app = createApp();
    app.use(mw1).use(mw2).use(mw3);

    await app.fetch(get("/todos"));

    expect(order).toEqual([1, 2, 3, 4, 5, 6]);
  });

  test("should allow middleware to intercept 404 responses", async () => {
    const notFoundInterceptor = defineMiddleware(async (_ctx, next) => {
      const response = await next();
      if (response.statusCode === 404) {
        return {
          statusCode: 404,
          body: { custom: true, message: "Custom not found" },
        };
      }
      return response;
    });

    const app = createApp();
    app.use(notFoundInterceptor);

    const res = await app.fetch(get("/nonexistent"));

    const data = await expectJson(res, 404);
    expect(data["custom"]).toBe(true);
  });
});
