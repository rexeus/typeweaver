import { unauthorizedDefaultError } from "@rexeus/typeweaver-core";
import type { IHttpResponse } from "@rexeus/typeweaver-core";
import { describe, expect, test, vi } from "vitest";
import { executeMiddlewarePipeline } from "../../../src/lib/Middleware.js";
import { basicAuth } from "../../../src/lib/middleware/basicAuth.js";
import { createServerContext } from "../../helpers.js";
import type { BasicAuthOptions } from "../../../src/lib/middleware/basicAuth.js";
import type { ServerContext } from "../../../src/lib/ServerContext.js";

const encode = (value: string) => btoa(value);

const basicAuthorizationHeader = (credentials = "admin:secret") =>
  `Basic ${encode(credentials)}`;

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

type RunBasicAuthOptions = {
  readonly header?: Record<string, string | string[]>;
  readonly verifyCredentials?: BasicAuthOptions["verifyCredentials"];
  readonly realm?: string;
  readonly onUnauthorized?: BasicAuthOptions["onUnauthorized"];
  readonly finalHandler?: (ctx: ServerContext) => Promise<IHttpResponse>;
};

async function executeBasicAuth(
  options: RunBasicAuthOptions = {}
): Promise<IHttpResponse> {
  const { response } = await executeBasicAuthWithContext(options);
  return response;
}

