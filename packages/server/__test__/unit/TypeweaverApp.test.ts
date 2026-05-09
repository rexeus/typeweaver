import {
  badRequestDefaultError,
  HttpMethod,
  HttpStatusCode,
  internalServerErrorDefaultError,
  methodNotAllowedDefaultError,
  notFoundDefaultError,
  payloadTooLargeDefaultError,
  RequestValidationError,
  ResponseValidationError,
  validationDefaultError,
} from "@rexeus/typeweaver-core";
import type {
  IHttpResponse,
  IRequestValidator,
  IResponseValidator,
  ITypedHttpResponse,
} from "@rexeus/typeweaver-core";
import {
  captureError,
  TestApplicationError,
  TestAssertionError,
} from "test-utils";
import { describe, expect, test, vi } from "vitest";
import {
  MissingRouterForPrefixedMountError,
  PayloadTooLargeError,
  ResponseSerializationError,
} from "../../src/lib/errors/index.js";
import { defineMiddleware } from "../../src/lib/TypedMiddleware.js";
import { TypeweaverApp } from "../../src/lib/TypeweaverApp.js";
import { TypeweaverRouter } from "../../src/lib/TypeweaverRouter.js";
import {
  BASE_URL,
  del,
  expectErrorResponse,
  expectJson,
  get,
  head,
  noopResponseValidator,
  noopValidator,
  post,
  postRaw,
  put,
} from "../helpers.js";
import type { RequestHandler } from "../../src/lib/RequestHandler.js";
import type { ResponseValidationErrorHandler } from "../../src/lib/Router.js";
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

const invalidResponseValidator: IResponseValidator = {
  validate: (response: IHttpResponse) => {
    throw new ResponseValidationError(response.statusCode);
  },
  safeValidate: (response: IHttpResponse) => ({
    isValid: false,
    error: new ResponseValidationError(response.statusCode),
  }),
};

function aConflictTypedResponse(): ITypedHttpResponse<
  "ConflictError",
  HttpStatusCode.CONFLICT,
  undefined,
  { readonly code: string }
> {
  return {
    type: "ConflictError",
    statusCode: HttpStatusCode.CONFLICT,
    body: { code: "CONFLICT" },
  };
}

function aPassThroughResponseValidator(): IResponseValidator {
  return {
    validate: response => response,
    safeValidate: response => ({ isValid: true, data: response }),
  };
}

function aValidatorThatMarksResponsesAsValidated(): IResponseValidator {
  return {
    validate: response => response,
    safeValidate: response => ({
      isValid: true,
      data: {
        ...response,
        header: { "x-response-source": "validator" },
        body: { source: "validated" },
      },
    }),
  };
}

type ConsoleErrorSpy = {
  mockRestore: () => void;
};

type TestHandlers = {
  handleGetTodos: RequestHandler;
  handleCreateTodo: RequestHandler;
  handleGetTodo: RequestHandler;
};

type TypedResponseValidationAppOptions = {
  readonly typedResponse?: ITypedHttpResponse;
  readonly responseValidator?: IResponseValidator;
  readonly handleHttpResponseErrors?: TypeweaverRouterOptions<TestHandlers>["handleHttpResponseErrors"];
  readonly handleUnknownErrors?: TypeweaverRouterOptions<TestHandlers>["handleUnknownErrors"];
  readonly handleResponseValidationErrors?: TypeweaverRouterOptions<TestHandlers>["handleResponseValidationErrors"];
  readonly onError?: TypeweaverAppOptions["onError"];
};

