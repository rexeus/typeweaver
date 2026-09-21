import { HttpMethod, RequestValidationError } from "@rexeus/typeweaver-core";
import type {
  IRawHttpRequest,
  IRequestValidator,
} from "@rexeus/typeweaver-core";
import { TestApplicationError } from "test-utils";
import { describe, expect, test, vi } from "vitest";
import { TypeweaverApp } from "../../src/lib/TypeweaverApp.js";
import { TypeweaverRouter } from "../../src/lib/TypeweaverRouter.js";
import {
  BASE_URL,
  expectErrorResponse,
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

describe("TypeweaverApp request cancellation context", () => {
  test("forwards the Fetch request signal to the matched handler", async () => {
    let observedSignal: AbortSignal | undefined;
    const controller = new AbortController();
    const app = createApp(undefined, {
      handleGetTodos: async (_request, context) => {
        observedSignal = context.signal;
        return { statusCode: 200, body: [] };
      },
    });

    const response = await app.fetch(
      new Request(`${BASE_URL}/todos`, { signal: controller.signal })
    );

    expect(response.status).toBe(200);
    expect(observedSignal?.aborted).toBe(false);
    controller.abort();
    expect(observedSignal?.aborted).toBe(true);
  });
});

describe("TypeweaverApp unknown error handling", () => {
  test("should handle unknown errors with custom handler", async () => {
    const app = createApp(
      {
        handleUnknownErrors: async (err, _ctx) => ({
          statusCode: 500,
          body: {
            custom: true,
            message: err instanceof Error ? err["message"] : "Unknown",
          },
        }),
      },
      {
        handleGetTodos: async () => {
          throw new TestApplicationError("Boom");
        },
      }
    );

    const res = await app.fetch(get("/todos"));

    const data = await expectJson(res, 500);
    expect(data["custom"]).toBe(true);
    expect(data["message"]).toBe("Boom");
  });

  test("reports unknown route errors once when a custom unknown error handler returns a response", async () => {
    const onError = vi.fn();
    const routeFailure = new TestApplicationError(
      "custom handler owns response"
    );
    const app = createApp(
      {
        handleUnknownErrors: error => ({
          statusCode: 500,
          body: {
            code: "CUSTOM_UNKNOWN",
            message: error instanceof Error ? error["message"] : "Unknown",
          },
        }),
      },
      {
        handleGetTodos: async () => {
          throw routeFailure;
        },
      },
      { onError }
    );

    const res = await app.fetch(get("/todos"));

    const data = await expectJson(res, 500);
    expect(data).toEqual({
      code: "CUSTOM_UNKNOWN",
      message: "custom handler owns response",
    });
    expect(onError).toHaveBeenCalledOnce();
    expect(onError).toHaveBeenCalledWith(routeFailure);
  });

  test("reports both the custom unknown handler failure and original route failure to onError in order", async () => {
    const onError = vi.fn();
    const handlerFailure = new TestApplicationError(
      "custom unknown handler failed"
    );
    const routeFailure = new TestApplicationError("unexpected failure");
    const app = createApp(
      {
        handleUnknownErrors: () => {
          throw handlerFailure;
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
    expect(onError).toHaveBeenCalledTimes(2);
    expect(onError).toHaveBeenNthCalledWith(1, handlerFailure);
    expect(onError).toHaveBeenNthCalledWith(2, routeFailure);
  });
});
