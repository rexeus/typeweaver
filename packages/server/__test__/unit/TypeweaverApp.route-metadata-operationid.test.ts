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
  BASE_URL,
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

describe("Route Metadata (operationId)", () => {
  test("should expose route metadata to middleware via ctx.route", async () => {
    let capturedRoute: unknown;
    const spy = defineMiddleware(async (ctx, next) => {
      capturedRoute = ctx.route;
      return next();
    });

    const app = createApp();
    app.use(spy);

    await app.fetch(get("/todos"));

    expect(capturedRoute).toEqual({
      operationId: "listTodos",
      method: "GET",
      path: "/todos",
    });
  });

  test("should expose route metadata to request handler via ctx.route", async () => {
    const app = createApp(undefined, {
      handleGetTodos: async (_req, ctx) => ({
        statusCode: 200,
        body: { route: ctx.route },
      }),
    });

    const res = await app.fetch(get("/todos"));

    const data = await expectJson(res, 200);
    expect(data["route"]).toEqual({
      operationId: "listTodos",
      method: "GET",
      path: "/todos",
    });
  });

  test("should expose correct operationId for parameterized routes", async () => {
    const app = createApp(undefined, {
      handleGetTodo: async (_req, ctx) => ({
        statusCode: 200,
        body: { operationId: ctx.route?.operationId },
      }),
    });

    const res = await app.fetch(get("/todos/todo-42"));

    const data = await expectJson(res, 200);
    expect(data["operationId"]).toBe("getTodo");
  });

  test("should set ctx.route to undefined for 404 requests", async () => {
    let capturedRoute: unknown = "not-set";
    const spy = defineMiddleware(async (ctx, next) => {
      capturedRoute = ctx.route;
      return next();
    });

    const app = createApp();
    app.use(spy);

    const res = await app.fetch(get("/nonexistent"));

    expect(res.status).toBe(404);
    expect(capturedRoute).toBeUndefined();
  });

  test("should set ctx.route to undefined for 405 requests", async () => {
    let capturedRoute: unknown = "not-set";
    const spy = defineMiddleware(async (ctx, next) => {
      capturedRoute = ctx.route;
      return next();
    });

    const app = createApp();
    app.use(spy);

    const res = await app.fetch(del("/todos"));

    expect(res.status).toBe(405);
    expect(capturedRoute).toBeUndefined();
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
    expect(data["tags"]).toEqual(["a", "b", "c"]);
  });
});
