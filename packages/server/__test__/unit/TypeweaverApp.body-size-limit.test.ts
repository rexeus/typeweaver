import {
  HttpMethod,
  internalServerErrorDefaultError,
  methodNotAllowedDefaultError,
  notFoundDefaultError,
  payloadTooLargeDefaultError,
  RequestValidationError,
} from "@rexeus/typeweaver-core";
import type {
  IRawHttpRequest,
  IRequestValidator,
} from "@rexeus/typeweaver-core";
import { TestApplicationError } from "test-utils";
import { describe, expect, test, vi } from "vitest";
import { defineMiddleware } from "../../src/lib/TypedMiddleware.js";
import { TypeweaverApp } from "../../src/lib/TypeweaverApp.js";
import { TypeweaverRouter } from "../../src/lib/TypeweaverRouter.js";
import {
  BASE_URL,
  del,
  expectErrorResponse,
  expectJson,
  get,
  noopResponseValidator,
  noopValidator,
  post,
  postRaw,
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

describe("Body Size Limit", () => {
  test("should return 413 for oversized body with maxBodySize set", async () => {
    const app = createApp(undefined, undefined, {
      maxBodySize: 50,
      onError: vi.fn(),
    });
    const res = await app.fetch(
      postRaw("/todos", "x".repeat(100), "text/plain")
    );

    const data = await expectErrorResponse(
      res,
      payloadTooLargeDefaultError.statusCode,
      payloadTooLargeDefaultError.code
    );
    expect(data["message"]).toBe(payloadTooLargeDefaultError["message"]);
  });

  test("passes a body within the configured limit to the handler", async () => {
    const app = createApp(undefined, undefined, {
      maxBodySize: 10000,
      onError: vi.fn(),
    });

    const res = await app.fetch(post("/todos", { title: "New Todo" }));

    const data = await expectJson(res, 201);
    expect(data["title"]).toBe("New Todo");
  });

  test("accepts a body exactly at the configured limit", async () => {
    const app = createApp(
      undefined,
      {
        handleCreateTodo: async req => ({
          statusCode: 201,
          body: { size: String(req.body).length },
        }),
      },
      { maxBodySize: 8, onError: vi.fn() }
    );

    const res = await app.fetch(postRaw("/todos", "x".repeat(8), "text/plain"));

    const data = await expectJson(res, 201);
    expect(data["size"]).toBe(8);
  });

  test("returns 413 when the body exceeds the 1 MB default limit", async () => {
    const app = createApp(undefined, undefined, { onError: vi.fn() });
    const oneByteOverDefaultLimit = "x".repeat(1_048_577);

    const res = await app.fetch(
      postRaw("/todos", oneByteOverDefaultLimit, "text/plain")
    );

    const data = await expectErrorResponse(
      res,
      payloadTooLargeDefaultError.statusCode,
      payloadTooLargeDefaultError.code
    );
    expect(data["message"]).toBe(payloadTooLargeDefaultError["message"]);
  });

  test("accepts a body exactly at the 1 MB default limit", async () => {
    const app = createApp(undefined, {
      handleCreateTodo: async req => ({
        statusCode: 201,
        body: { size: String(req.body).length },
      }),
    });
    const defaultLimitBody = "x".repeat(1_048_576);

    const res = await app.fetch(
      postRaw("/todos", defaultLimitBody, "text/plain")
    );

    const data = await expectJson(res, 201);
    expect(data["size"]).toBe(1_048_576);
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

    const data = await expectErrorResponse(
      res,
      payloadTooLargeDefaultError.statusCode,
      payloadTooLargeDefaultError.code
    );
    expect(data["message"]).toBe(payloadTooLargeDefaultError["message"]);
  });
});

describe("Default error descriptors", () => {
  test("should use core default descriptors for built-in runtime errors", async () => {
    const app = createApp(undefined, {
      handleGetTodos: async () => {
        throw new TestApplicationError("Unexpected failure");
      },
    });

    const notFoundResponse = await app.fetch(get("/missing"));
    const notFoundData = await expectErrorResponse(
      notFoundResponse,
      notFoundDefaultError.statusCode,
      notFoundDefaultError.code
    );
    expect(notFoundData["message"]).toBe(notFoundDefaultError["message"]);

    const methodNotAllowedResponse = await app.fetch(del("/todos"));
    const methodNotAllowedData = await expectErrorResponse(
      methodNotAllowedResponse,
      methodNotAllowedDefaultError.statusCode,
      methodNotAllowedDefaultError.code
    );
    expect(methodNotAllowedData["message"]).toBe(
      methodNotAllowedDefaultError["message"]
    );

    const internalServerErrorResponse = await app.fetch(get("/todos"));
    const internalServerErrorData = await expectErrorResponse(
      internalServerErrorResponse,
      internalServerErrorDefaultError.statusCode,
      internalServerErrorDefaultError.code
    );
    expect(internalServerErrorData["message"]).toBe(
      internalServerErrorDefaultError["message"]
    );
  });
});

describe("Fluent API", () => {
  test("should support chaining use() calls", () => {
    const mw = defineMiddleware(async (_ctx, next) => next());

    const app = new TypeweaverApp().use(mw);
    expect(app).toBeInstanceOf(TypeweaverApp);
  });

  test("should return this from route() for chaining", () => {
    const app = new TypeweaverApp();
    const router = new TestRouter({
      validateRequests: true,
      requestHandlers: defaultHandlers(),
    });

    expect(app.route(router)).toBe(app);
  });

  test("should return this from route() with prefix for chaining", () => {
    const app = new TypeweaverApp();
    const router = new TestRouter({
      validateRequests: true,
      requestHandlers: defaultHandlers(),
    });

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