class TestRouter extends TypeweaverRouter<TestHandlers> {
  constructor(options: TypeweaverRouterOptions<TestHandlers>) {
    super(options);

    this.route(
      "listTodos",
      HttpMethod.GET,
      "/todos",
      options.validateRequests === false ? noopValidator : failingValidator,
      noopResponseValidator,
      async (req, ctx) => this.requestHandlers.handleGetTodos(req, ctx)
    );

    this.route(
      "createTodo",
      HttpMethod.POST,
      "/todos",
      options.validateRequests === false ? noopValidator : failingValidator,
      noopResponseValidator,
      async (req, ctx) => this.requestHandlers.handleCreateTodo(req, ctx)
    );

    this.route(
      "getTodo",
      HttpMethod.GET,
      "/todos/:todoId",
      options.validateRequests === false ? noopValidator : failingValidator,
      noopResponseValidator,
      async (req, ctx) => this.requestHandlers.handleGetTodo(req, ctx)
    );
  }
}

class ValidatingTestRouter extends TypeweaverRouter<TestHandlers> {
  constructor(options: TypeweaverRouterOptions<TestHandlers>) {
    super(options);

    this.route(
      "createTodo",
      HttpMethod.POST,
      "/todos",
      failingValidator,
      noopResponseValidator,
      async (req, ctx) => this.requestHandlers.handleCreateTodo(req, ctx)
    );
  }
}

class BodyOnlyValidatingRouter extends TypeweaverRouter<TestHandlers> {
  constructor(options: TypeweaverRouterOptions<TestHandlers>) {
    super(options);

    this.route(
      "createTodo",
      HttpMethod.POST,
      "/todos",
      bodyOnlyFailingValidator,
      noopResponseValidator,
      async (req, ctx) => this.requestHandlers.handleCreateTodo(req, ctx)
    );
  }
}

class ResponseValidatingRouter extends TypeweaverRouter<TestHandlers> {
  constructor(options: TypeweaverRouterOptions<TestHandlers>) {
    super(options);

    this.route(
      "listTodos",
      HttpMethod.GET,
      "/todos",
      noopValidator,
      invalidResponseValidator,
      async (req, ctx) => this.requestHandlers.handleGetTodos(req, ctx)
    );

    this.route(
      "createTodo",
      HttpMethod.POST,
      "/todos",
      noopValidator,
      invalidResponseValidator,
      async (req, ctx) => this.requestHandlers.handleCreateTodo(req, ctx)
    );
  }
}

class CustomResponseValidatingRouter extends TypeweaverRouter<TestHandlers> {
  constructor(
    options: TypeweaverRouterOptions<TestHandlers> & {
      readonly responseValidator: IResponseValidator;
    }
  ) {
    super(options);

    this.route(
      "listTodos",
      HttpMethod.GET,
      "/todos",
      noopValidator,
      options.responseValidator,
      async (req, ctx) => this.requestHandlers.handleGetTodos(req, ctx)
    );
  }
}

type HeadAwareHandlers = {
  handleGetTodos: RequestHandler;
  handleHeadTodos: RequestHandler;
};

class HeadAwareRouter extends TypeweaverRouter<HeadAwareHandlers> {
  constructor(options: TypeweaverRouterOptions<HeadAwareHandlers>) {
    super(options);

    this.route(
      "listTodos",
      HttpMethod.GET,
      "/todos",
      noopValidator,
      noopResponseValidator,
      async (req, ctx) => this.requestHandlers.handleGetTodos(req, ctx)
    );

    this.route(
      "headTodos",
      HttpMethod.HEAD,
      "/todos",
      noopValidator,
      noopResponseValidator,
      async (req, ctx) => this.requestHandlers.handleHeadTodos(req, ctx)
    );
  }
}

type PostOnlyHandlers = {
  handleCreateTodo: RequestHandler;
};

