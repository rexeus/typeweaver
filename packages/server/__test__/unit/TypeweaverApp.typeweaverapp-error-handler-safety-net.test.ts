import { HttpMethod, RequestValidationError } from "@rexeus/typeweaver-core";
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

function isUnknownRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

type ConsoleErrorSpy = {
  mockRestore: () => void;
};

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

async function withConsoleErrorSpy<T>(
  fn: (spy: ConsoleErrorSpy) => Promise<T> | T
): Promise<T> {
  const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
  try {
    return await fn(spy);
  } finally {
    spy.mockRestore();
  }
}

describe("TypeweaverApp error-handler safety net", () => {
  test("falls through to the safety net when the custom unknown handler throws", async () => {
    const onError = vi.fn();
    const routeFailure = new TestApplicationError("unexpected failure");
    const app = createApp(
      {
        handleUnknownErrors: () => {
          throw new TestApplicationError("custom unknown handler failed");
        },
      },
      {
        handleGetTodos: async () => {
          throw routeFailure;
        },
      },
      { onError }
    );

    const res = await app.fetch(get("/todos"));

    await expectErrorResponse(res, 500, "INTERNAL_SERVER_ERROR");
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ message: routeFailure["message"] })
    );
  });

  test("should call onError for errors that escape to the safety net", async () => {
    const onError = vi.fn();
    const app = createApp(
      { handleUnknownErrors: false },
      {
        handleGetTodos: async () => {
          throw new TestApplicationError("Unhandled");
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
        handleRequestValidationErrors: false,
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
        validateResponses: false,
        handleHttpResponseErrors: false,
        handleUnknownErrors: false,
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
      },
      { onError }
    );

    const res = await app.fetch(post("/todos", { title: "dup" }));

    await expectErrorResponse(res, 500, "INTERNAL_SERVER_ERROR");
    expect(onError).toHaveBeenCalledOnce();
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ type: "ConflictError", statusCode: 409 })
    );
  });
});

describe("TypeweaverApp error reporter failures", () => {
  test("should return 500 when error handler throws", async () => {
    const app = createValidatingApp({
      handleRequestValidationErrors: () => {
        throw new TestApplicationError("Handler crashed");
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
          throw new TestApplicationError("Unexpected failure");
        },
      },
      {
        onError: () => {
          throw new TestApplicationError("Observer crashed");
        },
      }
    );

    const res = await app.fetch(get("/todos"));

    await expectErrorResponse(res, 500, "INTERNAL_SERVER_ERROR");
  });

  test("logs through console.error as a last resort when onError throws in the safety net", async () => {
    const originalError = new TestApplicationError("Unexpected failure");
    const onErrorFailure = new TestApplicationError("Observer crashed");
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

    await withConsoleErrorSpy(async spy => {
      await app.fetch(get("/todos"));

      expect(spy).toHaveBeenCalledWith(
        "TypeweaverApp: onError callback threw while handling error",
        expect.objectContaining({ onErrorFailure, originalError })
      );
    });
  });

  test("logs through console.error as a last resort when onError throws in the unknown-error handler", async () => {
    const originalError = new TestApplicationError("Handler failure");
    const onErrorFailure = new TestApplicationError("onError crashed");
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

    await withConsoleErrorSpy(async spy => {
      const res = await app.fetch(get("/todos"));

      expect(res.status).toBe(500);
      expect(spy).toHaveBeenCalledWith(
        "TypeweaverApp: onError callback threw while handling error",
        expect.objectContaining({ onErrorFailure, originalError })
      );
    });
  });
});
