import { HttpMethod, RequestValidationError } from "@rexeus/typeweaver-core";
import type {
  IRawHttpRequest,
  IRequestValidator,
} from "@rexeus/typeweaver-core";
import { describe, expect, test } from "vitest";
import { TypeweaverApp } from "../../src/lib/TypeweaverApp.js";
import { TypeweaverRouter } from "../../src/lib/TypeweaverRouter.js";
import {
  expectJson,
  get,
  noopResponseValidator,
  noopValidator,
} from "../helpers.js";
import type { RequestHandler } from "../../src/lib/RequestHandler.js";
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

function createAppMountedAt(prefix: string): TypeweaverApp {
  const app = new TypeweaverApp();
  const router = new TestRouter({
    validateRequests: false,
    requestHandlers: defaultHandlers(),
  });
  app.route(prefix, router);
  return app;
}

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
    expect(data["id"]).toBe("my-todo");
  });

  test("should normalize trailing slashes on prefix", async () => {
    const app = createAppMountedAt("/api/v1////");

    const res = await app.fetch(get("/api/v1/todos"));

    expect(res.status).toBe(200);
  });

  test("preserves an untrusted prefix with a long slash sequence", async () => {
    const adversarialPrefix = `${"/".repeat(40_000)}x`;
    const app = createAppMountedAt(adversarialPrefix);

    const res = await app.fetch(get(`${adversarialPrefix}/todos`));

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
        this.route({
          operationId: "listUsers",
          method: HttpMethod.GET,
          path: "/users",
          requestValidator: noopValidator,
          responseValidator: noopResponseValidator,
          handler: async (req: IRawHttpRequest, ctx) =>
            this.requestHandlers.handleGetUsers(req, ctx),
        });
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
    expect(users[0]).toMatchObject({ name: "Alice" });
  });
});
