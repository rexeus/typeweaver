import { unauthorizedDefaultError } from "@rexeus/typeweaver-core";
import type { IHttpResponse } from "@rexeus/typeweaver-core";
import { describe, expect, test, vi } from "vitest";
import { executeMiddlewarePipeline } from "../../../src/lib/Middleware.js";
import { bearerAuth } from "../../../src/lib/middleware/bearerAuth.js";
import { createServerContext } from "../../helpers.js";
import type { BearerAuthOptions } from "../../../src/lib/middleware/bearerAuth.js";
import type { ServerContext } from "../../../src/lib/ServerContext.js";

const unauthorizedBody = {
  code: unauthorizedDefaultError.code,
  message: unauthorizedDefaultError.message,
};

const alwaysValid = () => true;
const alwaysInvalid = () => false;

const finalHandlerShouldNotRun = async () => ({
  statusCode: 500,
  body: { error: "final handler used" },
});

type RunBearerAuthOptions = {
  readonly header?: Record<string, string | string[]>;
  readonly verifyToken?: BearerAuthOptions["verifyToken"];
  readonly realm?: string;
  readonly onUnauthorized?: BearerAuthOptions["onUnauthorized"];
  readonly finalHandler?: (ctx: ServerContext) => Promise<IHttpResponse>;
};

async function executeBearerAuth(
  options: RunBearerAuthOptions = {}
): Promise<IHttpResponse> {
  const { response } = await executeBearerAuthWithContext(options);
  return response;
}

async function executeBearerAuthWithContext({
  header,
  verifyToken = alwaysValid,
  realm,
  onUnauthorized,
  finalHandler = async () => ({ statusCode: 200, body: { ok: true } }),
}: RunBearerAuthOptions = {}): Promise<{
  readonly response: IHttpResponse;
  readonly ctx: ServerContext;
}> {
  const mw = bearerAuth({
    verifyToken,
    ...(realm !== undefined ? { realm } : {}),
    ...(onUnauthorized !== undefined ? { onUnauthorized } : {}),
  });
  const ctx = createServerContext((header ? { header } : {}));

  const response = await executeMiddlewarePipeline([mw.handler], ctx, () =>
    finalHandler(ctx)
  );

  return { response, ctx };
}

function expectDefaultUnauthorized(response: IHttpResponse): void {
  expect(response.statusCode).toBe(401);
  expect(response.body).toEqual(unauthorizedBody);
  expect(response.header?.["www-authenticate"]).toBe(
    'Bearer realm="Secure Area"'
  );
}

