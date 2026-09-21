import {
  badRequestDefaultError,
  HttpMethod,
  internalServerErrorDefaultError,
  RequestValidationError,
} from "@rexeus/typeweaver-core";
import type {
  IRawHttpRequest,
  IRequestValidator,
} from "@rexeus/typeweaver-core";
import { TestApplicationError } from "test-utils";
import { describe, expect, test, vi } from "vitest";
import {
  PayloadTooLargeError,
  ResponseSerializationError,
} from "../../src/lib/errors/index.js";
import { defineMiddleware } from "../../src/lib/TypedMiddleware.js";
import { TypeweaverApp } from "../../src/lib/TypeweaverApp.js";
import { TypeweaverRouter } from "../../src/lib/TypeweaverRouter.js";
import {
  expectErrorResponse,
  get,
  noopResponseValidator,
  noopValidator,
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

async function expectInternalError(
  res: Response
): Promise<Record<string, unknown>> {
  return expectErrorResponse(
    res,
    internalServerErrorDefaultError.statusCode,
    internalServerErrorDefaultError.code
  );
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

describe("TypeweaverApp malformed request errors", () => {
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

    const data = await expectErrorResponse(
      res,
      badRequestDefaultError.statusCode,
      badRequestDefaultError.code
    );
    expect(data["message"]).toBe(badRequestDefaultError["message"]);
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
    const app = createApp(undefined, {
      handleGetTodos: async () => {
        throw new TestApplicationError("should be logged");
      },
    });

    await withConsoleErrorSpy(async spy => {
      await app.fetch(get("/todos"));

      expect(spy).toHaveBeenCalledOnce();
    });
  });
});

describe("TypeweaverApp response serialization errors", () => {
  test("returns a sanitized 500 when response serialization fails", async () => {
    const circularBody: Record<string, unknown> = {
      secret: "circular serialization details",
    };
    circularBody["self"] = circularBody;
    const app = createApp(
      undefined,
      {
        handleGetTodos: async () => ({
          statusCode: 200,
          body: circularBody,
        }),
      },
      { onError: vi.fn() }
    );

    const res = await app.fetch(get("/todos"));

    const data = await expectInternalError(res);
    expect(JSON.stringify(data)).not.toContain(
      "circular serialization details"
    );
  });

  test("reports onError when response serialization fails", async () => {
    const onError = vi.fn();
    const circularBody: Record<string, unknown> = {};
    circularBody["self"] = circularBody;
    const app = createApp(
      undefined,
      {
        handleGetTodos: async () => ({
          statusCode: 200,
          body: circularBody,
        }),
      },
      { onError }
    );

    await app.fetch(get("/todos"));

    expect(onError).toHaveBeenCalledWith(
      expect.any(ResponseSerializationError)
    );
  });

  test("should handle errors thrown inside middleware", async () => {
    const onError = vi.fn();
    const app = createApp(undefined, undefined, { onError });
    const boom = defineMiddleware(async () => {
      throw new TestApplicationError("middleware boom");
    });

    app.use(boom);

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
