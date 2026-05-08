import type { IHttpResponse } from "@rexeus/typeweaver-core";
import { describe, expect, test } from "vitest";
import { executeMiddlewarePipeline } from "../../../src/lib/Middleware.js";
import { requestId } from "../../../src/lib/middleware/requestId.js";
import { createServerContext } from "../../helpers.js";
import type { RequestIdOptions } from "../../../src/lib/middleware/requestId.js";

type RequestIdScenario = {
  readonly options?: RequestIdOptions;
  readonly ctx?: ReturnType<typeof createServerContext>;
  readonly finalHandler?: () => Promise<IHttpResponse>;
};

const defaultHandler = async (): Promise<IHttpResponse> => ({
  statusCode: 200,
});

const executeRequestId = ({
  options,
  ctx = createServerContext(),
  finalHandler = defaultHandler,
}: RequestIdScenario = {}): Promise<IHttpResponse> => {
  const mw = requestId(options);

  return executeMiddlewarePipeline([mw.handler], ctx, finalHandler);
};

const expectUuid = (value: string | string[] | undefined): void => {
  expect(typeof value).toBe("string");
  expect(value).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
  );
};

describe("requestId", () => {
  test("generates a UUID when no inbound request ID exists", async () => {
    const response = await executeRequestId();

    expectUuid(response.header?.["x-request-id"]);
  });

  test("reuses a valid inbound request ID with case-insensitive lookup", async () => {
    const ctx = createServerContext({
      header: { "X-Request-ID": "existing-id-123" },
    });

    const response = await executeRequestId({ ctx });

    expect(response.header?.["x-request-id"]).toBe("existing-id-123");
  });

  test("exposes the same request ID to downstream state and response headers", async () => {
    const ctx = createServerContext();

    const response = await executeRequestId({
      options: { generator: () => "generated-id" },
      ctx,
      finalHandler: async () => ({
        statusCode: 200,
        body: { requestId: ctx.state.get("requestId") },
      }),
    });

    expect(response.header?.["x-request-id"]).toBe("generated-id");
    expect(response.body).toEqual({ requestId: "generated-id" });
  });

  test("writes custom request ID headers with a lowercase name", async () => {
    const response = await executeRequestId({
      options: {
        headerName: "X-Trace-ID",
        generator: () => "trace-123",
      },
    });

    expect(response.header?.["x-trace-id"]).toBe("trace-123");
    expect(response.header?.["X-Trace-ID"]).toBeUndefined();
    expect(response.header?.["x-request-id"]).toBeUndefined();
  });

  test("reuses a valid custom inbound request ID with case-insensitive lookup", async () => {
    const ctx = createServerContext({
      header: { "x-trace-id": "incoming-trace" },
    });

    const response = await executeRequestId({
      options: {
        headerName: "X-Trace-ID",
        generator: () => "generated-id",
      },
      ctx,
      finalHandler: async () => ({
        statusCode: 200,
        body: { requestId: ctx.state.get("requestId") },
      }),
    });

    expect(response.header?.["x-trace-id"]).toBe("incoming-trace");
    expect(response.header?.["x-request-id"]).toBeUndefined();
    expect(response.body).toEqual({ requestId: "incoming-trace" });
  });

  test("does not invoke the generator when a valid inbound request ID exists", async () => {
    const ctx = createServerContext({
      header: { "X-Request-ID": "existing-id" },
    });

    const response = await executeRequestId({
      options: {
        generator: () => {
          throw new Error("generator should not run");
        },
      },
      ctx,
    });

    expect(response.header?.["x-request-id"]).toBe("existing-id");
  });

  test("uses the custom generator when no valid inbound request ID exists", async () => {
    const response = await executeRequestId({
      options: { generator: () => "req-1" },
    });

    expect(response.header?.["x-request-id"]).toBe("req-1");
  });

  test("rejects array-valued inbound request IDs", async () => {
    const ctx = createServerContext({
      header: { "x-request-id": ["first-id", "second-id"] },
    });

    const response = await executeRequestId({
      options: { generator: () => "generated-id" },
      ctx,
    });

    expect(response.header?.["x-request-id"]).toBe("generated-id");
  });

  test("rejects mixed duplicate and array-valued inbound request IDs", async () => {
    const ctx = createServerContext({
      header: {
        "X-Request-ID": ["first-id"],
        "x-request-id": "second-id",
      },
    });

    const response = await executeRequestId({
      options: { generator: () => "generated-id" },
      ctx,
      finalHandler: async () => ({
        statusCode: 200,
        body: { requestId: ctx.state.get("requestId") },
      }),
    });

    expect(response.header?.["x-request-id"]).toBe("generated-id");
    expect(response.body).toEqual({ requestId: "generated-id" });
  });

  test("rejects duplicate differently cased inbound request IDs", async () => {
    const ctx = createServerContext({
      header: {
        "x-request-id": "first-id",
        "X-Request-ID": "second-id",
      },
    });

    const response = await executeRequestId({
      options: { generator: () => "generated-id" },
      ctx,
    });

    expect(response.header?.["x-request-id"]).toBe("generated-id");
  });

  test("rejects empty inbound request IDs", async () => {
    const ctx = createServerContext({ header: { "x-request-id": "" } });

    const response = await executeRequestId({
      options: { generator: () => "generated-id" },
      ctx,
    });

    expect(response.header?.["x-request-id"]).toBe("generated-id");
  });

  test.each([
    { case: "CR", inboundValue: "safe\rinjected" },
    { case: "LF", inboundValue: "safe\ninjected" },
  ])(
    "rejects inbound request IDs containing $case",
    async ({ inboundValue }) => {
      const ctx = createServerContext({
        header: { "x-request-id": inboundValue },
      });

      const response = await executeRequestId({
        options: { generator: () => "generated-id" },
        ctx,
        finalHandler: async () => ({
          statusCode: 200,
          body: { requestId: ctx.state.get("requestId") },
        }),
      });

      expect(response.header?.["x-request-id"]).toBe("generated-id");
      expect(response.body).toEqual({ requestId: "generated-id" });
    }
  );

  test("overrides conflicting downstream request ID headers case-insensitively", async () => {
    const response = await executeRequestId({
      options: { generator: () => "generated-id" },
      finalHandler: async () => ({
        statusCode: 200,
        header: {
          "X-Request-ID": "downstream-id",
          "x-request-id": "second-downstream-id",
          "content-type": "application/json",
        },
      }),
    });

    expect(response.header?.["x-request-id"]).toBe("generated-id");
    expect(response.header?.["X-Request-ID"]).toBeUndefined();
    expect(response.header?.["content-type"]).toBe("application/json");
  });

  test("replaces array-valued downstream request ID headers", async () => {
    const response = await executeRequestId({
      options: { generator: () => "generated-id" },
      finalHandler: async () => ({
        statusCode: 200,
        header: {
          "X-Request-ID": ["bad-1", "bad-2"],
          "x-custom": "value",
        },
      }),
    });

    expect(response.header?.["x-request-id"]).toBe("generated-id");
    expect(response.header?.["X-Request-ID"]).toBeUndefined();
    expect(response.header?.["x-custom"]).toBe("value");
  });

  test("preserves downstream status and body while replacing request ID headers", async () => {
    const response = await executeRequestId({
      options: { generator: () => "generated-id" },
      finalHandler: async () => ({
        statusCode: 202,
        body: { queued: true },
        header: {
          "X-Request-ID": "downstream-id",
          "content-type": "application/json",
        },
      }),
    });

    expect(response.statusCode).toBe(202);
    expect(response.body).toEqual({ queued: true });
    expect(response.header?.["x-request-id"]).toBe("generated-id");
    expect(response.header?.["X-Request-ID"]).toBeUndefined();
    expect(response.header?.["content-type"]).toBe("application/json");
  });
});
