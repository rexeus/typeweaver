import { describe, expect, test, vi } from "vitest";
import { executeMiddlewarePipeline } from "../../../src/lib/Middleware";
import { scoped, except } from "../../../src/lib/middleware/scoped";
import { defineMiddleware } from "../../../src/lib/TypedMiddleware";
import { createServerContext } from "../../helpers";

const marker = defineMiddleware(async (ctx, next) => {
  const response = await next();
  return {
    ...response,
    header: { ...response.header, "x-marker": "applied" },
  };
});

const finalHandler = async () => ({ statusCode: 200, body: { ok: true } });

describe("scoped", () => {
  test("should apply middleware when path matches exactly", async () => {
    const mw = scoped(["/api/users"], marker);
    const ctx = createServerContext({ path: "/api/users" });

    const response = await executeMiddlewarePipeline(
      [mw.handler],
      ctx,
      finalHandler
    );

    expect(response.header?.["x-marker"]).toBe("applied");
  });

  test("should skip middleware when path does not match", async () => {
    const mw = scoped(["/api/users"], marker);
    const ctx = createServerContext({ path: "/health" });

    const response = await executeMiddlewarePipeline(
      [mw.handler],
      ctx,
      finalHandler
    );

    expect(response.header?.["x-marker"]).toBeUndefined();
  });

  test("should support wildcard patterns", async () => {
    const mw = scoped(["/api/*"], marker);
    const ctx = createServerContext({ path: "/api/users/123" });

    const response = await executeMiddlewarePipeline(
      [mw.handler],
      ctx,
      finalHandler
    );

    expect(response.header?.["x-marker"]).toBe("applied");
  });

  test("should support parameterized patterns", async () => {
    const mw = scoped(["/users/:id"], marker);
    const ctx = createServerContext({ path: "/users/42" });

    const response = await executeMiddlewarePipeline(
      [mw.handler],
      ctx,
      finalHandler
    );

    expect(response.header?.["x-marker"]).toBe("applied");
  });

  test("should not match parameterized pattern with extra segments", async () => {
    const mw = scoped(["/users/:id"], marker);
    const ctx = createServerContext({ path: "/users/42/posts" });

    const response = await executeMiddlewarePipeline(
      [mw.handler],
      ctx,
      finalHandler
    );

    expect(response.header?.["x-marker"]).toBeUndefined();
  });

  test("should match any of multiple patterns", async () => {
    const mw = scoped(["/api/*", "/admin/*"], marker);
    const ctx = createServerContext({ path: "/admin/dashboard" });

    const response = await executeMiddlewarePipeline(
      [mw.handler],
      ctx,
      finalHandler
    );

    expect(response.header?.["x-marker"]).toBe("applied");
  });

  test("should still call next() when skipped", async () => {
    const mw = scoped(["/api/*"], marker);
    const ctx = createServerContext({ path: "/health" });

    const response = await executeMiddlewarePipeline(
      [mw.handler],
      ctx,
      finalHandler
    );

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({ ok: true });
  });

  test("should allow wrapped middleware to short-circuit", async () => {
    const guard = defineMiddleware(async (_ctx, _next) => ({
      statusCode: 403,
      body: { code: "FORBIDDEN", message: "Nope" },
    }));
    const mw = scoped(["/secret/*"], guard);
    const ctx = createServerContext({ path: "/secret/data" });

    const response = await executeMiddlewarePipeline(
      [mw.handler],
      ctx,
      finalHandler
    );

    expect(response.statusCode).toBe(403);
  });

  test("should invoke wrapped middleware handler with correct context", async () => {
    const spy = vi.fn(async (_ctx: any, next: any) => next());
    const spyMw = defineMiddleware(spy);
    const mw = scoped(["/test"], spyMw);
    const ctx = createServerContext({ path: "/test" });

    await executeMiddlewarePipeline([mw.handler], ctx, finalHandler);

    expect(spy).toHaveBeenCalledOnce();
    expect(spy.mock.calls[0]![0]).toBe(ctx);
  });
});

describe("except", () => {
  test("should apply middleware when path does not match exclusion", async () => {
    const mw = except(["/health"], marker);
    const ctx = createServerContext({ path: "/api/users" });

    const response = await executeMiddlewarePipeline(
      [mw.handler],
      ctx,
      finalHandler
    );

    expect(response.header?.["x-marker"]).toBe("applied");
  });

  test("should skip middleware when path matches exclusion", async () => {
    const mw = except(["/health"], marker);
    const ctx = createServerContext({ path: "/health" });

    const response = await executeMiddlewarePipeline(
      [mw.handler],
      ctx,
      finalHandler
    );

    expect(response.header?.["x-marker"]).toBeUndefined();
  });

  test("should skip middleware for any excluded pattern", async () => {
    const mw = except(["/health", "/ready"], marker);
    const ctx = createServerContext({ path: "/ready" });

    const response = await executeMiddlewarePipeline(
      [mw.handler],
      ctx,
      finalHandler
    );

    expect(response.header?.["x-marker"]).toBeUndefined();
  });

  test("should support wildcard exclusion patterns", async () => {
    const mw = except(["/internal/*"], marker);
    const ctx = createServerContext({ path: "/internal/metrics" });

    const response = await executeMiddlewarePipeline(
      [mw.handler],
      ctx,
      finalHandler
    );

    expect(response.header?.["x-marker"]).toBeUndefined();
  });

  test("should apply middleware on non-excluded wildcard paths", async () => {
    const mw = except(["/internal/*"], marker);
    const ctx = createServerContext({ path: "/api/data" });

    const response = await executeMiddlewarePipeline(
      [mw.handler],
      ctx,
      finalHandler
    );

    expect(response.header?.["x-marker"]).toBe("applied");
  });

  test("should still call next() when excluded", async () => {
    const mw = except(["/health"], marker);
    const ctx = createServerContext({ path: "/health" });

    const response = await executeMiddlewarePipeline(
      [mw.handler],
      ctx,
      finalHandler
    );

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({ ok: true });
  });

  test("should support parameterized exclusion patterns", async () => {
    const mw = except(["/users/:id/debug"], marker);
    const ctx = createServerContext({ path: "/users/42/debug" });

    const response = await executeMiddlewarePipeline(
      [mw.handler],
      ctx,
      finalHandler
    );

    expect(response.header?.["x-marker"]).toBeUndefined();
  });
});
