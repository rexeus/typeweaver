import { HttpMethod } from "@rexeus/typeweaver-core";
import type { IHttpResponse } from "@rexeus/typeweaver-core";
import { describe, expect, test, vi } from "vitest";
import { executeMiddlewarePipeline } from "../../../src/lib/Middleware.js";
import { cors } from "../../../src/lib/middleware/cors.js";
import { createServerContext } from "../../helpers.js";
import type { CorsOptions } from "../../../src/lib/middleware/cors.js";

const finalHandlerShouldNotRun = async () => ({
  statusCode: 500,
  body: { error: "final handler used" },
});

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
  readonly header?: Record<string, string | string[]>;
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
  readonly header?: Record<string, string | string[]>;
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

describe("cors", () => {
  describe("simple requests", () => {
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

    test("sets credentials when enabled with an explicit origin", async () => {
      const response = await executeCors({
        options: { origin: "https://app.com", credentials: true },
        header: { origin: "https://app.com" },
      });

      expect(response.header?.["access-control-allow-credentials"]).toBe(
        "true"
      );
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
      expect(response.header?.["access-control-allow-credentials"]).toBe(
        "true"
      );
    });

    test("sets credentials for a credentialed origin array allowlist", async () => {
      const response = await executeCors({
        options: { origin: ["https://app.com"], credentials: true },
        header: { origin: "https://app.com" },
      });

      expect(response.header?.["access-control-allow-origin"]).toBe(
        "https://app.com"
      );
      expect(response.header?.["access-control-allow-credentials"]).toBe(
        "true"
      );
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
      expect(
        response.header?.["access-control-expose-headers"]
      ).toBeUndefined();
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
      expect(response.header?.["access-control-allow-credentials"]).toBe(
        "true"
      );
      expect(response.header?.["Access-Control-Allow-Origin"]).toBeUndefined();
    });

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
      expect(
        response.header?.["access-control-expose-headers"]
      ).toBeUndefined();
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
                ...(downstreamVary !== undefined
                  ? { vary: downstreamVary }
                  : {}),
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
                ...(downstreamVary !== undefined
                  ? { vary: downstreamVary }
                  : {}),
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
                ...(downstreamVary !== undefined
                  ? { vary: downstreamVary }
                  : {}),
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

  describe("preflight requests", () => {
    test("short-circuits preflight requests with 204", async () => {
      const finalHandler = vi.fn(finalHandlerShouldNotRun);

      const response = await executeCors({
        method: HttpMethod.OPTIONS,
        header: {
          origin: "https://app.com",
          "access-control-request-method": "POST",
        },
        finalHandler,
      });

      expect(response.statusCode).toBe(204);
      expect(response.body).toBeUndefined();
      expect(finalHandler).not.toHaveBeenCalled();
    });

    test("includes default allowed methods in preflight responses", async () => {
      const response = await executeCors({
        method: HttpMethod.OPTIONS,
        header: {
          origin: "https://app.com",
          "access-control-request-method": "PUT",
        },
        finalHandler: finalHandlerShouldNotRun,
      });

      expect(response.header?.["access-control-allow-methods"]).toBe(
        "GET, HEAD, PUT, POST, PATCH, DELETE"
      );
    });

    test("uses configured allowed methods in preflight responses", async () => {
      const response = await executeCors({
        options: { allowMethods: ["GET", "POST"] },
        method: HttpMethod.OPTIONS,
        header: {
          origin: "https://app.com",
          "access-control-request-method": "GET",
        },
        finalHandler: finalHandlerShouldNotRun,
      });

      expect(response.header?.["access-control-allow-methods"]).toBe(
        "GET, POST"
      );
    });

    test("emits an empty allowed methods header when configured methods are empty", async () => {
      const response = await executeCors({
        options: { allowMethods: [] },
        method: HttpMethod.OPTIONS,
        header: {
          origin: "https://app.com",
          "access-control-request-method": "GET",
        },
        finalHandler: finalHandlerShouldNotRun,
      });

      expect(response.statusCode).toBe(204);
      expect(response.header?.["access-control-allow-methods"]).toBe("");
    });

    test("varies on Origin for allowed non-wildcard preflight responses", async () => {
      const response = await executeCors({
        options: { origin: ["https://app.com"] },
        method: HttpMethod.OPTIONS,
        header: {
          origin: "https://app.com",
          "access-control-request-method": "POST",
        },
        finalHandler: finalHandlerShouldNotRun,
      });

      expect(response.statusCode).toBe(204);
      expect(response.header?.["access-control-allow-origin"]).toBe(
        "https://app.com"
      );
      expect(response.header?.["vary"]).toBe("Origin");
      expect(response.header?.["access-control-allow-methods"]).toBe(
        "GET, HEAD, PUT, POST, PATCH, DELETE"
      );
    });

    test("reflects Origin and credentials for credentialed preflight responses", async () => {
      const response = await executeCors({
        options: { origin: "https://app.com", credentials: true },
        method: HttpMethod.OPTIONS,
        header: {
          origin: "https://app.com",
          "access-control-request-method": "POST",
        },
        finalHandler: finalHandlerShouldNotRun,
      });

      expect(response.statusCode).toBe(204);
      expect(response.header?.["access-control-allow-origin"]).toBe(
        "https://app.com"
      );
      expect(response.header?.["access-control-allow-origin"]).not.toBe("*");
      expect(response.header?.["access-control-allow-credentials"]).toBe(
        "true"
      );
      expect(response.header?.["vary"]).toBe("Origin");
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
      {
        case: "a credentialed function origin resolver returning a wildcard",
        options: { origin: () => "*", credentials: true },
      },
    ])("fails closed for preflight requests with $case", async ({ options }) => {
      const response = await executeCors({
        options,
        method: HttpMethod.OPTIONS,
        header: {
          origin: "https://app.com",
          "access-control-request-method": "POST",
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

    test("reflects requested headers when allowed headers are not configured", async () => {
      const response = await executeCors({
        method: HttpMethod.OPTIONS,
        header: {
          origin: "https://app.com",
          "access-control-request-method": "POST",
          "access-control-request-headers": "Content-Type, Authorization",
        },
        finalHandler: finalHandlerShouldNotRun,
      });

      expect(response.header?.["access-control-allow-headers"]).toBe(
        "Content-Type, Authorization"
      );
    });

    test("uses configured allowed headers in preflight responses", async () => {
      const response = await executeCors({
        options: { allowHeaders: ["Content-Type", "X-API-Key"] },
        method: HttpMethod.OPTIONS,
        header: {
          origin: "https://app.com",
          "access-control-request-method": "POST",
          "access-control-request-headers": "Content-Type, Authorization",
        },
        finalHandler: finalHandlerShouldNotRun,
      });

      expect(response.header?.["access-control-allow-headers"]).toBe(
        "Content-Type, X-API-Key"
      );
    });

    test("omits allow-headers when configured allowed headers are empty", async () => {
      const response = await executeCors({
        options: { allowHeaders: [] },
        method: HttpMethod.OPTIONS,
        header: {
          origin: "https://app.com",
          "access-control-request-method": "POST",
          "access-control-request-headers": "Content-Type, Authorization",
        },
        finalHandler: finalHandlerShouldNotRun,
      });

      expect(response.statusCode).toBe(204);
      expect(response.header?.["access-control-allow-headers"]).toBeUndefined();
    });

    test("sets max-age on preflight responses", async () => {
      const response = await executeCors({
        options: { maxAge: 3600 },
        method: HttpMethod.OPTIONS,
        header: {
          origin: "https://app.com",
          "access-control-request-method": "POST",
        },
        finalHandler: finalHandlerShouldNotRun,
      });

      expect(response.header?.["access-control-max-age"]).toBe("3600");
    });

    test("sets zero max-age on preflight responses", async () => {
      const response = await executeCors({
        options: { maxAge: 0 },
        method: HttpMethod.OPTIONS,
        header: {
          origin: "https://app.com",
          "access-control-request-method": "POST",
        },
        finalHandler: finalHandlerShouldNotRun,
      });

      expect(response.header?.["access-control-max-age"]).toBe("0");
    });

    test("preserves downstream response and varies on Origin when origin list rejects a preflight request", async () => {
      const response = await executeCors({
        options: { origin: ["https://allowed.com"] },
        method: HttpMethod.OPTIONS,
        header: {
          origin: "https://evil.com",
          "access-control-request-method": "POST",
        },
        finalHandler: async () =>
          downstreamResponseWithPermissiveCorsPolicy({
            header: { "x-custom": "kept" },
            body: { options: true },
          }),
      });

      expect(response.statusCode).toBe(200);
      expect(response.body).toEqual({ options: true });
      expect(response.header?.["x-custom"]).toBe("kept");
      expect(response.header?.["vary"]).toBe("Origin");
      expectNoPolicyControlledCorsHeaders(response);
    });

    test("passes regular OPTIONS requests through to downstream handlers", async () => {
      const response = await executeCors({
        method: HttpMethod.OPTIONS,
        finalHandler: async () => ({
          statusCode: 200,
          body: { options: true },
        }),
      });

      expect(response.statusCode).toBe(200);
      expect(response.body).toEqual({ options: true });
      expect(response.header?.["access-control-allow-methods"]).toBeUndefined();
    });

    test("passes OPTIONS with requested method but no Origin through to downstream handlers", async () => {
      const response = await executeCors({
        method: HttpMethod.OPTIONS,
        header: { "access-control-request-method": "POST" },
        finalHandler: async () => ({
          statusCode: 200,
          body: { options: true },
        }),
      });

      expect(response.statusCode).toBe(200);
      expect(response.body).toEqual({ options: true });
      expect(response.header?.["access-control-allow-methods"]).toBeUndefined();
    });

    test.each<{
      readonly case: string;
      readonly header: Record<string, string | string[]>;
    }>([
      {
        case: "multiple requested methods",
        header: {
          origin: "https://app.com",
          "access-control-request-method": ["POST", "DELETE"],
        },
      },
      {
        case: "duplicate differently cased requested method headers",
        header: {
          origin: "https://app.com",
          "access-control-request-method": "POST",
          "Access-Control-Request-Method": "DELETE",
        },
      },
    ])("passes $case through without preflight headers", async ({ header }) => {
      const response = await executeCors({
        method: HttpMethod.OPTIONS,
        header,
        finalHandler: async () => ({
          statusCode: 200,
          body: { options: true },
        }),
      });

      expect(response.statusCode).toBe(200);
      expect(response.body).toEqual({ options: true });
      expect(response.header?.["access-control-allow-methods"]).toBeUndefined();
    });

    test.each<{
      readonly case: string;
      readonly header: Record<string, string | string[]>;
    }>([
      {
        case: "multiple requested header values",
        header: {
          origin: "https://app.com",
          "access-control-request-method": "POST",
          "access-control-request-headers": ["Content-Type", "Authorization"],
        },
      },
      {
        case: "duplicate differently cased requested header names",
        header: {
          origin: "https://app.com",
          "access-control-request-method": "POST",
          "access-control-request-headers": "Content-Type",
          "Access-Control-Request-Headers": "Authorization",
        },
      },
    ])("omits reflected allow-headers for $case", async ({ header }) => {
      const response = await executeCors({
        method: HttpMethod.OPTIONS,
        header,
        finalHandler: finalHandlerShouldNotRun,
      });

      expect(response.statusCode).toBe(204);
      expect(response.header?.["access-control-allow-origin"]).toBe("*");
      expect(response.header?.["access-control-allow-methods"]).toBe(
        "GET, HEAD, PUT, POST, PATCH, DELETE"
      );
      expect(response.header?.["access-control-allow-headers"]).toBeUndefined();
    });

    test("reads preflight request header names case-insensitively", async () => {
      const response = await executeCors({
        method: HttpMethod.OPTIONS,
        header: {
          Origin: "https://app.com",
          "Access-Control-Request-Method": "POST",
          "Access-Control-Request-Headers": "Content-Type, Authorization",
        },
        finalHandler: finalHandlerShouldNotRun,
      });

      expect(response.statusCode).toBe(204);
      expect(response.header?.["access-control-allow-origin"]).toBe("*");
      expect(response.header?.["access-control-allow-headers"]).toBe(
        "Content-Type, Authorization"
      );
    });
  });

  describe("edge cases", () => {
    test("omits Vary when wildcard origin does not depend on the request Origin", async () => {
      const response = await executeCors();

      expect(response.header?.["vary"]).toBeUndefined();
    });
  });
});
