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

describe("CORS response headers", () => {
  test("sets exposed response headers", async () => {
    const response = await executeCors({
      options: { exposeHeaders: ["X-Request-Id", "X-Total-Count"] },
    });

    expect(response.header?.["access-control-expose-headers"]).toBe(
      "X-Request-Id, X-Total-Count"
    );
  });

  test("omits exposed response headers when exposeHeaders is empty", async () => {
    const response = await executeCors({
      options: { exposeHeaders: [] },
    });

    expect(response.header?.["access-control-allow-origin"]).toBe("*");
    expect(response.header?.["access-control-expose-headers"]).toBeUndefined();
  });

  test("preserves downstream status body and unrelated headers", async () => {
    const response = await executeCors({
      finalHandler: async () => ({
        statusCode: 201,
        header: { "x-custom": "value" },
        body: { created: true },
      }),
    });

    expect(response.statusCode).toBe(201);
    expect(response.body).toEqual({ created: true });
    expect(response.header?.["x-custom"]).toBe("value");
    expect(response.header?.["access-control-allow-origin"]).toBe("*");
  });

  test("merges downstream Vary values with Origin", async () => {
    const response = await executeCors({
      options: { origin: ["https://app.com"] },
      header: { origin: "https://app.com" },
      finalHandler: async () => ({
        statusCode: 200,
        header: { vary: "Accept-Encoding" },
      }),
    });

    expect(response.header?.["vary"]).toBe("Accept-Encoding, Origin");
  });

  test("preserves array-valued downstream Vary values when adding Origin", async () => {
    const response = await executeCors({
      options: { origin: ["https://app.com"] },
      header: { origin: "https://app.com" },
      finalHandler: async () => ({
        statusCode: 200,
        header: { vary: ["Accept-Encoding", "Accept-Language"] },
      }),
    });

    expect(response.header?.["vary"]).toBe(
      "Accept-Encoding, Accept-Language, Origin"
    );
  });
});

describe("CORS Vary normalization", () => {
  test("normalizes duplicate differently cased downstream Vary headers when adding Origin", async () => {
    const response = await executeCors({
      options: { origin: ["https://app.com"] },
      header: { origin: "https://app.com" },
      finalHandler: async () => ({
        statusCode: 200,
        header: {
          vary: "Accept-Encoding",
          Vary: "Accept-Language",
        },
      }),
    });

    expect(response.header?.["vary"]).toBe(
      "Accept-Encoding, Accept-Language, Origin"
    );
    expect(response.header?.["Vary"]).toBeUndefined();
  });

  test("does not duplicate Origin in downstream Vary values", async () => {
    const response = await executeCors({
      options: { origin: ["https://app.com"] },
      header: { origin: "https://app.com" },
      finalHandler: async () => ({
        statusCode: 200,
        header: { vary: "Accept-Encoding, Origin" },
      }),
    });

    expect(response.header?.["vary"]).toBe("Accept-Encoding, Origin");
  });

  test("does not duplicate differently cased Origin in downstream Vary values", async () => {
    const response = await executeCors({
      options: { origin: ["https://app.com"] },
      header: { origin: "https://app.com" },
      finalHandler: async () => ({
        statusCode: 200,
        header: { vary: "Accept-Encoding, origin" },
      }),
    });

    expect(response.header?.["vary"]).toBe("Accept-Encoding, origin");
  });

  test("lets middleware policy override conflicting downstream CORS headers", async () => {
    const response = await executeCors({
      options: { origin: "https://allowed.com", credentials: true },
      finalHandler: async () =>
        downstreamResponseWithPermissiveCorsPolicy({
          header: { "access-control-allow-credentials": "false" },
        }),
    });

    expect(response.header?.["access-control-allow-origin"]).toBe(
      "https://allowed.com"
    );
    expect(response.header?.["access-control-allow-credentials"]).toBe("true");
    expect(response.header?.["Access-Control-Allow-Origin"]).toBeUndefined();
  });
});

describe("CORS downstream policy overrides", () => {
  test("strips downstream CORS headers disabled by the middleware policy", async () => {
    const response = await executeCors({
      options: { origin: "https://allowed.com" },
      finalHandler: async () =>
        downstreamResponseWithPermissiveCorsPolicy({
          header: { "x-custom": "kept" },
        }),
    });

    expect(response.header?.["access-control-allow-origin"]).toBe(
      "https://allowed.com"
    );
    expect(response.header?.["vary"]).toBe("Origin");
    expect(response.header?.["x-custom"]).toBe("kept");
    expect(
      response.header?.["access-control-allow-credentials"]
    ).toBeUndefined();
    expect(response.header?.["access-control-expose-headers"]).toBeUndefined();
    expect(response.header?.["access-control-allow-methods"]).toBeUndefined();
    expect(response.header?.["access-control-allow-headers"]).toBeUndefined();
    expect(response.header?.["access-control-max-age"]).toBeUndefined();
  });

  test("reads the Origin request header name case-insensitively", async () => {
    const response = await executeCors({
      options: { origin: ["https://app.com"] },
      header: { Origin: "https://app.com" },
    });

    expect(response.header?.["access-control-allow-origin"]).toBe(
      "https://app.com"
    );
  });
});