async function executeBasicAuthWithContext({
  header,
  verifyCredentials = alwaysValid,
  realm,
  onUnauthorized,
  finalHandler = async () => ({ statusCode: 200, body: { ok: true } }),
}: RunBasicAuthOptions = {}): Promise<{
  readonly response: IHttpResponse;
  readonly ctx: ServerContext;
}> {
  const mw = basicAuth({
    verifyCredentials,
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
    'Basic realm="Secure Area"'
  );
}

describe("basicAuth", () => {
  test.each<{
    readonly case: string;
    readonly header?: Record<string, string | string[]>;
  }>([
    { case: "missing authorization", header: undefined },
    { case: "non-Basic scheme", header: { authorization: "Bearer token" } },
    {
      case: "invalid base64",
      header: { authorization: "Basic !!!invalid!!!" },
    },
    { case: "empty encoded value", header: { authorization: "Basic " } },
    {
      case: "decoded value with no colon",
      header: { authorization: basicAuthorizationHeader("nocolon") },
    },
    {
      case: "empty username",
      header: { authorization: basicAuthorizationHeader(":password") },
    },
    {
      case: "multiple authorization values",
      header: {
        authorization: [
          basicAuthorizationHeader("admin:secret"),
          basicAuthorizationHeader("other:secret"),
        ],
      },
    },
    {
      case: "duplicate differently cased authorization headers",
      header: {
        authorization: basicAuthorizationHeader("admin:secret"),
        Authorization: basicAuthorizationHeader("other:secret"),
      },
    },
  ])(
    "denies $case without calling the credentials verifier",
    async ({ header }) => {
      const verifyCredentials = vi.fn(alwaysValid);

      const response = await executeBasicAuth({
        header,
        verifyCredentials,
        finalHandler: finalHandlerShouldNotRun,
      });

      expectDefaultUnauthorized(response);
      expect(verifyCredentials).not.toHaveBeenCalled();
    }
  );

  test.each<{
    readonly case: string;
    readonly header?: Record<string, string | string[]>;
  }>([
    { case: "missing authorization", header: undefined },
    {
      case: "malformed Basic credentials",
      header: { authorization: "Basic !!!invalid!!!" },
    },
  ])("uses the unauthorized callback for $case", async ({ header }) => {
    const verifyCredentials = vi.fn(alwaysValid);
    const finalHandler = vi.fn(finalHandlerShouldNotRun);

    const response = await executeBasicAuth({
      header,
      verifyCredentials,
      finalHandler,
      onUnauthorized: () => ({
        statusCode: 403,
        body: { denied: true },
      }),
    });

    expect(response.statusCode).toBe(403);
    expect(response.body).toEqual({ denied: true });
    expect(verifyCredentials).not.toHaveBeenCalled();
    expect(finalHandler).not.toHaveBeenCalled();
  });

  test("short-circuits downstream handlers when credentials are rejected", async () => {
    const finalHandler = vi.fn(finalHandlerShouldNotRun);

    const response = await executeBasicAuth({
      header: { authorization: basicAuthorizationHeader("admin:wrong") },
      verifyCredentials: alwaysInvalid,
      finalHandler,
    });

    expectDefaultUnauthorized(response);
    expect(finalHandler).not.toHaveBeenCalled();
  });

  test("denies credentials rejected by the verifier", async () => {
    const response = await executeBasicAuth({
      header: { authorization: basicAuthorizationHeader("admin:wrong") },
      verifyCredentials: alwaysInvalid,
    });

    expectDefaultUnauthorized(response);
  });

  test("hides verifier errors behind the default unauthorized response", async () => {
    const response = await executeBasicAuth({
      header: { authorization: basicAuthorizationHeader("admin:secret") },
      verifyCredentials: () => {
        throw new Error("DB error");
      },
    });

    expectDefaultUnauthorized(response);
  });

  test("hides async verifier rejections behind the default unauthorized response", async () => {
    const finalHandler = vi.fn(finalHandlerShouldNotRun);

    const response = await executeBasicAuth({
      header: { authorization: basicAuthorizationHeader("admin:secret") },
      verifyCredentials: () => Promise.reject(new Error("DB error")),
      finalHandler,
    });

    expectDefaultUnauthorized(response);
    expect(finalHandler).not.toHaveBeenCalled();
  });

  test.each<{
    readonly case: string;
    readonly verifyCredentials: BasicAuthOptions["verifyCredentials"];
  }>([
    {
      case: "the credentials verifier throws",
      verifyCredentials: () => {
        throw new Error("DB error");
      },
    },
    {
      case: "the credentials verifier rejects",
      verifyCredentials: () => Promise.reject(new Error("DB error")),
    },
  ])(
    "uses the unauthorized callback when $case",
    async ({ verifyCredentials }) => {
      const finalHandler = vi.fn(finalHandlerShouldNotRun);

      const response = await executeBasicAuth({
        header: { authorization: basicAuthorizationHeader("admin:secret") },
        verifyCredentials,
        finalHandler,
        onUnauthorized: () => ({
          statusCode: 403,
          body: { denied: true },
        }),
      });

      expect(response.statusCode).toBe(403);
      expect(response.body).toEqual({ denied: true });
      expect(finalHandler).not.toHaveBeenCalled();
    }
  );

  test("passes decoded credentials and the request context to the verifier", async () => {
    const verifyCredentials = vi.fn(alwaysValid);

    const { response, ctx } = await executeBasicAuthWithContext({
      header: { authorization: basicAuthorizationHeader("admin:secret") },
      verifyCredentials,
    });

    expect(response.statusCode).toBe(200);
    expect(verifyCredentials).toHaveBeenCalledWith("admin", "secret", ctx);
  });

  test("returns the downstream response with the authenticated username", async () => {
    const response = await executeBasicAuth({
      header: { authorization: basicAuthorizationHeader("admin:secret") },
      finalHandler: async ctx => ({
        statusCode: 202,
        header: { "x-downstream": "used" },
        body: { username: ctx.state.get("username") },
      }),
    });

    expect(response.statusCode).toBe(202);
    expect(response.header?.["x-downstream"]).toBe("used");
    expect(response.body).toEqual({ username: "admin" });
  });

  test("accepts Basic auth schemes case-insensitively", async () => {
    const response = await executeBasicAuth({
      header: { authorization: `basic ${encode("admin:secret")}` },
    });

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({ ok: true });
  });

  test("reads the Authorization header name case-insensitively", async () => {
    const response = await executeBasicAuth({
      header: { Authorization: basicAuthorizationHeader("admin:secret") },
    });

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({ ok: true });
  });

  test("preserves colons in the password", async () => {
    const verifyCredentials = vi.fn(alwaysValid);

    const response = await executeBasicAuth({
      header: {
        authorization: basicAuthorizationHeader("user:pass:with:colons"),
      },
      verifyCredentials,
    });

    expect(response.statusCode).toBe(200);
    expect(verifyCredentials).toHaveBeenCalledWith(
      "user",
      "pass:with:colons",
      expect.any(Object)
    );
  });

  test("allows an empty password when the verifier accepts it", async () => {
    const verifyCredentials = vi.fn(alwaysValid);

    const response = await executeBasicAuth({
      header: { authorization: basicAuthorizationHeader("user:") },
      verifyCredentials,
    });

    expect(response.statusCode).toBe(200);
    expect(verifyCredentials).toHaveBeenCalledWith(
      "user",
      "",
      expect.any(Object)
    );
  });

  test("supports asynchronous credential verification", async () => {
    const response = await executeBasicAuth({
      header: { authorization: basicAuthorizationHeader("admin:correct") },
      verifyCredentials: async (user, pass) =>
        user === "admin" && pass === "correct",
    });

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({ ok: true });
  });

  test("uses the configured realm in the default challenge", async () => {
    const response = await executeBasicAuth({
      realm: "Admin Panel",
      finalHandler: finalHandlerShouldNotRun,
    });

    expect(response.statusCode).toBe(401);
    expect(response.header?.["www-authenticate"]).toBe(
      'Basic realm="Admin Panel"'
    );
  });

  test("uses the configured unauthorized response when credentials are rejected", async () => {
    const response = await executeBasicAuth({
      header: { authorization: basicAuthorizationHeader("user:pass") },
      verifyCredentials: alwaysInvalid,
      onUnauthorized: () => ({
        statusCode: 401,
        header: { "content-type": "text/plain" },
        body: "Go away",
      }),
    });

    expect(response.statusCode).toBe(401);
    expect(response.body).toBe("Go away");
    expect(response.header?.["content-type"]).toBe("text/plain");
  });

  test("passes the request context to the unauthorized callback", async () => {
    const onUnauthorized = vi.fn(() => ({
      statusCode: 403,
      body: { error: "forbidden" },
    }));

    const { ctx } = await executeBasicAuthWithContext({
      header: { authorization: basicAuthorizationHeader("user:wrong") },
      verifyCredentials: alwaysInvalid,
      onUnauthorized,
    });

    expect(onUnauthorized).toHaveBeenCalledWith(ctx);
  });

  test("prefers the unauthorized callback over the default response", async () => {
    const response = await executeBasicAuth({
      header: { authorization: basicAuthorizationHeader("user:pass") },
      verifyCredentials: alwaysInvalid,
      onUnauthorized: () => ({
        statusCode: 401,
        body: { custom: true },
      }),
    });

    expect(response.body).toEqual({ custom: true });
    expect(response.header?.["www-authenticate"]).toBeUndefined();
  });
});
