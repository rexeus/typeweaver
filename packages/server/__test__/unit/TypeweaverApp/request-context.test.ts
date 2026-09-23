import { describe, expect, test } from "vitest";
import { defineMiddleware } from "../../../src/lib/TypedMiddleware.js";
import { BASE_URL, del, expectJson, get } from "../../helpers.js";
import { createApp } from "./fixtures.js";

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
    expect(data["route"]).toEqual({
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
    expect(data["operationId"]).toBe("getTodo");
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
