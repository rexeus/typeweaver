import type { IHttpResponse } from "@rexeus/typeweaver-core";
import { TestApplicationError, TestAssertionError } from "test-utils";
import { describe, expect, test } from "vitest";
import { MiddlewareNextAlreadyCalledError } from "../../src/lib/errors/index.js";
import { executeMiddlewarePipeline } from "../../src/lib/Middleware.js";
import { createServerContext } from "../helpers.js";
import type { Middleware } from "../../src/lib/Middleware.js";

const okResponse = (body?: unknown): IHttpResponse => ({
  statusCode: 200,
  ...(body === undefined ? {} : { body }),
});

const recordingMiddleware =
  (name: string, order: string[]): Middleware =>
  async (_ctx, next) => {
    order.push(`${name}-before`);
    const response = await next();
    order.push(`${name}-after`);
    return response;
  };

const captureMiddlewareNextAlreadyCalledError = async (
  promise: Promise<unknown>
): Promise<MiddlewareNextAlreadyCalledError> => {
  const error = await promise.then(
    () => undefined,
    caughtError => caughtError
  );

  if (!(error instanceof MiddlewareNextAlreadyCalledError)) {
    throw new TestAssertionError(
      "Expected MiddlewareNextAlreadyCalledError to be thrown"
    );
  }

  return error;
};

