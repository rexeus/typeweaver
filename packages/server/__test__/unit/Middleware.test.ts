import { describe, expect, test } from "vitest";
import { executeMiddlewarePipeline } from "../../src/lib/Middleware";
import { createServerContext } from "../helpers";
import type { Middleware } from "../../src/lib/Middleware";

describe("Middleware Pipeline", () => {
  describe("executeMiddlewarePipeline", () => {
    test("should call final handler when no middleware registered", async () => {
      const ctx = createServerContext();

      const response = await executeMiddlewarePipeline([], ctx, async () => ({
        statusCode: 200,
        body: { message: "handler" },
      }));

      expect(response.statusCode).toBe(200);
      expect(response.body).toEqual({ message: "handler" });
    });

    test("should execute single middleware that passes through", async () => {
      const ctx = createServerContext();
      const order: string[] = [];

      const middleware: Middleware = async (_ctx, next) => {
        order.push("before");
        const response = await next();
        order.push("after");
        return response;
      };

      const response = await executeMiddlewarePipeline(
        [middleware],
        ctx,
        async () => {
          order.push("handler");
          return { statusCode: 200, body: { message: "ok" } };
        }
      );

      expect(response.statusCode).toBe(200);
      expect(order).toEqual(["before", "handler", "after"]);
    });

    test("should execute middleware in onion order", async () => {
      const ctx = createServerContext();
      const order: string[] = [];

      const mw1: Middleware = async (_ctx, next) => {
        order.push("mw1-before");
        const response = await next();
        order.push("mw1-after");
        return response;
      };

      const mw2: Middleware = async (_ctx, next) => {
        order.push("mw2-before");
        const response = await next();
        order.push("mw2-after");
        return response;
      };

      await executeMiddlewarePipeline([mw1, mw2], ctx, async () => {
        order.push("handler");
        return { statusCode: 200 };
      });

      expect(order).toEqual([
        "mw1-before",
        "mw2-before",
        "handler",
        "mw2-after",
        "mw1-after",
      ]);
    });

    test("should short-circuit when middleware returns without calling next", async () => {
      const ctx = createServerContext();
      let handlerCalled = false;

      const authMiddleware: Middleware = async () => {
        return { statusCode: 401, body: { message: "Unauthorized" } };
      };

      const response = await executeMiddlewarePipeline(
        [authMiddleware],
        ctx,
        async () => {
          handlerCalled = true;
          return { statusCode: 200 };
        }
      );

      expect(response.statusCode).toBe(401);
      expect(handlerCalled).toBe(false);
    });

    test("should short-circuit at correct middleware in chain", async () => {
      const ctx = createServerContext();
      const reached: string[] = [];

      const mw1: Middleware = async (_ctx, next) => {
        reached.push("mw1");
        return next();
      };

      const mw2: Middleware = async () => {
        reached.push("mw2");
        return { statusCode: 403, body: { message: "Forbidden" } };
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
          return { statusCode: 200 };
        }
      );

      expect(response.statusCode).toBe(403);
      expect(reached).toEqual(["mw1", "mw2"]);
    });

    test("should allow middleware to modify the response", async () => {
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

      expect(response.statusCode).toBe(200);
      expect(response.header).toEqual({
        "content-type": "application/json",
        "x-request-id": "abc-123",
      });
    });

    test("should allow middleware to use ctx.state for data passing", async () => {
      const ctx = createServerContext();

      const setUser: Middleware = async (ctx, next) => {
        ctx.state.set("userId", "user_42");
        return next();
      };

      const response = await executeMiddlewarePipeline(
        [setUser],
        ctx,
        async () => {
          const userId = ctx.state.get("userId");
          return {
            statusCode: 200,
            body: { userId },
          };
        }
      );

      expect(response.body).toEqual({ userId: "user_42" });
    });

    test("should propagate errors from middleware", async () => {
      const ctx = createServerContext();

      const errorMiddleware: Middleware = async () => {
        throw new Error("Middleware exploded");
      };

      await expect(
        executeMiddlewarePipeline([errorMiddleware], ctx, async () => ({
          statusCode: 200,
        }))
      ).rejects.toThrow("Middleware exploded");
    });

    test("should propagate errors from final handler", async () => {
      const ctx = createServerContext();

      await expect(
        executeMiddlewarePipeline([], ctx, async () => {
          throw new Error("Handler exploded");
        })
      ).rejects.toThrow("Handler exploded");
    });

    test("should throw when next() is called multiple times", async () => {
      const ctx = createServerContext();

      const doubleCallMiddleware: Middleware = async (_ctx, next) => {
        await next();
        // Calling next() a second time should throw
        return next();
      };

      await expect(
        executeMiddlewarePipeline([doubleCallMiddleware], ctx, async () => ({
          statusCode: 200,
        }))
      ).rejects.toThrow("next() called multiple times");
    });

    test("should allow different middleware to each call next() once", async () => {
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
          return { statusCode: 200 };
        }
      );

      expect(response.statusCode).toBe(200);
      expect(order).toEqual(["mw1", "mw2", "handler"]);
    });
  });
});