describe("CORS ambiguous Origin headers under wildcard policy", () => {
  test.each<{
    readonly case: string;
    readonly header: Record<string, string | string[]>;
    readonly downstreamVary?: string;
    readonly expectedVary: string;
  }>([
    {
      case: "multiple Origin values",
      header: { origin: ["https://app.com", "https://evil.com"] },
      expectedVary: "Origin",
    },
    {
      case: "duplicate differently cased Origin headers",
      header: {
        origin: "https://app.com",
        Origin: "https://evil.com",
      },
      downstreamVary: "Accept-Encoding",
      expectedVary: "Accept-Encoding, Origin",
    },
  ])(
    "strips downstream CORS policy headers for $case under the default wildcard policy",
    async ({ header, downstreamVary, expectedVary }) => {
      const response = await executeCors({
        header,
        finalHandler: async () =>
          downstreamResponseWithPermissiveCorsPolicy({
            statusCode: 202,
            header: {
              ...(downstreamVary !== undefined ? { vary: downstreamVary } : {}),
              "x-custom": "kept",
            },
            body: { passedThrough: true },
          }),
      });

      expect(response.statusCode).toBe(202);
      expect(response.body).toEqual({ passedThrough: true });
      expect(response.header?.["x-custom"]).toBe("kept");
      expect(response.header?.["vary"]).toBe(expectedVary);
      expect(response.header?.["access-control-allow-origin"]).not.toBe("*");
      expectNoPolicyControlledCorsHeaders(response);
    }
  );
});

describe("CORS ambiguous Origin headers under fixed policy", () => {
  test.each<{
    readonly case: string;
    readonly header: Record<string, string | string[]>;
    readonly downstreamVary?: string;
    readonly expectedVary: string;
  }>([
    {
      case: "multiple Origin values",
      header: { origin: ["https://app.com", "https://evil.com"] },
      expectedVary: "Origin",
    },
    {
      case: "duplicate differently cased Origin headers",
      header: {
        origin: "https://app.com",
        Origin: "https://evil.com",
      },
      downstreamVary: "Accept-Encoding",
      expectedVary: "Accept-Encoding, Origin",
    },
  ])(
    "strips downstream CORS policy headers for $case under a fixed string policy",
    async ({ header, downstreamVary, expectedVary }) => {
      const response = await executeCors({
        options: { origin: "https://allowed.com" },
        header,
        finalHandler: async () =>
          downstreamResponseWithPermissiveCorsPolicy({
            statusCode: 202,
            header: {
              ...(downstreamVary !== undefined ? { vary: downstreamVary } : {}),
              "x-custom": "kept",
            },
            body: { passedThrough: true },
          }),
      });

      expect(response.statusCode).toBe(202);
      expect(response.body).toEqual({ passedThrough: true });
      expect(response.header?.["x-custom"]).toBe("kept");
      expect(response.header?.["vary"]).toBe(expectedVary);
      expect(response.header?.["access-control-allow-origin"]).not.toBe(
        "https://allowed.com"
      );
      expectNoPolicyControlledCorsHeaders(response);
    }
  );
});

describe("CORS ambiguous Origin headers under allowlist policy", () => {
  test.each<{
    readonly case: string;
    readonly header: Record<string, string | string[]>;
    readonly downstreamVary?: string;
    readonly expectedVary: string;
  }>([
    {
      case: "multiple Origin values",
      header: { origin: ["https://app.com", "https://evil.com"] },
      expectedVary: "Origin",
    },
    {
      case: "duplicate differently cased Origin headers",
      header: {
        origin: "https://app.com",
        Origin: "https://evil.com",
      },
      downstreamVary: "Accept-Encoding",
      expectedVary: "Accept-Encoding, Origin",
    },
  ])(
    "strips downstream CORS policy headers for $case",
    async ({ header, downstreamVary, expectedVary }) => {
      const response = await executeCors({
        options: { origin: ["https://app.com"] },
        header,
        finalHandler: async () =>
          downstreamResponseWithPermissiveCorsPolicy({
            statusCode: 202,
            header: {
              ...(downstreamVary !== undefined ? { vary: downstreamVary } : {}),
              "x-custom": "kept",
            },
            body: { passedThrough: true },
          }),
      });

      expect(response.statusCode).toBe(202);
      expect(response.body).toEqual({ passedThrough: true });
      expect(response.header?.["x-custom"]).toBe("kept");
      expect(response.header?.["vary"]).toBe(expectedVary);
      expectNoPolicyControlledCorsHeaders(response);
    }
  );
});
