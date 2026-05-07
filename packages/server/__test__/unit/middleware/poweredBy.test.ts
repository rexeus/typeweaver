import type { IHttpResponse } from "@rexeus/typeweaver-core";
import { describe, expect, test } from "vitest";
import { executeMiddlewarePipeline } from "../../../src/lib/Middleware.js";
import { poweredBy } from "../../../src/lib/middleware/poweredBy.js";
import { createServerContext } from "../../helpers.js";
import type { PoweredByOptions } from "../../../src/lib/middleware/poweredBy.js";

describe("poweredBy", () => {
  const runPoweredByMiddleware = async (
    downstreamResponse: IHttpResponse,
    options?: PoweredByOptions
  ) => {
    const mw = poweredBy(options);
    const ctx = createServerContext();

    return executeMiddlewarePipeline(
      [mw.handler],
      ctx,
      async () => downstreamResponse
    );
  };

  test("adds the default X-Powered-By header to downstream responses", async () => {
    const response = await runPoweredByMiddleware({
      statusCode: 201,
      body: { created: true },
    });

    expect(response.statusCode).toBe(201);
    expect(response.body).toEqual({ created: true });
    expect(response.header?.["x-powered-by"]).toBe("TypeWeaver");
  });

  test("adds the configured X-Powered-By header", async () => {
    const response = await runPoweredByMiddleware(
      { statusCode: 200 },
      { name: "MyApp" }
    );

    expect(response.header?.["x-powered-by"]).toBe("MyApp");
  });

  test("preserves existing response headers when adding X-Powered-By", async () => {
    const response = await runPoweredByMiddleware({
      statusCode: 200,
      header: { "content-type": "application/json" },
    });

    expect(response.header?.["content-type"]).toBe("application/json");
    expect(response.header?.["x-powered-by"]).toBe("TypeWeaver");
  });

  test("overwrites an existing X-Powered-By header", async () => {
    const response = await runPoweredByMiddleware({
      statusCode: 200,
      header: { "x-powered-by": "LegacyApp" },
    });

    expect(response.header?.["x-powered-by"]).toBe("TypeWeaver");
  });

  test("replaces an existing X-Powered-By header regardless of casing", async () => {
    const response = await runPoweredByMiddleware({
      statusCode: 200,
      header: { "X-Powered-By": "LegacyApp" },
    });

    expect(response.header?.["x-powered-by"]).toBe("TypeWeaver");
    expect(response.header?.["X-Powered-By"]).toBeUndefined();
  });

  test("propagates errors thrown by downstream handlers", async () => {
    const mw = poweredBy();
    const ctx = createServerContext();
    const downstreamError = new Error("downstream failed");

    await expect(
      executeMiddlewarePipeline([mw.handler], ctx, async () => {
        throw downstreamError;
      })
    ).rejects.toBe(downstreamError);
  });
});
