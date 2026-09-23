import { describe, expectTypeOf, test } from "vitest";
import { except, scoped } from "../../../../src/lib/middleware/scoped.js";
import { defineMiddleware } from "../../../../src/lib/TypedMiddleware.js";
import { TypeweaverApp } from "../../../../src/lib/TypeweaverApp.js";
import type { InferState } from "../../../../src/lib/TypedMiddleware.js";

type NoPhantomUserId<TState> = "userId" extends keyof TState
  ? never
  : { readonly userId?: never };

describe("scoped middleware type-level requirements", () => {
  test("typecheck rejects state-providing middleware passed to scoped", () => {
    const auth = defineMiddleware<{ userId: string }>(async (_ctx, next) =>
      next({ userId: "u_1" })
    );

    // @ts-expect-error — scoped middleware may be skipped, so it cannot provide downstream state.
    scoped(["/api/*"], auth);
  });

  test("typecheck rejects scoped middleware that requires upstream state and provides downstream state", () => {
    const permissions = defineMiddleware<
      { permissions: string[] },
      { userId: string }
    >(async (_ctx, next) => next({ permissions: ["todos:read"] }));

    // @ts-expect-error — scoped middleware may be skipped, so it cannot provide downstream state.
    scoped(["/api/*"], permissions);
  });

  test("typecheck accepts scoped middleware requiring upstream state after it is provided", () => {
    const auth = defineMiddleware<{ userId: string }>(async (_ctx, next) =>
      next({ userId: "u_1" })
    );
    const requiresUser = defineMiddleware<{}, { userId: string }>(
      async (ctx, next) => {
        ctx.state.get("userId");
        return next();
      }
    );

    new TypeweaverApp().use(auth).use(scoped(["/api/*"], requiresUser));
  });

  test("typecheck preserves scoped middleware requirements without provided state", () => {
    const requiresUser = defineMiddleware<{}, { userId: string }>(
      async (ctx, next) => {
        ctx.state.get("userId");
        return next();
      }
    );

    const middleware = scoped(["/api/*"], requiresUser);

    expectTypeOf(middleware._brand.provides).toEqualTypeOf<{}>();
    expectTypeOf(middleware._brand.requires).toEqualTypeOf<{
      userId: string;
    }>();
  });

  test("typecheck rejects scoped middleware requiring upstream state before it is provided", () => {
    const requiresUser = defineMiddleware<{}, { userId: string }>(
      async (ctx, next) => {
        ctx.state.get("userId");
        return next();
      }
    );

    // @ts-expect-error — scoped must preserve wrapped middleware requirements.
    new TypeweaverApp().use(scoped(["/api/*"], requiresUser));
  });
});

describe("scoped middleware inferred state", () => {
  test("typecheck infers scoped pass-through middleware without phantom provided state", () => {
    const passThrough = defineMiddleware(async (_ctx, next) => next());
    const app = new TypeweaverApp().use(scoped(["/api/*"], passThrough));

    type ScopedInferredState = NoPhantomUserId<InferState<typeof app>>;
    const emptyStateIsAccepted: ScopedInferredState = {};

    // @ts-expect-error — scoped pass-through middleware must not add userId to inferred state.
    const phantomUserState: ScopedInferredState = { userId: "u_1" };

    void emptyStateIsAccepted;
    void phantomUserState;
  });

  test("typecheck allows later middleware to provide userId after scoped pass-through middleware", () => {
    const passThrough = defineMiddleware(async (_ctx, next) => next());
    const auth = defineMiddleware<{ userId: string }>(async (_ctx, next) =>
      next({ userId: "u_1" })
    );
    const app = new TypeweaverApp()
      .use(scoped(["/api/*"], passThrough))
      .use(auth);

    type State = InferState<typeof app>;
    expectTypeOf<State>().toEqualTypeOf<{ userId: string }>();
  });

  test("typecheck infers scoped requirement-preserving middleware without phantom provided state", () => {
    const auth = defineMiddleware<{ userId: string }>(async (_ctx, next) =>
      next({ userId: "u_1" })
    );
    const requiresUser = defineMiddleware<{}, { userId: string }>(
      async (ctx, next) => {
        ctx.state.get("userId");
        return next();
      }
    );
    const app = new TypeweaverApp()
      .use(auth)
      .use(scoped(["/api/*"], requiresUser));

    type State = InferState<typeof app>;
    const validState: State = { userId: "u_1" };

    // @ts-expect-error — scoped requirement-only middleware must not add downstream-only state.
    const downstreamOnlyState: State = { userId: "u_1", permissions: [] };

    void validState;
    void downstreamOnlyState;
  });
});

