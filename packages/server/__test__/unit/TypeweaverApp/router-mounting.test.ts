import { HttpMethod } from "@rexeus/typeweaver-core";
import type { IRawHttpRequest } from "@rexeus/typeweaver-core";
import { captureError, TestAssertionError } from "test-utils";
import { describe, expect, test } from "vitest";
import { MissingRouterForPrefixedMountError } from "../../../src/lib/errors/index.js";
import { defineMiddleware } from "../../../src/lib/TypedMiddleware.js";
import { TypeweaverApp } from "../../../src/lib/TypeweaverApp.js";
import { TypeweaverRouter } from "../../../src/lib/TypeweaverRouter.js";
import {
  expectJson,
  get,
  noopResponseValidator,
  noopValidator,
} from "../../helpers.js";
import { defaultHandlers, TestRouter } from "./fixtures.js";
import type { RequestHandler } from "../../../src/lib/RequestHandler.js";
import type { TypeweaverRouterOptions } from "../../../src/lib/TypeweaverRouter.js";

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
