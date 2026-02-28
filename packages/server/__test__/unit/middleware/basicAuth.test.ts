import { describe, expect, test, vi } from "vitest";
import { executeMiddlewarePipeline } from "../../../src/lib/Middleware";
import { basicAuth } from "../../../src/lib/middleware/basicAuth";
import { createServerContext } from "../../helpers";

const encode = (str: string) => btoa(str);

describe("basicAuth", () => {
  const alwaysValid = () => true;
  const alwaysInvalid = () => false;

  test("should return 401 when Authorization header is missing", async () => {
    const mw = basicAuth({ verifyCredentials: alwaysValid });
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
      'Basic realm="Secure Area"'
    );
  });

  test("should return 401 when Authorization is not Basic scheme", async () => {
    const mw = basicAuth({ verifyCredentials: alwaysValid });
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

  test("should return 401 when base64 is invalid", async () => {
    const mw = basicAuth({ verifyCredentials: alwaysValid });
    const ctx = createServerContext({
      header: { authorization: "Basic !!!invalid!!!" },
    });

    const response = await executeMiddlewarePipeline(
      [mw.handler],
      ctx,
      async () => ({ statusCode: 200 })
    );

    expect(response.statusCode).toBe(401);
  });

  test("should return 401 when decoded string has no colon", async () => {
    const mw = basicAuth({ verifyCredentials: alwaysValid });
    const ctx = createServerContext({
      header: { authorization: `Basic ${encode("nocolon")}` },
    });

    const response = await executeMiddlewarePipeline(
      [mw.handler],
      ctx,
      async () => ({ statusCode: 200 })
    );

    expect(response.statusCode).toBe(401);
  });

  test("should return 401 when verifyCredentials returns false", async () => {
    const mw = basicAuth({ verifyCredentials: alwaysInvalid });
    const ctx = createServerContext({
      header: { authorization: `Basic ${encode("user:pass")}` },
    });

    const response = await executeMiddlewarePipeline(
      [mw.handler],
      ctx,
      async () => ({ statusCode: 200 })
    );

    expect(response.statusCode).toBe(401);
  });

  test("should return 401 when verifyCredentials throws", async () => {
    const mw = basicAuth({
      verifyCredentials: () => {
        throw new Error("DB error");
      },
    });
    const ctx = createServerContext({
      header: { authorization: `Basic ${encode("user:pass")}` },
    });

    const response = await executeMiddlewarePipeline(
      [mw.handler],
      ctx,
      async () => ({ statusCode: 200 })
    );

    expect(response.statusCode).toBe(401);
  });

  test("should pass through with valid credentials", async () => {
    const verifyCredentials = vi.fn(() => true);
    const mw = basicAuth({ verifyCredentials });
    const ctx = createServerContext({
      header: { authorization: `Basic ${encode("admin:secret")}` },
    });

    const response = await executeMiddlewarePipeline(
      [mw.handler],
      ctx,
      async () => ({ statusCode: 200, body: { ok: true } })
    );

    expect(response.statusCode).toBe(200);
    expect(verifyCredentials).toHaveBeenCalledWith("admin", "secret", ctx);
  });

  test("should provide username in state", async () => {
    const mw = basicAuth({ verifyCredentials: alwaysValid });
    const ctx = createServerContext({
      header: { authorization: `Basic ${encode("dennis:pass123")}` },
    });

    await executeMiddlewarePipeline([mw.handler], ctx, async () => {
      expect(ctx.state.get("username")).toBe("dennis");
      return { statusCode: 200 };
    });
  });

  test("should handle password containing colons", async () => {
    const verifyCredentials = vi.fn(() => true);
    const mw = basicAuth({ verifyCredentials });
    const ctx = createServerContext({
      header: {
        authorization: `Basic ${encode("user:pass:with:colons")}`,
      },
    });

    await executeMiddlewarePipeline([mw.handler], ctx, async () => {
      return { statusCode: 200 };
    });

    expect(verifyCredentials).toHaveBeenCalledWith(
      "user",
      "pass:with:colons",
      ctx
    );
  });

  test("should use custom realm", async () => {
    const mw = basicAuth({
      verifyCredentials: alwaysValid,
      realm: "Admin Panel",
    });
    const ctx = createServerContext();

    const response = await executeMiddlewarePipeline(
      [mw.handler],
      ctx,
      async () => ({ statusCode: 200 })
    );

    expect(response.header?.["www-authenticate"]).toBe(
      'Basic realm="Admin Panel"'
    );
  });

  test("should support async verifyCredentials", async () => {
    const mw = basicAuth({
      verifyCredentials: async (user, pass) =>
        user === "admin" && pass === "correct",
    });
    const ctx = createServerContext({
      header: { authorization: `Basic ${encode("admin:correct")}` },
    });

    const response = await executeMiddlewarePipeline(
      [mw.handler],
      ctx,
      async () => ({ statusCode: 200 })
    );

    expect(response.statusCode).toBe(200);
  });

  test("should use custom unauthorizedMessage", async () => {
    const mw = basicAuth({
      verifyCredentials: alwaysValid,
      unauthorizedMessage: "Invalid credentials provided",
    });
    const ctx = createServerContext();

    const response = await executeMiddlewarePipeline(
      [mw.handler],
      ctx,
      async () => ({ statusCode: 200 })
    );

    expect(response.statusCode).toBe(401);
    expect(response.body).toEqual({
      code: "UNAUTHORIZED",
      message: "Invalid credentials provided",
    });
  });

  test("should use onUnauthorized handler when provided", async () => {
    const mw = basicAuth({
      verifyCredentials: alwaysInvalid,
      onUnauthorized: () => ({
        statusCode: 401,
        header: { "content-type": "text/plain" },
        body: "Go away",
      }),
    });
    const ctx = createServerContext({
      header: { authorization: `Basic ${encode("user:pass")}` },
    });

    const response = await executeMiddlewarePipeline(
      [mw.handler],
      ctx,
      async () => ({ statusCode: 200 })
    );

    expect(response.statusCode).toBe(401);
    expect(response.body).toBe("Go away");
    expect(response.header?.["content-type"]).toBe("text/plain");
  });

  test("should pass context to onUnauthorized handler", async () => {
    const onUnauthorized = vi.fn(() => ({
      statusCode: 403,
      body: { error: "forbidden" },
    }));
    const mw = basicAuth({
      verifyCredentials: alwaysInvalid,
      onUnauthorized,
    });
    const ctx = createServerContext({
      path: "/admin",
      header: { authorization: `Basic ${encode("user:wrong")}` },
    });

    await executeMiddlewarePipeline([mw.handler], ctx, async () => ({
      statusCode: 200,
    }));

    expect(onUnauthorized).toHaveBeenCalledWith(ctx);
  });

  test("should prefer onUnauthorized over unauthorizedMessage", async () => {
    const mw = basicAuth({
      verifyCredentials: alwaysInvalid,
      unauthorizedMessage: "ignored",
      onUnauthorized: () => ({
        statusCode: 401,
        body: { custom: true },
      }),
    });
    const ctx = createServerContext({
      header: { authorization: `Basic ${encode("user:pass")}` },
    });

    const response = await executeMiddlewarePipeline(
      [mw.handler],
      ctx,
      async () => ({ statusCode: 200 })
    );

    expect(response.body).toEqual({ custom: true });
  });

  test("should return 401 when encoded value is empty", async () => {
    const mw = basicAuth({ verifyCredentials: alwaysValid });
    const ctx = createServerContext({
      header: { authorization: "Basic " },
    });

    const response = await executeMiddlewarePipeline(
      [mw.handler],
      ctx,
      async () => ({ statusCode: 200 })
    );

    expect(response.statusCode).toBe(401);
  });
});