describe("middleware pipeline", () => {
  test("calls the final handler when no middleware is registered", async () => {
    const ctx = createServerContext();

    const response = await executeMiddlewarePipeline([], ctx, async () =>
      okResponse({ message: "handler" })
    );

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({ message: "handler" });
  });

  test("wraps a single pass-through middleware around the final handler", async () => {
    const ctx = createServerContext();
    const order: string[] = [];
    const middleware = recordingMiddleware("middleware", order);

    const response = await executeMiddlewarePipeline(
      [middleware],
      ctx,
      async () => {
        order.push("handler");
        return okResponse({ message: "ok" });
      }
    );

    expect(response.statusCode).toBe(200);
    expect(order).toEqual(["middleware-before", "handler", "middleware-after"]);
  });

  test("executes multiple middleware in onion order", async () => {
    const ctx = createServerContext();
    const order: string[] = [];
    const mw1 = recordingMiddleware("mw1", order);
    const mw2 = recordingMiddleware("mw2", order);

    await executeMiddlewarePipeline([mw1, mw2], ctx, async () => {
      order.push("handler");
      return okResponse();
    });

    expect(order).toEqual([
      "mw1-before",
      "mw2-before",
      "handler",
      "mw2-after",
      "mw1-after",
    ]);
  });

  test("returns a short-circuit response without calling the final handler", async () => {
    const ctx = createServerContext();
    let handlerCalled = false;

    const authMiddleware: Middleware = async () => ({
      statusCode: 401,
      body: { message: "Unauthorized" },
    });

    const response = await executeMiddlewarePipeline(
      [authMiddleware],
      ctx,
      async () => {
        handlerCalled = true;
        return okResponse();
      }
    );

    expect(response.statusCode).toBe(401);
    expect(handlerCalled).toBe(false);
  });

  test("prevents later middleware and the final handler after a short-circuit", async () => {
    const ctx = createServerContext();
    const reached: string[] = [];

    const mw1: Middleware = async (_ctx, next) => {
      reached.push("mw1");
      return next();
    };
    const mw2: Middleware = async () => {
      reached.push("mw2");
      return {
        statusCode: 403,
        body: { message: "Forbidden" },
      };
    };
    const mw3: Middleware = async (_ctx, next) => {
      reached.push("mw3");
      return next();
    };

    const response = await executeMiddlewarePipeline(
      [mw1, mw2, mw3],
      ctx,
      async () => {
        reached.push("handler");
        return okResponse();
      }
    );

    expect(response.statusCode).toBe(403);
    expect(reached).toEqual(["mw1", "mw2"]);
  });

  test("preserves existing response fields when middleware adds headers", async () => {
    const ctx = createServerContext();

    const addHeader: Middleware = async (_ctx, next) => {
      const response = await next();
      return {
        ...response,
        header: { ...response.header, "x-request-id": "abc-123" },
      };
    };

    const response = await executeMiddlewarePipeline(
      [addHeader],
      ctx,
      async () => ({
        statusCode: 200,
        header: { "content-type": "application/json" },
        body: { ok: true },
      })
    );

    expect(response).toEqual({
      statusCode: 200,
      header: {
        "content-type": "application/json",
        "x-request-id": "abc-123",
      },
      body: { ok: true },
    });
  });

  test("makes state passed to next available downstream", async () => {
    const ctx = createServerContext();

    const setUser: Middleware = async (_ctx, next) => {
      return next({ userId: "user_42" });
    };

    const response = await executeMiddlewarePipeline([setUser], ctx, async () =>
      okResponse({ userId: ctx.state.get("userId") })
    );

    expect(response.body).toEqual({ userId: "user_42" });
  });

  test("accumulates state from multiple middleware without replacing unrelated values", async () => {
    const ctx = createServerContext();

    const setUser: Middleware = async (_ctx, next) => next({ userId: "u_1" });
    const setRole: Middleware = async (_ctx, next) => next({ role: "admin" });

    const response = await executeMiddlewarePipeline(
      [setUser, setRole],
      ctx,
      async () =>
        okResponse({
          userId: ctx.state.get("userId"),
          role: ctx.state.get("role"),
        })
    );

    expect(response.body).toEqual({ userId: "u_1", role: "admin" });
  });

  test("lets downstream middleware read upstream state before the final handler", async () => {
    const ctx = createServerContext();

    const setUser: Middleware = async (_ctx, next) => next({ userId: "u_1" });
    const deriveGreeting: Middleware = async (ctx, next) => {
      const userId = ctx.state.get("userId");
      return next({ greeting: `hello ${userId}` });
    };

    const response = await executeMiddlewarePipeline(
      [setUser, deriveGreeting],
      ctx,
      async () =>
        okResponse({
          userId: ctx.state.get("userId"),
          greeting: ctx.state.get("greeting"),
        })
    );

    expect(response.body).toEqual({ userId: "u_1", greeting: "hello u_1" });
  });

  test("overlays matching state keys while preserving earlier keys", async () => {
    const ctx = createServerContext();

    const setReader: Middleware = async (_ctx, next) =>
      next({ userId: "u_1", role: "reader" });
    const promoteToAdmin: Middleware = async (_ctx, next) =>
      next({ role: "admin" });

    const response = await executeMiddlewarePipeline(
      [setReader, promoteToAdmin],
      ctx,
      async () =>
        okResponse({
          userId: ctx.state.get("userId"),
          role: ctx.state.get("role"),
        })
    );

    expect(response.body).toEqual({ userId: "u_1", role: "admin" });
  });

  test("propagates errors thrown by middleware", async () => {
    const ctx = createServerContext();

    const errorMiddleware: Middleware = async () => {
      throw new TestApplicationError("Middleware exploded");
    };

    await expect(
      executeMiddlewarePipeline([errorMiddleware], ctx, async () =>
        okResponse()
      )
    ).rejects.toThrow("Middleware exploded");
  });

  test("propagates errors thrown by the final handler", async () => {
    const ctx = createServerContext();

    await expect(
      executeMiddlewarePipeline([], ctx, async () => {
        throw new TestApplicationError("Handler exploded");
      })
    ).rejects.toThrow("Handler exploded");
  });

  test("rejects a middleware that calls next twice", async () => {
    const ctx = createServerContext();

    const doubleCallMiddleware: Middleware = async (_ctx, next) => {
      await next();
      return next();
    };

    const error = await captureMiddlewareNextAlreadyCalledError(
      executeMiddlewarePipeline([doubleCallMiddleware], ctx, async () =>
        okResponse()
      )
    );

    expect(error).toEqual(
      expect.objectContaining({
        middlewareIndex: 0,
      })
    );
  });

  test("reports the non-zero middleware index that calls next twice", async () => {
    const ctx = createServerContext();

    const passThroughMiddleware: Middleware = async (_ctx, next) => next();
    const doubleCallMiddleware: Middleware = async (_ctx, next) => {
      await next();
      return next();
    };

    const error = await captureMiddlewareNextAlreadyCalledError(
      executeMiddlewarePipeline(
        [passThroughMiddleware, doubleCallMiddleware],
        ctx,
        async () => okResponse()
      )
    );

    expect(error).toEqual(
      expect.objectContaining({
        middlewareIndex: 1,
      })
    );
  });

  test("allows separate middleware instances to each call next once", async () => {
    const ctx = createServerContext();
    const order: string[] = [];

    const mw1: Middleware = async (_ctx, next) => {
      order.push("mw1");
      return next();
    };
    const mw2: Middleware = async (_ctx, next) => {
      order.push("mw2");
      return next();
    };

    const response = await executeMiddlewarePipeline(
      [mw1, mw2],
      ctx,
      async () => {
        order.push("handler");
        return okResponse();
      }
    );

    expect(response.statusCode).toBe(200);
    expect(order).toEqual(["mw1", "mw2", "handler"]);
  });
});
