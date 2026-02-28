import { describe, expect, test } from "vitest";
import { executeMiddlewarePipeline } from "../../../src/lib/Middleware";
import { secureHeaders } from "../../../src/lib/middleware/secureHeaders";
import { createServerContext } from "../../helpers";

describe("secureHeaders", () => {
  test("should set all default security headers", async () => {
    const mw = secureHeaders();
    const ctx = createServerContext();

    const response = await executeMiddlewarePipeline(
      [mw.handler],
      ctx,
      async () => ({ statusCode: 200 })
    );

    expect(response.header?.["x-content-type-options"]).toBe("nosniff");
    expect(response.header?.["x-frame-options"]).toBe("SAMEORIGIN");
    expect(response.header?.["strict-transport-security"]).toBe(
      "max-age=15552000; includeSubDomains"
    );
    expect(response.header?.["referrer-policy"]).toBe("no-referrer");
    expect(response.header?.["x-xss-protection"]).toBe("0");
    expect(response.header?.["x-download-options"]).toBe("noopen");
    expect(response.header?.["x-dns-prefetch-control"]).toBe("off");
    expect(response.header?.["x-permitted-cross-domain-policies"]).toBe("none");
    expect(response.header?.["cross-origin-resource-policy"]).toBe(
      "same-origin"
    );
    expect(response.header?.["cross-origin-opener-policy"]).toBe("same-origin");
    expect(response.header?.["cross-origin-embedder-policy"]).toBe(
      "require-corp"
    );
    expect(response.header?.["origin-agent-cluster"]).toBe("?1");
  });

  test("should allow disabling individual headers", async () => {
    const mw = secureHeaders({
      frameOptions: false,
      strictTransportSecurity: false,
    });
    const ctx = createServerContext();

    const response = await executeMiddlewarePipeline(
      [mw.handler],
      ctx,
      async () => ({ statusCode: 200 })
    );

    expect(response.header?.["x-frame-options"]).toBeUndefined();
    expect(response.header?.["strict-transport-security"]).toBeUndefined();
    expect(response.header?.["x-content-type-options"]).toBe("nosniff");
  });

  test("should allow overriding header values", async () => {
    const mw = secureHeaders({
      referrerPolicy: "strict-origin-when-cross-origin",
      strictTransportSecurity: "max-age=31536000",
    });
    const ctx = createServerContext();

    const response = await executeMiddlewarePipeline(
      [mw.handler],
      ctx,
      async () => ({ statusCode: 200 })
    );

    expect(response.header?.["referrer-policy"]).toBe(
      "strict-origin-when-cross-origin"
    );
    expect(response.header?.["strict-transport-security"]).toBe(
      "max-age=31536000"
    );
  });

  test("should let handler headers take precedence", async () => {
    const mw = secureHeaders();
    const ctx = createServerContext();

    const response = await executeMiddlewarePipeline(
      [mw.handler],
      ctx,
      async () => ({
        statusCode: 200,
        header: { "x-frame-options": "DENY" },
      })
    );

    expect(response.header?.["x-frame-options"]).toBe("DENY");
    expect(response.header?.["x-content-type-options"]).toBe("nosniff");
  });

  test("should preserve handler body and status", async () => {
    const mw = secureHeaders();
    const ctx = createServerContext();

    const response = await executeMiddlewarePipeline(
      [mw.handler],
      ctx,
      async () => ({
        statusCode: 201,
        body: { id: "1" },
      })
    );

    expect(response.statusCode).toBe(201);
    expect(response.body).toEqual({ id: "1" });
  });
});
