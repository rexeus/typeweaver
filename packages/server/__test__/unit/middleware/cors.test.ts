import { HttpMethod } from "@rexeus/typeweaver-core";
import type { IHttpResponse } from "@rexeus/typeweaver-core";
import { describe, expect, test } from "vitest";
import { executeMiddlewarePipeline } from "../../../src/lib/Middleware.js";
import { cors } from "../../../src/lib/middleware/cors.js";
import { createServerContext } from "../../helpers.js";
import type { CorsOptions } from "../../../src/lib/middleware/cors.js";

const policyControlledCorsHeaderNames = [
  "access-control-allow-origin",
  "access-control-allow-credentials",
  "access-control-expose-headers",
  "access-control-allow-methods",
  "access-control-allow-headers",
  "access-control-max-age",
] as const;

const permissiveCorsHeaders = {
  "Access-Control-Allow-Origin": "https://evil.com",
  "access-control-allow-credentials": "true",
  "access-control-expose-headers": "X-Evil",
  "access-control-allow-methods": "GET, POST",
  "access-control-allow-headers": "Authorization",
  "access-control-max-age": "3600",
};

type DownstreamPermissiveCorsPolicyOptions = {
  readonly statusCode?: IHttpResponse["statusCode"];
  readonly header?: Record<string, string | string[]> | undefined;
  readonly body?: IHttpResponse["body"];
};

function downstreamResponseWithPermissiveCorsPolicy({
  statusCode = 200,
  header = {},
  body,
}: DownstreamPermissiveCorsPolicyOptions = {}): IHttpResponse {
  return {
    statusCode,
    header: { ...permissiveCorsHeaders, ...header },
    ...(body !== undefined ? { body } : {}),
  };
}

type RunCorsOptions = {
  readonly options?: CorsOptions;
  readonly method?: HttpMethod;
  readonly header?: Record<string, string | string[] | undefined> | undefined;
  readonly finalHandler?: () => Promise<IHttpResponse>;
};

async function executeCors({
  options,
  method,
  header,
  finalHandler = async () => ({ statusCode: 200, body: { ok: true } }),
}: RunCorsOptions = {}): Promise<IHttpResponse> {
  const mw = options !== undefined ? cors(options) : cors();
  const ctx = createServerContext({
    ...(method !== undefined ? { method } : {}),
    ...(header ? { header } : {}),
  });

  return executeMiddlewarePipeline([mw.handler], ctx, finalHandler);
}

function expectNoPolicyControlledCorsHeaders(response: IHttpResponse): void {
  const responseHeaderNames = Object.keys(response.header ?? {}).map(key =>
    key.toLowerCase()
  );

  for (const headerName of policyControlledCorsHeaderNames) {
    expect(responseHeaderNames).not.toContain(headerName);
  }
}

