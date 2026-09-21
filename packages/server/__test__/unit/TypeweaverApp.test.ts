import {
  HttpMethod,
  methodNotAllowedDefaultError,
  notFoundDefaultError,
  RequestValidationError,
} from "@rexeus/typeweaver-core";
import type {
  IRawHttpRequest,
  IRequestValidator,
} from "@rexeus/typeweaver-core";
import { TestAssertionError } from "test-utils";
import { describe, expect, test } from "vitest";
import { TypeweaverApp } from "../../src/lib/TypeweaverApp.js";
import { TypeweaverRouter } from "../../src/lib/TypeweaverRouter.js";
import {
  del,
  expectErrorResponse,
  expectJson,
  get,
  head,
  noopResponseValidator,
  noopValidator,
  post,
  put,
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

type HeadAwareHandlers = {
  handleGetTodos: RequestHandler;
  handleHeadTodos: RequestHandler;
};

class HeadAwareRouter extends TypeweaverRouter<HeadAwareHandlers> {
  constructor(options: TypeweaverRouterOptions<HeadAwareHandlers>) {
    super(options);

    this.route({
      operationId: "listTodos",
      method: HttpMethod.GET,
      path: "/todos",
      requestValidator: noopValidator,
      responseValidator: noopResponseValidator,
      handler: async (req: IRawHttpRequest, ctx) =>
        this.requestHandlers.handleGetTodos(req, ctx),
    });

    this.route({
      operationId: "headTodos",
      method: HttpMethod.HEAD,
      path: "/todos",
      requestValidator: noopValidator,
      responseValidator: noopResponseValidator,
      handler: async (req: IRawHttpRequest, ctx) =>
        this.requestHandlers.handleHeadTodos(req, ctx),
    });
  }
}

type PostOnlyHandlers = {
  handleCreateTodo: RequestHandler;
};

class PostOnlyRouter extends TypeweaverRouter<PostOnlyHandlers, boolean> {
  constructor(options: TypeweaverRouterOptions<PostOnlyHandlers, boolean>) {
    super(options);

    this.route({
      operationId: "createTodo",
      method: HttpMethod.POST,
      path: "/todos",
      requestValidator: noopValidator,
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

async function expectNoBody(res: Response): Promise<void> {
  expect(await res.text()).toBe("");
}

function expectAllow(res: Response, methods: readonly string[]): void {
  const allow = res.headers.get("allow");
  if (allow === null) {
    throw new TestAssertionError("expected an Allow response header");
  }
  expect(
    allow
      .split(",")
      .map(method => method.trim())
      .sort()
  ).toEqual([...methods].sort());
}

describe("TypeweaverApp route matching", () => {
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
    expect(data["title"]).toBe("New Todo");
  });

  test("should extract path parameters", async () => {
    const app = createApp();

    const res = await app.fetch(get("/todos/todo-42"));

    const data = await expectJson(res, 200);
    expect(data["id"]).toBe("todo-42");
  });

  test("should return 404 for unregistered paths", async () => {
    const app = createApp();

    const res = await app.fetch(get("/nonexistent"));

    const data = await expectErrorResponse(
      res,
      notFoundDefaultError.statusCode,
      notFoundDefaultError.code
    );
    expect(data["message"]).toBe(notFoundDefaultError["message"]);
  });

  test("returns 405 with allowed methods for an unsupported method on a registered path", async () => {
    const app = createApp();

    const res = await app.fetch(del("/todos"));

    const data = await expectErrorResponse(
      res,
      methodNotAllowedDefaultError.statusCode,
      methodNotAllowedDefaultError.code
    );
    expect(data["message"]).toBe(methodNotAllowedDefaultError["message"]);
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