class PostOnlyRouter extends TypeweaverRouter<PostOnlyHandlers> {
  constructor(options: TypeweaverRouterOptions<PostOnlyHandlers>) {
    super(options);

    this.route(
      "createTodo",
      HttpMethod.POST,
      "/todos",
      noopValidator,
      noopResponseValidator,
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

function createAppMountedAt(prefix: string): TypeweaverApp {
  const app = new TypeweaverApp();
  const router = new TestRouter({
    validateRequests: false,
    requestHandlers: defaultHandlers(),
  });
  app.route(prefix, router);
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

function createResponseValidatingApp(
  routerOptions?: Partial<TypeweaverRouterOptions<TestHandlers>>,
  handlerOverrides?: Partial<TestHandlers>,
  appOptions?: TypeweaverAppOptions
): TypeweaverApp {
  const app = new TypeweaverApp(appOptions);
  const router = new ResponseValidatingRouter({
    validateRequests: false,
    requestHandlers: defaultHandlers(handlerOverrides),
    ...routerOptions,
  });
  app.route(router);
  return app;
}

function createTypedResponseValidationApp({
  typedResponse = aConflictTypedResponse(),
  responseValidator = aPassThroughResponseValidator(),
  handleHttpResponseErrors,
  handleUnknownErrors,
  handleResponseValidationErrors,
  onError,
}: TypedResponseValidationAppOptions = {}): TypeweaverApp {
  const app = new TypeweaverApp(
    onError === undefined ? undefined : { onError }
  );
  const router = new CustomResponseValidatingRouter({
    validateRequests: false,
    responseValidator,
    requestHandlers: defaultHandlers({
      handleGetTodos: async () => {
        throw typedResponse;
      },
    }),
    ...(handleHttpResponseErrors === undefined
      ? {}
      : { handleHttpResponseErrors }),
    ...(handleUnknownErrors === undefined ? {} : { handleUnknownErrors }),
    ...(handleResponseValidationErrors === undefined
      ? {}
      : { handleResponseValidationErrors }),
  });

  app.route(router);
  return app;
}

async function expectNoBody(res: Response): Promise<void> {
  expect(await res.text()).toBe("");
}

function expectAllow(res: Response, methods: readonly string[]): void {
  const allow = res.headers.get("allow");
  expect(allow).not.toBeNull();
  expect(
    allow!
      .split(",")
      .map(method => method.trim())
      .sort()
  ).toEqual([...methods].sort());
}

async function expectInternalError(res: Response): Promise<any> {
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

      const data = await expectErrorResponse(
        res,
        notFoundDefaultError.statusCode,
        notFoundDefaultError.code
      );
      expect(data.message).toBe(notFoundDefaultError.message);
    });

    test("returns 405 with allowed methods for an unsupported method on a registered path", async () => {
      const app = createApp();

      const res = await app.fetch(del("/todos"));

      const data = await expectErrorResponse(
        res,
        methodNotAllowedDefaultError.statusCode,
        methodNotAllowedDefaultError.code
      );
      expect(data.message).toBe(methodNotAllowedDefaultError.message);
      expectAllow(res, ["GET", "HEAD", "POST"]);
    });

    test("should return 405 with correct Allow header for parameterized paths", async () => {
      const app = createApp();

      const res = await app.fetch(put("/todos/t1"));

      expect(res.status).toBe(405);
      expectAllow(res, ["GET", "HEAD"]);
    });
  });

