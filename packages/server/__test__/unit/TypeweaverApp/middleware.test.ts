import { TestApplicationError } from "test-utils";
import { describe, expect, test, vi } from "vitest";
import { defineMiddleware } from "../../../src/lib/TypedMiddleware.js";
import { TypeweaverApp } from "../../../src/lib/TypeweaverApp.js";
import {
  del,
  expectErrorResponse,
  expectJson,
  get,
  parseJsonRecord,
  readJsonRecord,
} from "../../helpers.js";
import { createApp, defaultHandlers, TestRouter } from "./fixtures.js";

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
    expect(data["userId"]).toBe("user-99");
  });
});

describe("TypeweaverApp middleware state and fallback routes", () => {
  test("ignores middleware state keys that could pollute object prototypes", async () => {
    const suspiciousState = parseJsonRecord(
      '{"__proto__":{"polluted":true},"constructor":"bad","prototype":"bad","safe":"ok"}'
    );
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
    expect(data["custom"]).toBe(true);
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
        app.fetch(get(`/todos/todo-${i}`)).then(readJsonRecord)
      )
    );

    for (let i = 0; i < requestCount; i++) {
      expect(results[i]?.["id"]).toBe(`todo-${i}`);
      expect(results[i]?.["stateId"]).toBe(`todo-${i}`);
    }
  });
});
