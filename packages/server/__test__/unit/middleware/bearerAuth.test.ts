import { describe, expect, test, vi } from "vitest";
import { executeMiddlewarePipeline } from "../../../src/lib/Middleware";
import { bearerAuth } from "../../../src/lib/middleware/bearerAuth";
import { createServerContext } from "../../helpers";

describe("bearerAuth", () => {
  const alwaysValid = () => true;
  const alwaysInvalid = () => false;

  test("should return 401 when Authorization header is missing", async () => {
    const mw = bearerAuth({ verifyToken: alwaysValid });
    const ctx = createServerContext();

    const response = await executeMiddlewarePipeline(
      [mw.handler],
      ctx,
      async () => ({ statusCode: 200 })
    );

    expect(response.statusCode).toBe(401);
    expect(response.body).toEqual({
      code: "UNAUTHORIZED",
      message: "Unauthorized",
    });
    expect(response.header?.["www-authenticate"]).toBe(
      'Bearer realm="Secure Area"'
    );
  });

  test("should return 401 when Authorization is not Bearer scheme", async () => {
    const mw = bearerAuth({ verifyToken: alwaysValid });
    const ctx = createServerContext({
      header: { authorization: "Basic dXNlcjpwYXNz" },
    });

    const response = await executeMiddlewarePipeline(
      [mw.handler],
      ctx,
      async () => ({ statusCode: 200 })
    );

    expect(response.statusCode).toBe(401);
  });

  test("should return 401 when token is empty", async () => {
    const mw = bearerAuth({ verifyToken: alwaysValid });
    const ctx = createServerContext({
      header: { authorization: "Bearer " },
    });

    const response = await executeMiddlewarePipeline(
      [mw.handler],
      ctx,
      async () => ({ statusCode: 200 })
    );

    expect(response.statusCode).toBe(401);
  });

  test("should return 401 when verifyToken returns false", async () => {
    const mw = bearerAuth({ verifyToken: alwaysInvalid });
    const ctx = createServerContext({
      header: { authorization: "Bearer valid-looking-token" },
    });

    const response = await executeMiddlewarePipeline(
      [mw.handler],
      ctx,
      async () => ({ statusCode: 200 })
    );

    expect(response.statusCode).toBe(401);
  });

  test("should return 401 when verifyToken throws", async () => {
    const mw = bearerAuth({
      verifyToken: () => {
        throw new Error("DB connection failed");
      },
    });
    const ctx = createServerContext({
      header: { authorization: "Bearer some-token" },
    });

    const response = await executeMiddlewarePipeline(
      [mw.handler],
      ctx,
      async () => ({ statusCode: 200 })
    );

    expect(response.statusCode).toBe(401);
  });

  test("should pass through with valid token", async () => {
    const verifyToken = vi.fn(() => true);
    const mw = bearerAuth({ verifyToken });
    const ctx = createServerContext({
      header: { authorization: "Bearer my-secret-token" },
    });

    const response = await executeMiddlewarePipeline(
      [mw.handler],
      ctx,
      async () => ({ statusCode: 200, body: { ok: true } })
    );

    expect(response.statusCode).toBe(200);
    expect(verifyToken).toHaveBeenCalledWith("my-secret-token", ctx);
  });

  test("should provide token in state", async () => {
    const mw = bearerAuth({ verifyToken: alwaysValid });
    const ctx = createServerContext({
      header: { authorization: "Bearer the-token" },
    });

    await executeMiddlewarePipeline([mw.handler], ctx, async () => {
      expect(ctx.state.get("token")).toBe("the-token");
      return { statusCode: 200 };
    });
  });

  test("should support async verifyToken", async () => {
    const mw = bearerAuth({
      verifyToken: async token => token === "async-valid",
    });
    const ctx = createServerContext({
      header: { authorization: "Bearer async-valid" },
    });

    const response = await executeMiddlewarePipeline(
      [mw.handler],
      ctx,
      async () => ({ statusCode: 200 })
    );

    expect(response.statusCode).toBe(200);
  });

  test("should use custom realm", async () => {
    const mw = bearerAuth({
      verifyToken: alwaysValid,
      realm: "API",
    });
    const ctx = createServerContext();

    const response = await executeMiddlewarePipeline(
      [mw.handler],
      ctx,
      async () => ({ statusCode: 200 })
    );

    expect(response.header?.["www-authenticate"]).toBe('Bearer realm="API"');
  });

  test("should use custom unauthorized message", async () => {
    const mw = bearerAuth({
      verifyToken: alwaysInvalid,
      unauthorizedMessage: "Invalid API key",
    });
    const ctx = createServerContext({
      header: { authorization: "Bearer bad-token" },
    });

    const response = await executeMiddlewarePipeline(
      [mw.handler],
      ctx,
      async () => ({ statusCode: 200 })
    );

    expect(response.body).toEqual({
      code: "UNAUTHORIZED",
      message: "Invalid API key",
    });
  });

  test("should use onUnauthorized handler when provided", async () => {
    const mw = bearerAuth({
      verifyToken: alwaysInvalid,
      onUnauthorized: () => ({
        statusCode: 401,
        header: { "content-type": "application/problem+json" },
        body: { type: "about:blank", title: "Unauthorized", status: 401 },
      }),
    });
    const ctx = createServerContext({
      header: { authorization: "Bearer bad-token" },
    });

    const response = await executeMiddlewarePipeline(
      [mw.handler],
      ctx,
      async () => ({ statusCode: 200 })
    );

    expect(response.statusCode).toBe(401);
    expect(response.body).toEqual({
      type: "about:blank",
      title: "Unauthorized",
      status: 401,
    });
  });

  test("should pass context to onUnauthorized handler", async () => {
    const onUnauthorized = vi.fn(() => ({
      statusCode: 401,
      body: { error: "denied" },
    }));
    const mw = bearerAuth({
      verifyToken: alwaysInvalid,
      onUnauthorized,
    });
    const ctx = createServerContext({
      path: "/api/secret",
      header: { authorization: "Bearer expired" },
    });

    await executeMiddlewarePipeline([mw.handler], ctx, async () => ({
      statusCode: 200,
    }));

    expect(onUnauthorized).toHaveBeenCalledWith(ctx);
  });

  test("should prefer onUnauthorized over unauthorizedMessage", async () => {
    const mw = bearerAuth({
      verifyToken: alwaysInvalid,
      unauthorizedMessage: "ignored",
      onUnauthorized: () => ({
        statusCode: 401,
        body: { custom: true },
      }),
    });
    const ctx = createServerContext({
      header: { authorization: "Bearer nope" },
    });

    const response = await executeMiddlewarePipeline(
      [mw.handler],
      ctx,
      async () => ({ statusCode: 200 })
    );

    expect(response.body).toEqual({ custom: true });
  });

  test("should not call downstream handler on auth failure", async () => {
    const mw = bearerAuth({ verifyToken: alwaysInvalid });
    const ctx = createServerContext({
      header: { authorization: "Bearer bad" },
    });
    let handlerCalled = false;

    await executeMiddlewarePipeline([mw.handler], ctx, async () => {
      handlerCalled = true;
      return { statusCode: 200 };
    });

    expect(handlerCalled).toBe(false);
  });
});