  describe("HEAD Request Support", () => {
    test("should handle HEAD request by falling back to GET handler", async () => {
      const app = createApp();

      const res = await app.fetch(head("/todos"));

      expect(res.status).toBe(200);
      await expectNoBody(res);
    });

    test("uses an explicit HEAD route instead of GET fallback at the fetch boundary", async () => {
      const app = new TypeweaverApp();
      const router = new HeadAwareRouter({
        requestHandlers: {
          handleGetTodos: async () => ({
            statusCode: 200,
            header: { "x-route": "get" },
            body: { source: "get" },
          }),
          handleHeadTodos: async () => ({
            statusCode: 200,
            header: { "x-route": "head" },
            body: { source: "head" },
          }),
        },
      });
      app.route(router);

      const res = await app.fetch(head("/todos"));

      expect(res.status).toBe(200);
      expect(res.headers.get("x-route")).toBe("head");
      await expectNoBody(res);
    });

    test("should handle HEAD request for parameterized paths", async () => {
      const app = createApp();

      const res = await app.fetch(head("/todos/t1"));

      expect(res.status).toBe(200);
      await expectNoBody(res);
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
      await expectNoBody(res);
    });

    test("returns 405 with only POST allowed for HEAD on a POST-only route", async () => {
      const app = new TypeweaverApp();
      const router = new PostOnlyRouter({
        validateRequests: false,
        requestHandlers: {
          handleCreateTodo: async () => ({ statusCode: 201, body: {} }),
        },
      });
      app.route(router);

      const res = await app.fetch(head("/todos"));

      expect(res.status).toBe(405);
      expectAllow(res, ["POST"]);
      await expectNoBody(res);
    });

    test("should return 404 for HEAD request on nonexistent path", async () => {
      const app = createApp();

      const res = await app.fetch(head("/nonexistent"));

      expect(res.status).toBe(404);
    });
  });

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
      expect(data.userId).toBe("user-99");
    });

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
      expect(data.custom).toBe(true);
    });
  });

  describe("Router Prefix", () => {
    test("should mount router with prefix", async () => {
      const app = createAppMountedAt("/api/v1");

      const res = await app.fetch(get("/api/v1/todos"));

      const data = await expectJson(res, 200);
      expect(data).toHaveLength(2);
    });

    test("should not match unprefixed path when prefix is used", async () => {
      const app = createAppMountedAt("/api/v1");

      const res = await app.fetch(get("/todos"));

      expect(res.status).toBe(404);
    });

    test("should extract path params with prefix", async () => {
      const app = createAppMountedAt("/api");

      const res = await app.fetch(get("/api/todos/my-todo"));

      const data = await expectJson(res, 200);
      expect(data.id).toBe("my-todo");
    });

    test("should normalize trailing slashes on prefix", async () => {
      const app = createAppMountedAt("/api/v1/");

      const res = await app.fetch(get("/api/v1/todos"));

      expect(res.status).toBe(200);
    });

    test("treats a root prefix like no prefix", async () => {
      const app = createAppMountedAt("/");

      const res = await app.fetch(get("/todos"));

      expect(res.status).toBe(200);
    });

    test("treats an empty prefix like no prefix", async () => {
      const app = createAppMountedAt("");

      const res = await app.fetch(get("/todos"));

      expect(res.status).toBe(200);
    });

    test("matches a route when the prefix and route path both include a slash boundary", async () => {
      const app = createAppMountedAt("/api/");

      const res = await app.fetch(get("/api/todos"));

      expect(res.status).toBe(200);
    });

    test("does not match string prefixes without a path segment boundary", async () => {
      const app = createAppMountedAt("/api");

      const res = await app.fetch(get("/apiary/todos"));

      expect(res.status).toBe(404);
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
            "listUsers",
            HttpMethod.GET,
            "/users",
            noopValidator,
            noopResponseValidator,
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

      const data = await expectErrorResponse(
        res,
        validationDefaultError.statusCode,
        validationDefaultError.code
      );
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

      const data = await expectErrorResponse(
        res,
        validationDefaultError.statusCode,
        validationDefaultError.code
      );
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
        handleRequestValidationErrors: async err => ({
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
      expect(data.wrapped).toBe(true);
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
            throw new TestApplicationError("Boom");
          },
        }
      );

      const res = await app.fetch(get("/todos"));

      const data = await expectJson(res, 500);
      expect(data.custom).toBe(true);
      expect(data.message).toBe("Boom");
    });

    test("does not call onError when a custom unknown error handler returns a response", async () => {
      const onError = vi.fn();
      const app = createApp(
        {
          handleUnknownErrors: error => ({
            statusCode: 500,
            body: {
              code: "CUSTOM_UNKNOWN",
              message: error instanceof Error ? error.message : "Unknown",
            },
          }),
        },
        {
          handleGetTodos: async () => {
            throw new TestApplicationError("custom handler owns reporting");
          },
        },
        { onError }
      );

      const res = await app.fetch(get("/todos"));

      const data = await expectJson(res, 500);
      expect(data).toEqual({
        code: "CUSTOM_UNKNOWN",
        message: "custom handler owns reporting",
      });
      expect(onError).not.toHaveBeenCalled();
    });

    test("reports custom unknown handler failures to onError", async () => {
      const onError = vi.fn();
      const handlerFailure = new TestApplicationError(
        "custom unknown handler failed"
      );
      const app = createApp(
        {
          handleUnknownErrors: () => {
            throw handlerFailure;
          },
        },
        {
          handleGetTodos: async () => {
            throw new TestApplicationError("unexpected failure");
          },
        },
        { onError }
      );

      const res = await app.fetch(get("/todos"));

      await expectErrorResponse(res, 500, "INTERNAL_SERVER_ERROR");
      expect(onError).toHaveBeenCalledWith(handlerFailure);
    });

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
        expect.objectContaining({ message: routeFailure.message })
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
      expect(data.message).toBe(badRequestDefaultError.message);
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

    test("returns a sanitized 500 when response serialization fails", async () => {
      const circularBody: Record<string, unknown> = {
        secret: "circular serialization details",
      };
      circularBody.self = circularBody;
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
      circularBody.self = circularBody;
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
      expect(data.message).toBe(payloadTooLargeDefaultError.message);
    });

    test("passes a body within the configured limit to the handler", async () => {
      const app = createApp(undefined, undefined, {
        maxBodySize: 10000,
        onError: vi.fn(),
      });

      const res = await app.fetch(post("/todos", { title: "New Todo" }));

      const data = await expectJson(res, 201);
      expect(data.title).toBe("New Todo");
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

      const res = await app.fetch(
        postRaw("/todos", "x".repeat(8), "text/plain")
      );

      const data = await expectJson(res, 201);
      expect(data.size).toBe(8);
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
      expect(data.message).toBe(payloadTooLargeDefaultError.message);
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
      expect(data.size).toBe(1_048_576);
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
      expect(data.message).toBe(payloadTooLargeDefaultError.message);
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
      expect(notFoundData.message).toBe(notFoundDefaultError.message);

      const methodNotAllowedResponse = await app.fetch(del("/todos"));
      const methodNotAllowedData = await expectErrorResponse(
        methodNotAllowedResponse,
        methodNotAllowedDefaultError.statusCode,
        methodNotAllowedDefaultError.code
      );
      expect(methodNotAllowedData.message).toBe(
        methodNotAllowedDefaultError.message
      );

      const internalServerErrorResponse = await app.fetch(get("/todos"));
      const internalServerErrorData = await expectErrorResponse(
        internalServerErrorResponse,
        internalServerErrorDefaultError.statusCode,
        internalServerErrorDefaultError.code
      );
      expect(internalServerErrorData.message).toBe(
        internalServerErrorDefaultError.message
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

  describe("Response Validation", () => {
    const anInvalidTodosResponse = (): IHttpResponse => ({
      statusCode: 200,
      header: { "x-invalid": "yes" },
      body: { invalid: true },
    });

    test("returns validated response data when response validation transforms the handler response", async () => {
      const responseValidator: IResponseValidator = {
        validate: response => ({
          ...response,
          header: { "x-response-source": "validator" },
          body: { title: "validated todo" },
        }),
        safeValidate: response => ({
          isValid: true,
          data: {
            ...response,
            header: { "x-response-source": "validator" },
            body: { title: "validated todo" },
          },
        }),
      };
      const app = new TypeweaverApp();
      const router = new CustomResponseValidatingRouter({
        validateRequests: false,
        responseValidator,
        requestHandlers: defaultHandlers({
          handleGetTodos: async () => ({
            statusCode: 200,
            header: { "x-response-source": "handler" },
            body: {
              title: "raw todo",
              sensitive: "handler-only response detail",
            },
          }),
        }),
      });
      app.route(router);

      const res = await app.fetch(get("/todos"));

      const data = await expectJson(res, 200);
      expect(data).toEqual({ title: "validated todo" });
      expect(res.headers.get("x-response-source")).toBe("validator");
    });

    test("returns the handler response unchanged when response validation is disabled", async () => {
      const handlerResponse: IHttpResponse = {
        statusCode: 200,
        header: { "x-response-source": "handler" },
        body: { source: "handler" },
      };
      const responseValidator: IResponseValidator = {
        validate: () => {
          throw new ResponseValidationError(418);
        },
        safeValidate: response => {
          return {
            isValid: true,
            data: {
              ...response,
              statusCode: 202,
              header: { "x-response-source": "validator" },
              body: { source: "validator" },
            },
          };
        },
      };
      const app = new TypeweaverApp();
      const router = new CustomResponseValidatingRouter({
        validateRequests: false,
        validateResponses: false,
        responseValidator,
        requestHandlers: defaultHandlers({
          handleGetTodos: async () => handlerResponse,
        }),
      });
      app.route(router);

      const res = await app.fetch(get("/todos"));

      const data = await expectJson(res, 200);
      expect(data).toEqual({ source: "handler" });
      expect(res.headers.get("x-response-source")).toBe("handler");
    });

    test("returns a sanitized 500 when the default response validation handler handles an invalid response", async () => {
      const app = createResponseValidatingApp(undefined, {
        handleGetTodos: async () => ({
          statusCode: 200,
          body: { leaked: "response validation internals" },
        }),
      });

      const res = await app.fetch(get("/todos"));

      const data = await expectInternalError(res);
      expect(data.message).toBe(internalServerErrorDefaultError.message);
      expect(JSON.stringify(data)).not.toContain(
        "response validation internals"
      );
    });

    test("returns the custom response validation handler response when a response is invalid", async () => {
      const handler: ResponseValidationErrorHandler = (
        _error,
        _response,
        ctx
      ) => {
        return {
          statusCode: 422,
          body: {
            code: "INVALID_RESPONSE",
            operationId: ctx.route?.operationId,
          },
        };
      };
      const app = createResponseValidatingApp(
        { handleResponseValidationErrors: handler },
        { handleGetTodos: async () => anInvalidTodosResponse() }
      );

      const res = await app.fetch(get("/todos"));

      const data = await expectJson(res, 422);
      expect(data).toEqual({
        code: "INVALID_RESPONSE",
        operationId: "listTodos",
      });
    });

    test("passes the validation error, original response, and route metadata to the custom response validation handler", async () => {
      const invalidResponse = anInvalidTodosResponse();
      let captured:
        | {
            readonly error: ResponseValidationError;
            readonly response: IHttpResponse;
            readonly route: unknown;
          }
        | undefined;
      const handler: ResponseValidationErrorHandler = (
        error,
        response,
        ctx
      ) => {
        captured = { error, response, route: ctx.route };
        return {
          statusCode: 422,
          body: { code: "INVALID_RESPONSE" },
        };
      };
      const app = createResponseValidatingApp(
        { handleResponseValidationErrors: handler },
        { handleGetTodos: async () => invalidResponse }
      );

      await app.fetch(get("/todos"));

      expect(captured?.error).toBeInstanceOf(ResponseValidationError);
      expect(captured?.error.statusCode).toBe(200);
      expect(captured?.response).toEqual(invalidResponse);
      expect(captured?.route).toEqual({
        operationId: "listTodos",
        method: "GET",
        path: "/todos",
      });
    });

    test("returns the original invalid response when response validation handling is disabled", async () => {
      const app = createResponseValidatingApp(
        { handleResponseValidationErrors: false },
        {
          handleGetTodos: async () => ({
            statusCode: 200,
            header: { "x-invalid": "yes" },
            body: { invalid: true },
          }),
        }
      );

      const res = await app.fetch(get("/todos"));

      const data = await expectJson(res, 200);
      expect(data).toEqual({ invalid: true });
      expect(res.headers.get("x-invalid")).toBe("yes");
    });

    test("returns a sanitized 500 when the custom response validation handler throws", async () => {
      const onError = vi.fn();
      const handlerFailure = new TestApplicationError(
        "response validation handler failed"
      );
      const app = createResponseValidatingApp(
        {
          handleResponseValidationErrors: () => {
            throw handlerFailure;
          },
        },
        {
          handleGetTodos: async () => ({
            statusCode: 200,
            body: { secret: "invalid response detail" },
          }),
        },
        { onError }
      );

      const res = await app.fetch(get("/todos"));

      const data = await expectInternalError(res);
      expect(JSON.stringify(data)).not.toContain("invalid response detail");
    });

    test("reports onError when the custom response validation handler throws", async () => {
      const onError = vi.fn();
      const handlerFailure = new TestApplicationError(
        "response validation handler failed"
      );
      const app = createResponseValidatingApp(
        {
          handleResponseValidationErrors: () => {
            throw handlerFailure;
          },
        },
        {
          handleGetTodos: async () => ({
            statusCode: 200,
            body: { invalid: true },
          }),
        },
        { onError }
      );

      await app.fetch(get("/todos"));

      expect(onError).toHaveBeenCalledWith(handlerFailure);
    });

    test("calls the custom HTTP response handler for thrown typed responses when response validation is enabled", async () => {
      const typedResponse = aConflictTypedResponse();
      const httpResponseHandler = vi.fn(() => ({
        statusCode: 200,
        body: { handled: true },
      }));
      const app = createTypedResponseValidationApp({
        typedResponse,
        handleHttpResponseErrors: httpResponseHandler,
      });

      const res = await app.fetch(get("/todos"));

      const data = await expectJson(res, 200);
      expect(data).toEqual({ handled: true });
      expect(httpResponseHandler).toHaveBeenCalledWith(
        typedResponse,
        expect.anything()
      );
    });

    test("validates the transformed typed response handler result before sending it", async () => {
      const app = createTypedResponseValidationApp({
        responseValidator: aValidatorThatMarksResponsesAsValidated(),
        handleHttpResponseErrors: () => ({
          statusCode: 200,
          header: { "x-response-source": "handler" },
          body: { source: "handler", stripped: true },
        }),
      });

      const res = await app.fetch(get("/todos"));

      const data = await expectJson(res, 200);
      expect(data).toEqual({ source: "validated" });
      expect(res.headers.get("x-response-source")).toBe("validator");
    });

    test("invokes the response validation handler when a transformed thrown typed response is invalid", async () => {
      const app = createTypedResponseValidationApp({
        responseValidator: invalidResponseValidator,
        handleHttpResponseErrors: () => ({
          statusCode: 409,
          body: { code: "HTTP_RESPONSE_HANDLER" },
        }),
        handleResponseValidationErrors: (_error, response, ctx) => ({
          statusCode: 422,
          body: {
            code: "INVALID_TRANSFORMED_RESPONSE",
            originalStatus: response.statusCode,
            operationId: ctx.route?.operationId,
          },
        }),
      });

      const res = await app.fetch(get("/todos"));

      const data = await expectJson(res, 422);
      expect(data).toEqual({
        code: "INVALID_TRANSFORMED_RESPONSE",
        originalStatus: 409,
        operationId: "listTodos",
      });
    });

    test("falls through to the unknown handler when a typed response handler throws", async () => {
      const typedResponse = aConflictTypedResponse();
      const onError = vi.fn();
      const handlerFailure = new TestApplicationError(
        "typed response handler failed"
      );
      const unknownHandler = vi.fn(() => ({
        statusCode: 500,
        body: { code: "CUSTOM_UNKNOWN", message: "typed response escaped" },
      }));
      const app = createTypedResponseValidationApp({
        typedResponse,
        handleHttpResponseErrors: () => {
          throw handlerFailure;
        },
        handleUnknownErrors: unknownHandler,
        onError,
      });

      const res = await app.fetch(get("/todos"));

      const data = await expectJson(res, 500);
      expect(data).toEqual({
        code: "CUSTOM_UNKNOWN",
        message: "typed response escaped",
      });
      expect(onError).toHaveBeenCalledWith(handlerFailure);
      expect(unknownHandler).toHaveBeenCalledWith(
        typedResponse,
        expect.anything()
      );
    });

    test("strips HEAD bodies after validating transformed thrown typed responses", async () => {
      const app = createTypedResponseValidationApp({
        responseValidator: aValidatorThatMarksResponsesAsValidated(),
        handleHttpResponseErrors: () => ({
          statusCode: 200,
          header: { "x-response-source": "handler" },
          body: { source: "handler" },
        }),
      });

      const res = await app.fetch(head("/todos"));

      expect(res.status).toBe(200);
      expect(res.headers.get("x-response-source")).toBe("validator");
      await expectNoBody(res);
    });

    test("returns invalid transformed typed responses when response validation handling is disabled", async () => {
      const app = createTypedResponseValidationApp({
        responseValidator: invalidResponseValidator,
        handleHttpResponseErrors: () => ({
          statusCode: 409,
          header: { "x-response-source": "handler" },
          body: { code: "HTTP_RESPONSE_HANDLER" },
        }),
        handleResponseValidationErrors: false,
      });

      const res = await app.fetch(get("/todos"));

      const data = await expectJson(res, 409);
      expect(data).toEqual({ code: "HTTP_RESPONSE_HANDLER" });
      expect(res.headers.get("x-response-source")).toBe("handler");
    });

    test("falls through to the unknown handler for thrown typed responses when HTTP response handling is disabled with response validation enabled", async () => {
      const unknownHandler = vi.fn(() => ({
        statusCode: 500,
        body: { code: "CUSTOM_UNKNOWN" },
      }));
      const app = createTypedResponseValidationApp({
        handleHttpResponseErrors: false,
        handleUnknownErrors: unknownHandler,
      });

      const res = await app.fetch(get("/todos"));

      await expectErrorResponse(res, 500, "CUSTOM_UNKNOWN");
      expect(unknownHandler).toHaveBeenCalledWith(
        expect.objectContaining({ type: "ConflictError", statusCode: 409 }),
        expect.anything()
      );
    });

    test("keeps default typed response handling silent for onError when response validation is enabled", async () => {
      const onError = vi.fn();
      const app = createTypedResponseValidationApp({
        onError,
      });

      const res = await app.fetch(get("/todos"));

      await expectErrorResponse(res, 409, "CONFLICT");
      expect(onError).not.toHaveBeenCalled();
    });
  });

  describe("Defensive Validation", () => {
    test("should throw when route() is called with prefix but no router", () => {
      const app = new TypeweaverApp();

      // @ts-expect-error — testing runtime guard
      const error = captureError(() => app.route("/prefix"));

      if (!(error instanceof MissingRouterForPrefixedMountError)) {
        throw new TestAssertionError(
          "Expected MissingRouterForPrefixedMountError to be thrown"
        );
      }

      expect(error).toEqual(
        expect.objectContaining({
          prefix: "/prefix",
        })
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
            const id = _req.param?.todoId ?? "unknown";
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
        expect(results[i]!.id).toBe(`todo-${i}`);
        expect(results[i]!.stateId).toBe(`todo-${i}`);
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
      expect(data.route).toEqual({
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
      expect(data.operationId).toBe("getTodo");
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
      expect(data.tags).toEqual(["a", "b", "c"]);
    });
  });
});
