import { describe, expect, test } from "vitest";
import { StateMap } from "../../src/lib/StateMap";
import { defineMiddleware } from "../../src/lib/TypedMiddleware";
import { TypeweaverApp } from "../../src/lib/TypeweaverApp";
import { createServerContext } from "../helpers";
import type { InferState } from "../../src/lib/TypedMiddleware";

describe("TypedMiddleware", () => {
  describe("defineMiddleware", () => {
    test("should create a middleware descriptor with a handler", () => {
      const mw = defineMiddleware<{ userId: string }>(async (_ctx, next) =>
        next({ userId: "u_1" })
      );

      expect(mw).toHaveProperty("handler");
      expect(mw).toHaveProperty("_brand");
      expect(typeof mw.handler).toBe("function");
    });

    test("handler should pass state through next() and make it available downstream", async () => {
      const mw = defineMiddleware<{ userId: string }>(async (_ctx, next) => {
        return next({ userId: "u_42" });
      });

      const ctx = createServerContext();

      const response = await mw.handler(ctx, async state => {
        if (state) ctx.state.merge(state);
        return {
          statusCode: 200,
          body: { userId: ctx.state.get("userId") },
        };
      });

      expect(response.statusCode).toBe(200);
      expect(response.body).toEqual({ userId: "u_42" });
    });

    test("pass-through middleware should not require state arg", () => {
      const mw = defineMiddleware(async (_ctx, next) => next());

      expect(typeof mw.handler).toBe("function");
    });
  });

  describe("TypeweaverApp typed use()", () => {
    test("should accept typed middleware via use()", () => {
      const auth = defineMiddleware<{ userId: string }>(async (_ctx, next) =>
        next({ userId: "u_1" })
      );

      const app = new TypeweaverApp().use(auth);
      expect(app).toBeInstanceOf(TypeweaverApp);
    });

    test("should chain multiple typed middlewares", () => {
      const auth = defineMiddleware<{ userId: string }>(async (_ctx, next) =>
        next({ userId: "u_1" })
      );

      const permissions = defineMiddleware<
        { permissions: string[] },
        { userId: string }
      >(async (_ctx, next) => next({ permissions: ["read"] }));

      const app = new TypeweaverApp().use(auth).use(permissions);
      expect(app).toBeInstanceOf(TypeweaverApp);
    });

    test("should execute typed middleware at runtime", async () => {
      const { TypeweaverRouter } =
        await import("../../src/lib/TypeweaverRouter");
      const { HttpMethod } = await import("@rexeus/typeweaver-core");
      const { noopValidator } = await import("../helpers");

      const auth = defineMiddleware<{ userId: string }>(async (_ctx, next) =>
        next({ userId: "u_runtime" })
      );

      type Handlers = { handleGet: any };
      class TestRouter extends TypeweaverRouter<Handlers> {
        public constructor(options: any) {
          super(options);
          this.route(HttpMethod.GET, "/test", noopValidator, async (req, ctx) =>
            this.requestHandlers.handleGet(req, ctx)
          );
        }
      }

      const app = new TypeweaverApp().use(auth).route(
        new TestRouter({
          validateRequests: false,
          requestHandlers: {
            handleGet: async (_req: any, ctx: any) => ({
              statusCode: 200,
              body: { userId: ctx.state.get("userId") },
            }),
          },
        })
      );

      const res = await app.fetch(new Request("http://localhost/test"));
      const data = (await res.json()) as { userId: string };
      expect(data.userId).toBe("u_runtime");
    });
  });

  describe("Type-level safety", () => {
    test("should reject wrong middleware ordering at compile time", () => {
      const permissions = defineMiddleware<
        { permissions: string[] },
        { userId: string }
      >(async (_ctx, next) => next({ permissions: [] }));

      // @ts-expect-error — requirements not met: userId is not in the initial empty state
      new TypeweaverApp().use(permissions);
    });

    test("should accept middleware when requirements are met", () => {
      const auth = defineMiddleware<{ userId: string }>(async (_ctx, next) =>
        next({ userId: "u_1" })
      );
      const permissions = defineMiddleware<
        { permissions: string[] },
        { userId: string }
      >(async (_ctx, next) => next({ permissions: [] }));

      // No error — auth provides userId before permissions requires it
      new TypeweaverApp().use(auth).use(permissions);
    });

    test("should reject accessing non-existent state key at compile time", () => {
      const state = new StateMap<{ userId: string }>();
      // @ts-expect-error — "nonExistent" is not a key of { userId: string }
      state.get("nonExistent");
    });

    test("should reject wrong value type in state.set() at compile time", () => {
      const state = new StateMap<{ userId: string }>();
      // @ts-expect-error — number is not assignable to string
      state.set("userId", 123);
    });

    test("InferState should extract accumulated state type", () => {
      const auth = defineMiddleware<{ userId: string }>(async (_ctx, next) =>
        next({ userId: "test" })
      );
      const app = new TypeweaverApp().use(auth);

      type State = InferState<typeof app>;

      // Verify the inferred type structurally by creating a conforming value
      const _check: State = { userId: "test" };
      expect(_check.userId).toBe("test");
    });

    test("should require state argument when TProvides has keys", () => {
      // @ts-expect-error — next() requires { userId: string } argument
      defineMiddleware<{ userId: string }>(async (_ctx, next) => next());
    });

    test("should allow next() without argument when TProvides is empty", () => {
      // No error — pass-through middleware doesn't provide state
      defineMiddleware(async (_ctx, next) => next());
    });
  });
});
