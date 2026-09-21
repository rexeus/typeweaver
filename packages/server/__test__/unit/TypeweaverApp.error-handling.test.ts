import {
  HttpMethod,
  RequestValidationError,
  validationDefaultError,
} from "@rexeus/typeweaver-core";
import type {
  IRawHttpRequest,
  IRequestValidator,
  ITypedHttpResponse,
} from "@rexeus/typeweaver-core";
import { TestApplicationError } from "test-utils";
import { describe, expect, test, vi } from "vitest";
import { TypeweaverApp } from "../../src/lib/TypeweaverApp.js";
import { TypeweaverRouter } from "../../src/lib/TypeweaverRouter.js";
import {
  expectErrorResponse,
  expectJson,
  get,
  noopResponseValidator,
  noopValidator,
  post,
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

class ValidatingTestRouter extends TypeweaverRouter<TestHandlers, boolean> {
  constructor(options: TypeweaverRouterOptions<TestHandlers, boolean>) {
    super(options);

    this.route({
      operationId: "createTodo",
      method: HttpMethod.POST,
      path: "/todos",
      requestValidator: failingValidator,
      responseValidator: noopResponseValidator,
      handler: async (req: IRawHttpRequest, ctx) =>
        this.requestHandlers.handleCreateTodo(req, ctx),
    });
  }
}

class BodyOnlyValidatingRouter extends TypeweaverRouter<TestHandlers> {
  constructor(options: TypeweaverRouterOptions<TestHandlers>) {
    super(options);

    this.route({
      operationId: "createTodo",
      method: HttpMethod.POST,
      path: "/todos",
      requestValidator: bodyOnlyFailingValidator,
      responseValidator: noopResponseValidator,
      handler: async (req: IRawHttpRequest, ctx) =>
        this.requestHandlers.handleCreateTodo(req, ctx),
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

function createValidatingApp(
  routerOptions?: Partial<TypeweaverRouterOptions<TestHandlers, boolean>>,
  handlerOverrides?: Partial<TestHandlers>,
  appOptions?: TypeweaverAppOptions
): TypeweaverApp {
  const app = new TypeweaverApp(appOptions);
  const router = new ValidatingTestRouter({
    validateRequests: true,
    requestHandlers: defaultHandlers(handlerOverrides),
    ...routerOptions,
  });
  app.route(router);
  return app;
}

type ValidationIssue = {
  readonly message?: unknown;
  readonly path?: readonly unknown[];
};

type ValidationIssues = {
  readonly header?: readonly ValidationIssue[];
  readonly body?: readonly ValidationIssue[];
  readonly query?: readonly ValidationIssue[];
  readonly param?: readonly ValidationIssue[];
};

const readValidationIssues = (
  data: Record<string, unknown>
): ValidationIssues => data["issues"] as ValidationIssues;

describe("Error Handling", () => {
  test("should handle validation errors with default handler and not call onError", async () => {
    const onError = vi.fn();
    const app = createValidatingApp(undefined, undefined, { onError });

    const res = await app.fetch(post("/todos", { title: "bad" }));

    const data = await expectErrorResponse(
      res,
      validationDefaultError.statusCode,
      validationDefaultError.code
    );
    const issues = readValidationIssues(data);
    expect(data["issues"]).toBeDefined();
    expect(issues.header?.[0]).toEqual({
      message: "bad header",
      path: [],
    });
    expect(issues.header?.[0]).not.toHaveProperty("code");
    expect(issues.body?.[0]).toEqual({ message: "bad body", path: [] });
    expect(issues.body?.[0]).not.toHaveProperty("code");
    expect(onError).not.toHaveBeenCalled();
  });

  test("should omit empty issue categories from sanitized response", async () => {
    const app = new TypeweaverApp();
    const router = new BodyOnlyValidatingRouter({
      requestHandlers: defaultHandlers(),
    });
    app.route(router);

    const res = await app.fetch(post("/todos", { title: 123 }));

    const data = await expectErrorResponse(
      res,
      validationDefaultError.statusCode,
      validationDefaultError.code
    );
    const issues = readValidationIssues(data);
    expect(issues.body).toHaveLength(1);
    expect(issues.body?.[0]).toEqual({
      message: "Expected string",
      path: ["title"],
    });
    expect(issues.body?.[0]).not.toHaveProperty("code");
    expect(issues.body?.[0]).not.toHaveProperty("expected");
    expect(issues.body?.[0]).not.toHaveProperty("input");
    expect(issues.header).toBeUndefined();
    expect(issues.query).toBeUndefined();
    expect(issues.param).toBeUndefined();
  });

  test("should handle validation errors with custom handler", async () => {
    const app = createValidatingApp({
      handleRequestValidationErrors: async err => ({
        statusCode: 422,
        body: { custom: true, message: err["message"] },
      }),
    });

    const res = await app.fetch(post("/todos", {}));

    const data = await expectJson(res, 422);
    expect(data["custom"]).toBe(true);
  });
});

describe("TypeweaverApp typed response error handling", () => {
  test("should handle HttpResponse errors with default handler and not call onError", async () => {
    const onError = vi.fn();
    const app = createApp(
      undefined,
      {
        handleCreateTodo: async () => {
          throw {
            type: "ConflictError",
            statusCode: 409,
            header: {},
            body: { code: "CONFLICT" },
          } satisfies ITypedHttpResponse;
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
        validateResponses: false,
        handleHttpResponseErrors: async err => ({
          statusCode: err.statusCode,
          body: { wrapped: true, original: err.body },
        }),
      },
      {
        handleCreateTodo: async () => {
          throw {
            type: "ConflictError",
            statusCode: 409,
            header: {},
            body: { code: "CONFLICT" },
          } satisfies ITypedHttpResponse;
        },
      }
    );

    const res = await app.fetch(post("/todos", {}));

    const data = await expectJson(res, 409);
    expect(data["wrapped"]).toBe(true);
  });

  test("should handle unknown errors with default handler and call onError", async () => {
    const onError = vi.fn();
    const app = createApp(
      undefined,
      {
        handleGetTodos: async () => {
          throw new TestApplicationError("Unexpected failure");
        },
      },
      { onError }
    );

    const res = await app.fetch(get("/todos"));

    const data = await expectErrorResponse(res, 500, "INTERNAL_SERVER_ERROR");
    expect(JSON.stringify(data)).not.toContain("Unexpected failure");
    expect(onError).toHaveBeenCalledOnce();
    expect(onError).toHaveBeenCalledWith(expect.any(Error));
  });
});
