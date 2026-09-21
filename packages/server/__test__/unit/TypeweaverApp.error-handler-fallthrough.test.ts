import { HttpMethod, RequestValidationError } from "@rexeus/typeweaver-core";
import type {
  IRawHttpRequest,
  IRequestValidator,
  ITypedHttpResponse,
} from "@rexeus/typeweaver-core";
import { TestApplicationError } from "test-utils";
import { describe, expect, test, vi } from "vitest";
import { defineMiddleware } from "../../src/lib/TypedMiddleware.js";
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

function createRequestBarrier(participantCount: number): {
  readonly wait: () => Promise<void>;
} {
  let arrived = 0;
  let release: () => void = () => undefined;
  const released = new Promise<void>(resolve => {
    release = resolve;
  });

  return {
    wait: async () => {
      arrived += 1;
      if (arrived === participantCount) release();
      await released;
    },
  };
}

describe("Error Handler Fallthrough", () => {
  test("should fall through to unknown handler when validation handler is disabled", async () => {
    const unknownHandler = vi.fn((_err: unknown) => ({
      statusCode: 500,
      body: { code: "CUSTOM_UNKNOWN", message: "Caught by unknown handler" },
    }));
    const app = createValidatingApp({
      handleRequestValidationErrors: false,
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
        validateResponses: false,
        handleHttpResponseErrors: false,
        handleUnknownErrors: unknownHandler,
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

    await expectErrorResponse(res, 500, "CUSTOM_UNKNOWN");
    expect(unknownHandler).toHaveBeenCalledOnce();
    expect(unknownHandler).toHaveBeenCalledWith(
      expect.objectContaining({ type: "ConflictError", statusCode: 409 }),
      expect.anything()
    );
  });

  test("should return 500 via handler path when defaultUnknownHandler onError throws", async () => {
    const app = createApp(
      undefined,
      {
        handleGetTodos: async () => {
          throw new TestApplicationError("Handler failure");
        },
      },
      {
        onError: () => {
          throw new TestApplicationError("onError also failed");
        },
      }
    );

    await withConsoleErrorSpy(async spy => {
      const res = await app.fetch(get("/todos"));

      await expectErrorResponse(res, 500, "INTERNAL_SERVER_ERROR");
      expect(spy).toHaveBeenCalled();
    });
  });
});

describe("Concurrent Request Isolation", () => {
  test("should isolate state across concurrent requests", async () => {
    const requestCount = 10;
    const allRequestsHaveSetState = createRequestBarrier(requestCount);
    const app = new TypeweaverApp();
    const router = new TestRouter({
      validateRequests: false,
      requestHandlers: {
        ...defaultHandlers(),
        handleGetTodo: async (_req, ctx) => {
          const id = _req.param?.["todoId"] ?? "unknown";
          ctx.state.set("id", id);
          await allRequestsHaveSetState.wait();
          return {
            statusCode: 200,
            body: { id, stateId: ctx.state.get("id") },
          };
        },
      },
    });
    app.route(router);

    const results = await Promise.all(
      Array.from({ length: requestCount }, (_, i) =>
        app
          .fetch(get(`/todos/todo-${i}`))
          .then(r => r.json() as Promise<{ id: string; stateId: string }>)
      )
    );

    for (let i = 0; i < requestCount; i++) {
      expect(results[i]?.id).toBe(`todo-${i}`);
      expect(results[i]?.stateId).toBe(`todo-${i}`);
    }
  });
});

describe("Middleware Error Propagation", () => {
  test("should propagate errors thrown after next() resolves", async () => {
    const onError = vi.fn();
    const app = createApp(undefined, undefined, { onError });
    const postNextError = defineMiddleware(async (_ctx, next) => {
      await next();
      throw new TestApplicationError("Post-next failure");
    });

    app.use(postNextError);

    const res = await app.fetch(get("/todos"));

    await expectErrorResponse(res, 500, "INTERNAL_SERVER_ERROR");
    expect(onError).toHaveBeenCalledOnce();
  });
});
