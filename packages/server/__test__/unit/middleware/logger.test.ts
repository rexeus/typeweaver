import { HttpMethod, type IHttpResponse } from "@rexeus/typeweaver-core";
import { describe, expect, test, vi } from "vitest";
import { executeMiddlewarePipeline } from "../../../src/lib/Middleware.js";
import {
  logger,
  type LogData,
  type LoggerOptions,
} from "../../../src/lib/middleware/logger.js";
import { createServerContext } from "../../helpers.js";

type LoggerScenario = {
  readonly options?: LoggerOptions;
  readonly ctx?: ReturnType<typeof createServerContext>;
  readonly finalHandler?: () => Promise<IHttpResponse>;
};

const defaultHandler = async (): Promise<IHttpResponse> => ({ statusCode: 200 });

const nowFrom = (values: readonly number[]): (() => number) => {
  let index = 0;

  return () => values[index++] ?? values.at(-1) ?? 0;
};

const executeLogger = ({
  options,
  ctx = createServerContext(),
  finalHandler = defaultHandler,
}: LoggerScenario = {}): Promise<IHttpResponse> => {
  const mw = logger(options);

  return executeMiddlewarePipeline([mw.handler], ctx, finalHandler);
};

describe("logger", () => {
  test("logs requests with the default format", async () => {
    const logFn = vi.fn();
    const ctx = createServerContext({ method: HttpMethod.GET, path: "/users" });

    await executeLogger({ options: { logFn, nowMs: nowFrom([10, 24.4]) }, ctx });

    expect(logFn).toHaveBeenCalledOnce();
    expect(logFn.mock.calls[0]![0]).toBe("GET /users 200 14ms");
  });

  test("passes complete request and response data to a custom formatter", async () => {
    const logFn = vi.fn();
    const format = vi.fn(
      (data: LogData) => `[${data.statusCode}] ${data.method} ${data.path}`
    );
    const ctx = createServerContext({
      method: HttpMethod.POST,
      path: "/items",
    });

    await executeLogger({
      options: { logFn, format, nowMs: nowFrom([10, 25.8]) },
      ctx,
      finalHandler: async () => ({ statusCode: 201 }),
    });

    expect(format).toHaveBeenCalledOnce();
    expect(format.mock.calls[0]![0]).toEqual({
      method: HttpMethod.POST,
      path: "/items",
      statusCode: 201,
      durationMs: 16,
    });
    expect(logFn).toHaveBeenCalledWith("[201] POST /items");
  });

  test("returns the downstream response unchanged", async () => {
    const logFn = vi.fn();
    const downstreamResponse: IHttpResponse = {
      statusCode: 200,
      body: { ok: true },
      header: { "x-custom": "value" },
    };

    const response = await executeLogger({
      options: { logFn },
      finalHandler: async () => downstreamResponse,
    });

    expect(response).toEqual(downstreamResponse);
  });

  test("logs after the downstream response is produced", async () => {
    const order: string[] = [];
    const logFn = vi.fn(() => order.push("logged"));

    await executeLogger({
      options: { logFn },
      finalHandler: async () => {
        order.push("handler");
        return { statusCode: 200 };
      },
    });

    expect(order).toEqual(["handler", "logged"]);
  });

  test("uses console.log when no logging callback is configured", async () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const ctx = createServerContext({
      method: HttpMethod.DELETE,
      path: "/items/1",
    });

    try {
      await executeLogger({
        options: { nowMs: nowFrom([20, 37.2]) },
        ctx,
        finalHandler: async () => ({ statusCode: 204 }),
      });

      expect(consoleSpy).toHaveBeenCalledOnce();
      expect(consoleSpy.mock.calls[0]![0]).toBe("DELETE /items/1 204 17ms");
    } finally {
      consoleSpy.mockRestore();
    }
  });

  test("propagates downstream errors without logging", async () => {
    const logFn = vi.fn();

    await expect(
      executeLogger({
        options: { logFn },
        finalHandler: async () => {
          throw new Error("downstream failed");
        },
      })
    ).rejects.toThrow("downstream failed");

    expect(logFn).not.toHaveBeenCalled();
  });

  test("propagates formatter errors after downstream completion and before logging", async () => {
    const order: string[] = [];
    const logFn = vi.fn();
    const format = () => {
      order.push("format");
      throw new Error("format failed");
    };

    await expect(
      executeLogger({
        options: { logFn, format, nowMs: nowFrom([0, 1]) },
        finalHandler: async () => {
          order.push("handler");
          return { statusCode: 200 };
        },
      })
    ).rejects.toThrow("format failed");

    expect(order).toEqual(["handler", "format"]);
    expect(logFn).not.toHaveBeenCalled();
  });

  test("propagates logging callback errors after formatting", async () => {
    const order: string[] = [];
    const format = () => {
      order.push("format");
      return "formatted message";
    };
    const logFn = vi.fn((message: string) => {
      order.push(`log:${message}`);
      throw new Error("log failed");
    });

    await expect(
      executeLogger({
        options: { logFn, format, nowMs: nowFrom([0, 1]) },
        finalHandler: async () => {
          order.push("handler");
          return { statusCode: 200 };
        },
      })
    ).rejects.toThrow("log failed");

    expect(order).toEqual(["handler", "format", "log:formatted message"]);
  });
});
