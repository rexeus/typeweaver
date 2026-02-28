import { describe, expect, test, vi } from "vitest";
import { executeMiddlewarePipeline } from "../../../src/lib/Middleware";
import { logger } from "../../../src/lib/middleware/logger";
import { createServerContext } from "../../helpers";

describe("logger", () => {
  test("should log request with default format", async () => {
    const logFn = vi.fn();
    const mw = logger({ logFn });
    const ctx = createServerContext({ method: "GET", path: "/users" });

    await executeMiddlewarePipeline([mw.handler], ctx, async () => ({
      statusCode: 200,
    }));

    expect(logFn).toHaveBeenCalledOnce();
    const message = logFn.mock.calls[0]![0] as string;
    expect(message).toMatch(/^GET \/users 200 \d+ms$/);
  });

  test("should use custom format function", async () => {
    const logFn = vi.fn();
    const mw = logger({
      logFn,
      format: data => `[${data.statusCode}] ${data.method} ${data.path}`,
    });
    const ctx = createServerContext({ method: "POST", path: "/items" });

    await executeMiddlewarePipeline([mw.handler], ctx, async () => ({
      statusCode: 201,
    }));

    expect(logFn).toHaveBeenCalledWith("[201] POST /items");
  });

  test("should not modify the response", async () => {
    const logFn = vi.fn();
    const mw = logger({ logFn });
    const ctx = createServerContext();

    const response = await executeMiddlewarePipeline(
      [mw.handler],
      ctx,
      async () => ({
        statusCode: 200,
        body: { ok: true },
        header: { "x-custom": "value" },
      })
    );

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({ ok: true });
    expect(response.header?.["x-custom"]).toBe("value");
  });

  test("should log after response is received", async () => {
    const order: string[] = [];
    const logFn = vi.fn(() => order.push("logged"));
    const mw = logger({ logFn });
    const ctx = createServerContext();

    await executeMiddlewarePipeline([mw.handler], ctx, async () => {
      order.push("handler");
      return { statusCode: 200 };
    });

    expect(order).toEqual(["handler", "logged"]);
  });

  test("should use console.log by default", async () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const mw = logger();
    const ctx = createServerContext({ method: "DELETE", path: "/items/1" });

    await executeMiddlewarePipeline([mw.handler], ctx, async () => ({
      statusCode: 204,
    }));

    expect(consoleSpy).toHaveBeenCalledOnce();
    const message = consoleSpy.mock.calls[0]![0] as string;
    expect(message).toMatch(/^DELETE \/items\/1 204 \d+ms$/);

    consoleSpy.mockRestore();
  });
});
