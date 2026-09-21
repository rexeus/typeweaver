import { HttpMethod } from "@rexeus/typeweaver-core";
import type { IHttpResponse } from "@rexeus/typeweaver-core";
import { describe, expect, test } from "vitest";
import { executeMiddlewarePipeline } from "../../../src/lib/Middleware.js";
import { cors } from "../../../src/lib/middleware/cors.js";
import { createServerContext } from "../../helpers.js";
import type { CorsOptions } from "../../../src/lib/middleware/cors.js";

const finalHandlerShouldNotRun = async () => ({
  statusCode: 500,
  body: { error: "final handler used" },
});

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

describe("CORS ambiguous preflight request headers", () => {
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
});

describe("CORS preflight header casing", () => {
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

describe("CORS explicit undefined Origin entries", () => {
  test("treats a lone undefined Origin as absent", async () => {
    const response = await executeCors({
      options: { origin: "https://allowed.com" },
      header: { origin: undefined },
    });
    const absent = await executeCors({
      options: { origin: "https://allowed.com" },
    });

    expect(response.header).toEqual(absent.header);
    expect(response.header?.["access-control-allow-origin"]).toBe(
      "https://allowed.com"
    );
  });

  test.each<{
    readonly case: string;
    readonly header: Record<string, string | undefined>;
  }>([
    {
      case: "valid entry first",
      header: { origin: "https://app.com", Origin: undefined },
    },
    {
      case: "undefined entry first",
      header: { Origin: undefined, origin: "https://app.com" },
    },
  ])(
    "reflects the valid singleton when a differently cased undefined entry shares the Origin name ($case)",
    async ({ header }) => {
      const response = await executeCors({
        options: { origin: ["https://app.com"] },
        header,
      });

      expect(response.header?.["access-control-allow-origin"]).toBe(
        "https://app.com"
      );
      expect(response.header?.["vary"]).toBe("Origin");
    }
  );

  test("still fails closed for genuine differently cased Origin duplicates", async () => {
    const response = await executeCors({
      options: { origin: ["https://app.com"] },
      header: {
        origin: "https://app.com",
        Origin: "https://evil.com",
      },
    });

    expect(response.header?.["access-control-allow-origin"]).toBeUndefined();
    expect(response.header?.["vary"]).toBe("Origin");
  });
});

describe("edge cases", () => {
  test("omits Vary when wildcard origin does not depend on the request Origin", async () => {
    const response = await executeCors();

    expect(response.header?.["vary"]).toBeUndefined();
  });
});