describe("bearerAuth", () => {
  test.each<{
    readonly case: string;
    readonly header?: Record<string, string | string[]>;
  }>([
    { case: "missing authorization", header: undefined },
    {
      case: "non-Bearer scheme",
      header: { authorization: "Basic dXNlcjpwYXNz" },
    },
    { case: "empty token", header: { authorization: "Bearer " } },
    {
      case: "multiple authorization values",
      header: { authorization: ["Bearer one", "Bearer two"] },
    },
    {
      case: "duplicate differently cased authorization headers",
      header: {
        authorization: "Bearer one",
        Authorization: "Bearer two",
      },
    },
  ])("denies $case without calling the token verifier", async ({ header }) => {
    const verifyToken = vi.fn(alwaysValid);

    const response = await executeBearerAuth({
      header,
      verifyToken,
      finalHandler: finalHandlerShouldNotRun,
    });

    expectDefaultUnauthorized(response);
    expect(verifyToken).not.toHaveBeenCalled();
  });

  test.each<{
    readonly case: string;
    readonly header?: Record<string, string | string[]>;
  }>([
    { case: "empty token", header: { authorization: "Bearer " } },
    { case: "malformed token", header: { authorization: "Bearer" } },
  ])("uses the unauthorized callback for $case", async ({ header }) => {
    const verifyToken = vi.fn(alwaysValid);
    const finalHandler = vi.fn(finalHandlerShouldNotRun);

    const response = await executeBearerAuth({
      header,
      verifyToken,
      finalHandler,
      onUnauthorized: () => ({
        statusCode: 403,
        body: { denied: true },
      }),
    });

    expect(response.statusCode).toBe(403);
    expect(response.body).toEqual({ denied: true });
    expect(verifyToken).not.toHaveBeenCalled();
    expect(finalHandler).not.toHaveBeenCalled();
  });

  test("short-circuits downstream handlers when tokens are rejected", async () => {
    const finalHandler = vi.fn(finalHandlerShouldNotRun);

    const response = await executeBearerAuth({
      header: { authorization: "Bearer bad-token" },
      verifyToken: alwaysInvalid,
      finalHandler,
    });

    expectDefaultUnauthorized(response);
    expect(finalHandler).not.toHaveBeenCalled();
  });

  test("denies tokens rejected by the verifier", async () => {
    const response = await executeBearerAuth({
      header: { authorization: "Bearer bad-token" },
      verifyToken: alwaysInvalid,
    });

    expectDefaultUnauthorized(response);
  });

  test("hides verifier errors behind the default unauthorized response", async () => {
    const response = await executeBearerAuth({
      header: { authorization: "Bearer some-token" },
      verifyToken: () => {
        throw new Error("DB connection failed");
      },
    });

    expectDefaultUnauthorized(response);
  });

  test("hides async verifier rejections behind the default unauthorized response", async () => {
    const finalHandler = vi.fn(finalHandlerShouldNotRun);

    const response = await executeBearerAuth({
      header: { authorization: "Bearer some-token" },
      verifyToken: () => Promise.reject(new Error("DB connection failed")),
      finalHandler,
    });

    expectDefaultUnauthorized(response);
    expect(finalHandler).not.toHaveBeenCalled();
  });

  test.each<{
    readonly case: string;
    readonly verifyToken: BearerAuthOptions["verifyToken"];
  }>([
    {
      case: "the token verifier throws",
      verifyToken: () => {
        throw new Error("DB connection failed");
      },
    },
    {
      case: "the token verifier rejects",
      verifyToken: () => Promise.reject(new Error("DB connection failed")),
    },
  ])("uses the unauthorized callback when $case", async ({ verifyToken }) => {
    const finalHandler = vi.fn(finalHandlerShouldNotRun);

    const response = await executeBearerAuth({
      header: { authorization: "Bearer some-token" },
      verifyToken,
      finalHandler,
      onUnauthorized: () => ({
        statusCode: 403,
        body: { denied: true },
      }),
    });

    expect(response.statusCode).toBe(403);
    expect(response.body).toEqual({ denied: true });
    expect(finalHandler).not.toHaveBeenCalled();
  });

  test("passes the bearer token and request context to the verifier", async () => {
    const verifyToken = vi.fn(alwaysValid);

    const { response, ctx } = await executeBearerAuthWithContext({
      header: { authorization: "Bearer my-secret-token" },
      verifyToken,
    });

    expect(response.statusCode).toBe(200);
    expect(verifyToken).toHaveBeenCalledWith("my-secret-token", ctx);
  });

  test("returns the downstream response with the authenticated token", async () => {
    const response = await executeBearerAuth({
      header: { authorization: "Bearer my-secret-token" },
      finalHandler: async ctx => ({
        statusCode: 202,
        header: { "x-downstream": "used" },
        body: { token: ctx.state.get("token") },
      }),
    });

    expect(response.statusCode).toBe(202);
    expect(response.header?.["x-downstream"]).toBe("used");
    expect(response.body).toEqual({ token: "my-secret-token" });
  });

  test("accepts Bearer auth schemes case-insensitively", async () => {
    const response = await executeBearerAuth({
      header: { authorization: "bearer my-secret-token" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({ ok: true });
  });

  test("reads the Authorization header name case-insensitively", async () => {
    const response = await executeBearerAuth({
      header: { Authorization: "Bearer my-secret-token" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({ ok: true });
  });

  test("supports asynchronous token verification", async () => {
    const response = await executeBearerAuth({
      header: { authorization: "Bearer async-valid" },
      verifyToken: async token => token === "async-valid",
    });

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({ ok: true });
  });

  test("uses the configured realm in the default challenge", async () => {
    const response = await executeBearerAuth({
      realm: "API",
      finalHandler: finalHandlerShouldNotRun,
    });

    expect(response.statusCode).toBe(401);
    expect(response.header?.["www-authenticate"]).toBe('Bearer realm="API"');
  });

  test("uses the configured unauthorized response when tokens are rejected", async () => {
    const response = await executeBearerAuth({
      header: { authorization: "Bearer bad-token" },
      verifyToken: alwaysInvalid,
      onUnauthorized: () => ({
        statusCode: 401,
        header: { "content-type": "application/problem+json" },
        body: { type: "about:blank", title: "Unauthorized", status: 401 },
      }),
    });

    expect(response.statusCode).toBe(401);
    expect(response.header?.["content-type"]).toBe("application/problem+json");
    expect(response.body).toEqual({
      type: "about:blank",
      title: "Unauthorized",
      status: 401,
    });
  });

  test("passes the request context to the unauthorized callback", async () => {
    const onUnauthorized = vi.fn(() => ({
      statusCode: 401,
      body: { error: "denied" },
    }));

    const { ctx } = await executeBearerAuthWithContext({
      header: { authorization: "Bearer expired" },
      verifyToken: alwaysInvalid,
      onUnauthorized,
    });

    expect(onUnauthorized).toHaveBeenCalledWith(ctx);
  });

  test("prefers the unauthorized callback over the default response", async () => {
    const response = await executeBearerAuth({
      header: { authorization: "Bearer nope" },
      verifyToken: alwaysInvalid,
      onUnauthorized: () => ({
        statusCode: 401,
        body: { custom: true },
      }),
    });

    expect(response.body).toEqual({ custom: true });
    expect(response.header?.["www-authenticate"]).toBeUndefined();
  });
});