describe("CORS simple request origins", () => {
  test("sets Access-Control-Allow-Origin to wildcard by default", async () => {
    const response = await executeCors();

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({ ok: true });
    expect(response.header?.["access-control-allow-origin"]).toBe("*");
  });

  test("sets a configured string origin", async () => {
    const response = await executeCors({
      options: { origin: "https://example.com" },
    });

    expect(response.header?.["access-control-allow-origin"]).toBe(
      "https://example.com"
    );
    expect(response.header?.["vary"]).toBe("Origin");
  });

  test("matches a request origin from a configured origin list", async () => {
    const response = await executeCors({
      options: { origin: ["https://a.com", "https://b.com"] },
      header: { origin: "https://b.com" },
    });

    expect(response.header?.["access-control-allow-origin"]).toBe(
      "https://b.com"
    );
  });

  test("preserves downstream response and varies on Origin when the origin list rejects a simple request", async () => {
    const response = await executeCors({
      options: { origin: ["https://allowed.com"] },
      header: { origin: "https://evil.com" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({ ok: true });
    expect(response.header?.["vary"]).toBe("Origin");
    expectNoPolicyControlledCorsHeaders(response);
  });

  test("removes downstream CORS headers when the origin list rejects the request", async () => {
    const response = await executeCors({
      options: { origin: ["https://a.com", "https://b.com"] },
      header: { origin: "https://evil.com" },
      finalHandler: async () =>
        downstreamResponseWithPermissiveCorsPolicy({
          statusCode: 202,
          header: {
            vary: "Accept-Encoding",
            "x-custom": "kept",
          },
          body: { passedThrough: true },
        }),
    });

    expect(response.statusCode).toBe(202);
    expect(response.body).toEqual({ passedThrough: true });
    expect(response.header?.["x-custom"]).toBe("kept");
    expect(response.header?.["vary"]).toBe("Accept-Encoding, Origin");
    expectNoPolicyControlledCorsHeaders(response);
  });

  test("strips downstream CORS headers and varies on Origin when an origin list has no request Origin", async () => {
    const response = await executeCors({
      options: { origin: ["https://a.com", "https://b.com"] },
      finalHandler: async () =>
        downstreamResponseWithPermissiveCorsPolicy({
          statusCode: 202,
          header: {
            vary: "Accept-Encoding",
            "x-custom": "kept",
          },
          body: { passedThrough: true },
        }),
    });

    expect(response.statusCode).toBe(202);
    expect(response.body).toEqual({ passedThrough: true });
    expect(response.header?.["x-custom"]).toBe("kept");
    expect(response.header?.["vary"]).toBe("Accept-Encoding, Origin");
    expectNoPolicyControlledCorsHeaders(response);
  });
});

describe("CORS function origin resolution", () => {
  test("reflects the allowed Origin from a function origin resolver", async () => {
    const response = await executeCors({
      options: {
        origin: origin =>
          origin.endsWith(".example.com") ? origin : undefined,
      },
      header: { origin: "https://app.example.com" },
    });

    expect(response.header?.["access-control-allow-origin"]).toBe(
      "https://app.example.com"
    );
  });

  test("fails closed when a credentialed function origin resolver returns a wildcard", async () => {
    const response = await executeCors({
      options: { origin: () => "*", credentials: true },
      header: { origin: "https://app.com" },
      finalHandler: async () =>
        downstreamResponseWithPermissiveCorsPolicy({
          statusCode: 202,
          header: { "x-custom": "kept" },
          body: { passedThrough: true },
        }),
    });

    expect(response.statusCode).toBe(202);
    expect(response.body).toEqual({ passedThrough: true });
    expect(response.header?.["x-custom"]).toBe("kept");
    expect(response.header?.["vary"]).toBe("Origin");
    expectNoPolicyControlledCorsHeaders(response);
  });

  test("removes downstream CORS headers when a function origin resolver rejects the request", async () => {
    const response = await executeCors({
      options: {
        origin: origin =>
          origin.endsWith(".example.com") ? origin : undefined,
      },
      header: { origin: "https://evil.com" },
      finalHandler: async () =>
        downstreamResponseWithPermissiveCorsPolicy({
          header: { "x-custom": "kept" },
          body: { ok: true },
        }),
    });

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({ ok: true });
    expect(response.header?.["x-custom"]).toBe("kept");
    expect(response.header?.["vary"]).toBe("Origin");
    expectNoPolicyControlledCorsHeaders(response);
  });

  test("strips downstream CORS headers and varies on Origin when a function origin resolver has no request Origin", async () => {
    const response = await executeCors({
      options: {
        origin: origin =>
          origin.endsWith(".example.com") ? origin : undefined,
      },
      finalHandler: async () =>
        downstreamResponseWithPermissiveCorsPolicy({
          statusCode: 202,
          header: { "x-custom": "kept" },
          body: { passedThrough: true },
        }),
    });

    expect(response.statusCode).toBe(202);
    expect(response.body).toEqual({ passedThrough: true });
    expect(response.header?.["x-custom"]).toBe("kept");
    expect(response.header?.["vary"]).toBe("Origin");
    expectNoPolicyControlledCorsHeaders(response);
  });
});

describe("CORS credentialed origins", () => {
  test("sets credentials when enabled with an explicit origin", async () => {
    const response = await executeCors({
      options: { origin: "https://app.com", credentials: true },
      header: { origin: "https://app.com" },
    });

    expect(response.header?.["access-control-allow-credentials"]).toBe("true");
  });

  test("sets credentials for a credentialed function origin allowlist", async () => {
    const response = await executeCors({
      options: {
        origin: origin => (origin === "https://app.com" ? origin : undefined),
        credentials: true,
      },
      header: { origin: "https://app.com" },
    });

    expect(response.header?.["access-control-allow-origin"]).toBe(
      "https://app.com"
    );
    expect(response.header?.["access-control-allow-credentials"]).toBe("true");
  });

  test("sets credentials for a credentialed origin array allowlist", async () => {
    const response = await executeCors({
      options: { origin: ["https://app.com"], credentials: true },
      header: { origin: "https://app.com" },
    });

    expect(response.header?.["access-control-allow-origin"]).toBe(
      "https://app.com"
    );
    expect(response.header?.["access-control-allow-credentials"]).toBe("true");
  });
});

describe("CORS invalid credential policies", () => {
  test.each<{
    readonly case: string;
    readonly options: CorsOptions;
  }>([
    {
      case: "credentials without an origin allowlist",
      options: { credentials: true },
    },
    {
      case: "credentials combined with a wildcard origin",
      options: { origin: "*", credentials: true },
    },
  ])("fails closed at request time for $case", async ({ options }) => {
    const response = await executeCors({
      options,
      header: { origin: "https://app.com" },
      finalHandler: async () =>
        downstreamResponseWithPermissiveCorsPolicy({
          statusCode: 202,
          header: {
            vary: "Accept-Encoding",
            "x-custom": "kept",
          },
          body: { passedThrough: true },
        }),
    });

    expect(response.statusCode).toBe(202);
    expect(response.body).toEqual({ passedThrough: true });
    expect(response.header?.["x-custom"]).toBe("kept");
    expect(response.header?.["vary"]).toBe("Accept-Encoding, Origin");
    expectNoPolicyControlledCorsHeaders(response);
  });

  test.each<{
    readonly case: string;
    readonly options: CorsOptions;
  }>([
    {
      case: "credentials without an origin allowlist",
      options: { credentials: true },
    },
    {
      case: "credentials combined with a wildcard origin",
      options: { origin: "*", credentials: true },
    },
  ])("fails closed without a request Origin for $case", async ({ options }) => {
    const response = await executeCors({
      options,
      finalHandler: async () =>
        downstreamResponseWithPermissiveCorsPolicy({
          statusCode: 202,
          header: {
            vary: "Accept-Encoding",
            "x-custom": "kept",
          },
          body: { passedThrough: true },
        }),
    });

    expect(response.statusCode).toBe(202);
    expect(response.body).toEqual({ passedThrough: true });
    expect(response.header?.["x-custom"]).toBe("kept");
    expect(response.header?.["vary"]).toBe("Accept-Encoding, Origin");
    expectNoPolicyControlledCorsHeaders(response);
  });
});
