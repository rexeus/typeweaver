import { describe, expect, test } from "vitest";
import { executeMiddlewarePipeline } from "../../../src/lib/Middleware";
import { cors } from "../../../src/lib/middleware/cors";
import { createServerContext } from "../../helpers";

describe("cors", () => {
  describe("simple requests", () => {
    test("should set Access-Control-Allow-Origin to * by default", async () => {
      const mw = cors();
      const ctx = createServerContext();

      const response = await executeMiddlewarePipeline(
        [mw.handler],
        ctx,
        async () => ({ statusCode: 200, body: { ok: true } })
      );

      expect(response.statusCode).toBe(200);
      expect(response.header?.["access-control-allow-origin"]).toBe("*");
    });

    test("should set specific origin", async () => {
      const mw = cors({ origin: "https://example.com" });
      const ctx = createServerContext();

      const response = await executeMiddlewarePipeline(
        [mw.handler],
        ctx,
        async () => ({ statusCode: 200 })
      );

      expect(response.header?.["access-control-allow-origin"]).toBe(
        "https://example.com"
      );
      expect(response.header?.["vary"]).toBe("Origin");
    });

    test("should match origin from array", async () => {
      const mw = cors({
        origin: ["https://a.com", "https://b.com"],
      });
      const ctx = createServerContext({
        header: { origin: "https://b.com" },
      });

      const response = await executeMiddlewarePipeline(
        [mw.handler],
        ctx,
        async () => ({ statusCode: 200 })
      );

      expect(response.header?.["access-control-allow-origin"]).toBe(
        "https://b.com"
      );
    });

    test("should pass through without CORS headers when origin not in array", async () => {
      const mw = cors({
        origin: ["https://a.com", "https://b.com"],
      });
      const ctx = createServerContext({
        header: { origin: "https://evil.com" },
      });

      const response = await executeMiddlewarePipeline(
        [mw.handler],
        ctx,
        async () => ({ statusCode: 200 })
      );

      expect(response.header?.["access-control-allow-origin"]).toBeUndefined();
    });

    test("should use function-based origin resolver", async () => {
      const mw = cors({
        origin: origin =>
          origin.endsWith(".example.com") ? origin : undefined,
      });
      const ctx = createServerContext({
        header: { origin: "https://app.example.com" },
      });

      const response = await executeMiddlewarePipeline(
        [mw.handler],
        ctx,
        async () => ({ statusCode: 200 })
      );

      expect(response.header?.["access-control-allow-origin"]).toBe(
        "https://app.example.com"
      );
    });

    test("should set credentials header when enabled", async () => {
      const mw = cors({ credentials: true });
      const ctx = createServerContext({
        header: { origin: "https://app.com" },
      });

      const response = await executeMiddlewarePipeline(
        [mw.handler],
        ctx,
        async () => ({ statusCode: 200 })
      );

      expect(response.header?.["access-control-allow-credentials"]).toBe(
        "true"
      );
    });

    test("should reflect request origin when credentials + wildcard origin", async () => {
      const mw = cors({ credentials: true });
      const ctx = createServerContext({
        header: { origin: "https://my-app.com" },
      });

      const response = await executeMiddlewarePipeline(
        [mw.handler],
        ctx,
        async () => ({ statusCode: 200 })
      );

      expect(response.header?.["access-control-allow-origin"]).toBe(
        "https://my-app.com"
      );
      expect(response.header?.["vary"]).toBe("Origin");
    });

    test("should set expose headers", async () => {
      const mw = cors({
        exposeHeaders: ["X-Request-Id", "X-Total-Count"],
      });
      const ctx = createServerContext();

      const response = await executeMiddlewarePipeline(
        [mw.handler],
        ctx,
        async () => ({ statusCode: 200 })
      );

      expect(response.header?.["access-control-expose-headers"]).toBe(
        "X-Request-Id, X-Total-Count"
      );
    });

    test("should preserve handler response headers", async () => {
      const mw = cors();
      const ctx = createServerContext();

      const response = await executeMiddlewarePipeline(
        [mw.handler],
        ctx,
        async () => ({
          statusCode: 200,
          header: { "x-custom": "value" },
        })
      );

      expect(response.header?.["x-custom"]).toBe("value");
      expect(response.header?.["access-control-allow-origin"]).toBe("*");
    });
  });

  describe("preflight requests", () => {
    test("should short-circuit OPTIONS with 204", async () => {
      const mw = cors();
      const ctx = createServerContext({
        method: "OPTIONS",
        header: {
          origin: "https://app.com",
          "access-control-request-method": "POST",
        },
      });
      let handlerCalled = false;

      const response = await executeMiddlewarePipeline(
        [mw.handler],
        ctx,
        async () => {
          handlerCalled = true;
          return { statusCode: 200 };
        }
      );

      expect(response.statusCode).toBe(204);
      expect(handlerCalled).toBe(false);
    });

    test("should include allowed methods in preflight response", async () => {
      const mw = cors();
      const ctx = createServerContext({
        method: "OPTIONS",
        header: {
          origin: "https://app.com",
          "access-control-request-method": "PUT",
        },
      });

      const response = await executeMiddlewarePipeline(
        [mw.handler],
        ctx,
        async () => ({ statusCode: 200 })
      );

      expect(response.header?.["access-control-allow-methods"]).toBe(
        "GET, HEAD, PUT, POST, PATCH, DELETE"
      );
    });

    test("should use custom allow methods", async () => {
      const mw = cors({ allowMethods: ["GET", "POST"] });
      const ctx = createServerContext({
        method: "OPTIONS",
        header: {
          origin: "https://app.com",
          "access-control-request-method": "GET",
        },
      });

      const response = await executeMiddlewarePipeline(
        [mw.handler],
        ctx,
        async () => ({ statusCode: 200 })
      );

      expect(response.header?.["access-control-allow-methods"]).toBe(
        "GET, POST"
      );
    });

    test("should reflect requested headers when none configured", async () => {
      const mw = cors();
      const ctx = createServerContext({
        method: "OPTIONS",
        header: {
          origin: "https://app.com",
          "access-control-request-method": "POST",
          "access-control-request-headers": "Content-Type, Authorization",
        },
      });

      const response = await executeMiddlewarePipeline(
        [mw.handler],
        ctx,
        async () => ({ statusCode: 200 })
      );

      expect(response.header?.["access-control-allow-headers"]).toBe(
        "Content-Type, Authorization"
      );
    });

    test("should use configured allow headers", async () => {
      const mw = cors({
        allowHeaders: ["Content-Type", "X-API-Key"],
      });
      const ctx = createServerContext({
        method: "OPTIONS",
        header: {
          origin: "https://app.com",
          "access-control-request-method": "POST",
          "access-control-request-headers": "Content-Type, Authorization",
        },
      });

      const response = await executeMiddlewarePipeline(
        [mw.handler],
        ctx,
        async () => ({ statusCode: 200 })
      );

      expect(response.header?.["access-control-allow-headers"]).toBe(
        "Content-Type, X-API-Key"
      );
    });

    test("should set max-age on preflight", async () => {
      const mw = cors({ maxAge: 3600 });
      const ctx = createServerContext({
        method: "OPTIONS",
        header: {
          origin: "https://app.com",
          "access-control-request-method": "POST",
        },
      });

      const response = await executeMiddlewarePipeline(
        [mw.handler],
        ctx,
        async () => ({ statusCode: 200 })
      );

      expect(response.header?.["access-control-max-age"]).toBe("3600");
    });

    test("should not treat regular OPTIONS as preflight", async () => {
      const mw = cors();
      const ctx = createServerContext({
        method: "OPTIONS",
      });
      let handlerCalled = false;

      const response = await executeMiddlewarePipeline(
        [mw.handler],
        ctx,
        async () => {
          handlerCalled = true;
          return { statusCode: 200 };
        }
      );

      expect(handlerCalled).toBe(true);
      expect(response.statusCode).toBe(200);
    });
  });

  describe("edge cases", () => {
    test("should not set Vary header when origin is *", async () => {
      const mw = cors();
      const ctx = createServerContext();

      const response = await executeMiddlewarePipeline(
        [mw.handler],
        ctx,
        async () => ({ statusCode: 200 })
      );

      expect(response.header?.["vary"]).toBeUndefined();
    });

    test("should fall back to * when credentials false and no request origin", async () => {
      const mw = cors();
      const ctx = createServerContext();

      const response = await executeMiddlewarePipeline(
        [mw.handler],
        ctx,
        async () => ({ statusCode: 200 })
      );

      expect(response.header?.["access-control-allow-origin"]).toBe("*");
    });
  });
});
