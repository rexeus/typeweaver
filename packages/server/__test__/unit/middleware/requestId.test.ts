import { describe, expect, test } from "vitest";
import { executeMiddlewarePipeline } from "../../../src/lib/Middleware";
import { requestId } from "../../../src/lib/middleware/requestId";
import { createServerContext } from "../../helpers";

describe("requestId", () => {
  test("should generate a UUID when no header is present", async () => {
    const mw = requestId();
    const ctx = createServerContext();

    const response = await executeMiddlewarePipeline(
      [mw.handler],
      ctx,
      async () => ({ statusCode: 200 })
    );

    const id = response.header?.["x-request-id"];
    expect(id).toBeDefined();
    expect(typeof id).toBe("string");
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    );
  });

  test("should reuse existing request header value", async () => {
    const mw = requestId();
    const ctx = createServerContext({
      header: { "x-request-id": "existing-id-123" },
    });

    const response = await executeMiddlewarePipeline(
      [mw.handler],
      ctx,
      async () => ({ statusCode: 200 })
    );

    expect(response.header?.["x-request-id"]).toBe("existing-id-123");
  });

  test("should provide requestId in state for downstream", async () => {
    const mw = requestId({
      generator: () => "generated-id",
    });
    const ctx = createServerContext();

    await executeMiddlewarePipeline([mw.handler], ctx, async () => {
      expect(ctx.state.get("requestId")).toBe("generated-id");
      return { statusCode: 200 };
    });
  });

  test("should use custom header name", async () => {
    const mw = requestId({
      headerName: "x-trace-id",
      generator: () => "trace-123",
    });
    const ctx = createServerContext();

    const response = await executeMiddlewarePipeline(
      [mw.handler],
      ctx,
      async () => ({ statusCode: 200 })
    );

    expect(response.header?.["x-trace-id"]).toBe("trace-123");
    expect(response.header?.["x-request-id"]).toBeUndefined();
  });

  test("should use custom generator", async () => {
    let counter = 0;
    const mw = requestId({
      generator: () => `req-${++counter}`,
    });
    const ctx = createServerContext();

    const response = await executeMiddlewarePipeline(
      [mw.handler],
      ctx,
      async () => ({ statusCode: 200 })
    );

    expect(response.header?.["x-request-id"]).toBe("req-1");
  });

  test("should pick first value when header is an array", async () => {
    const mw = requestId();
    const ctx = createServerContext({
      header: { "x-request-id": ["first-id", "second-id"] },
    });

    const response = await executeMiddlewarePipeline(
      [mw.handler],
      ctx,
      async () => ({ statusCode: 200 })
    );

    expect(response.header?.["x-request-id"]).toBe("first-id");
  });

  test("should normalize mixed-case headerName to lowercase", async () => {
    const mw = requestId({ headerName: "X-Request-Id" });
    const ctx = createServerContext({
      header: { "x-request-id": "existing-from-header" },
    });

    const response = await executeMiddlewarePipeline(
      [mw.handler],
      ctx,
      async () => ({ statusCode: 200 })
    );

    expect(response.header?.["x-request-id"]).toBe("existing-from-header");
    expect(response.header?.["X-Request-Id"]).toBeUndefined();
  });

  test("should preserve existing response headers", async () => {
    const mw = requestId({ generator: () => "id-1" });
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
    expect(response.header?.["x-request-id"]).toBe("id-1");
  });
});
