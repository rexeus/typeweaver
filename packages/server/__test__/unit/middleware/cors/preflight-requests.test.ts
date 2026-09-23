import { HttpMethod } from "@rexeus/typeweaver-core";
import { describe, expect, test, vi } from "vitest";
import { finalHandlerShouldNotRun } from "../fixtures.js";
import {
  downstreamResponseWithPermissiveCorsPolicy,
  executeCors,
  expectNoPolicyControlledCorsHeaders,
} from "./fixtures.js";
import type { CorsOptions } from "../../../../src/lib/middleware/cors.js";

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

    expect(response.header?.["access-control-allow-methods"]).toBe("GET, POST");
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
});

describe("CORS credentialed preflight responses", () => {
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
    expect(response.header?.["access-control-allow-credentials"]).toBe("true");
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
});

describe("CORS preflight allowed headers", () => {
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
});

describe("CORS rejected and regular OPTIONS requests", () => {
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
});
