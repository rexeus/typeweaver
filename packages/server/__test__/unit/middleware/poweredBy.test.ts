import { describe, expect, test } from "vitest";
import { executeMiddlewarePipeline } from "../../../src/lib/Middleware";
import { poweredBy } from "../../../src/lib/middleware/poweredBy";
import { createServerContext } from "../../helpers";

describe("poweredBy", () => {
  test("should set X-Powered-By header with default value", async () => {
    const mw = poweredBy();
    const ctx = createServerContext();

    const response = await executeMiddlewarePipeline(
      [mw.handler],
      ctx,
      async () => ({ statusCode: 200, body: { ok: true } })
    );

    expect(response.statusCode).toBe(200);
    expect(response.header?.["x-powered-by"]).toBe("TypeWeaver");
  });

  test("should set custom name", async () => {
    const mw = poweredBy({ name: "MyApp" });
    const ctx = createServerContext();

    const response = await executeMiddlewarePipeline(
      [mw.handler],
      ctx,
      async () => ({ statusCode: 200 })
    );

    expect(response.header?.["x-powered-by"]).toBe("MyApp");
  });

  test("should preserve existing response headers", async () => {
    const mw = poweredBy();
    const ctx = createServerContext();

    const response = await executeMiddlewarePipeline(
      [mw.handler],
      ctx,
      async () => ({
        statusCode: 200,
        header: { "content-type": "application/json" },
      })
    );

    expect(response.header?.["content-type"]).toBe("application/json");
    expect(response.header?.["x-powered-by"]).toBe("TypeWeaver");
  });

  test("should pass through to downstream handler", async () => {
    const mw = poweredBy();
    const ctx = createServerContext();
    let handlerCalled = false;

    await executeMiddlewarePipeline([mw.handler], ctx, async () => {
      handlerCalled = true;
      return { statusCode: 200 };
    });

    expect(handlerCalled).toBe(true);
  });
});