describe("excluded middleware type-level requirements", () => {
  test("typecheck rejects state-providing middleware passed to except", () => {
    const auth = defineMiddleware<{ userId: string }>(async (_ctx, next) =>
      next({ userId: "u_1" })
    );

    // @ts-expect-error — except middleware may be skipped, so it cannot provide downstream state.
    except(["/health"], auth);
  });

  test("typecheck rejects except middleware that requires upstream state and provides downstream state", () => {
    const permissions = defineMiddleware<
      { permissions: string[] },
      { userId: string }
    >(async (_ctx, next) => next({ permissions: ["todos:read"] }));

    // @ts-expect-error — except middleware may be skipped, so it cannot provide downstream state.
    except(["/health"], permissions);
  });

  test("typecheck accepts except middleware requiring upstream state after it is provided", () => {
    const auth = defineMiddleware<{ userId: string }>(async (_ctx, next) =>
      next({ userId: "u_1" })
    );
    const requiresUser = defineMiddleware<{}, { userId: string }>(
      async (ctx, next) => {
        ctx.state.get("userId");
        return next();
      }
    );

    new TypeweaverApp().use(auth).use(except(["/health"], requiresUser));
  });

  test("typecheck preserves except middleware requirements without provided state", () => {
    const requiresUser = defineMiddleware<{}, { userId: string }>(
      async (ctx, next) => {
        ctx.state.get("userId");
        return next();
      }
    );

    const middleware = except(["/health"], requiresUser);

    expectTypeOf(middleware._brand.provides).toEqualTypeOf<{}>();
    expectTypeOf(middleware._brand.requires).toEqualTypeOf<{
      userId: string;
    }>();
  });

  test("typecheck rejects except middleware requiring upstream state before it is provided", () => {
    const requiresUser = defineMiddleware<{}, { userId: string }>(
      async (ctx, next) => {
        ctx.state.get("userId");
        return next();
      }
    );

    // @ts-expect-error — except must preserve wrapped middleware requirements.
    new TypeweaverApp().use(except(["/health"], requiresUser));
  });
});

describe("excluded middleware inferred state", () => {
  test("typecheck infers excluded pass-through middleware without phantom provided state", () => {
    const passThrough = defineMiddleware(async (_ctx, next) => next());
    const app = new TypeweaverApp().use(except(["/health"], passThrough));

    type ExcludedInferredState = NoPhantomUserId<InferState<typeof app>>;
    const emptyStateIsAccepted: ExcludedInferredState = {};

    // @ts-expect-error — except pass-through middleware must not add userId to inferred state.
    const phantomUserState: ExcludedInferredState = { userId: "u_1" };

    void emptyStateIsAccepted;
    void phantomUserState;
  });

  test("typecheck allows later middleware to provide userId after except pass-through middleware", () => {
    const passThrough = defineMiddleware(async (_ctx, next) => next());
    const auth = defineMiddleware<{ userId: string }>(async (_ctx, next) =>
      next({ userId: "u_1" })
    );
    const app = new TypeweaverApp()
      .use(except(["/health"], passThrough))
      .use(auth);

    type State = InferState<typeof app>;
    expectTypeOf<State>().toEqualTypeOf<{ userId: string }>();
  });

  test("typecheck infers except requirement-preserving middleware without phantom provided state", () => {
    const auth = defineMiddleware<{ userId: string }>(async (_ctx, next) =>
      next({ userId: "u_1" })
    );
    const requiresUser = defineMiddleware<{}, { userId: string }>(
      async (ctx, next) => {
        ctx.state.get("userId");
        return next();
      }
    );
    const app = new TypeweaverApp()
      .use(auth)
      .use(except(["/health"], requiresUser));

    type State = InferState<typeof app>;
    const validState: State = { userId: "u_1" };

    // @ts-expect-error — except requirement-only middleware must not add downstream-only state.
    const downstreamOnlyState: State = { userId: "u_1", permissions: [] };

    void validState;
    void downstreamOnlyState;
  });
});
