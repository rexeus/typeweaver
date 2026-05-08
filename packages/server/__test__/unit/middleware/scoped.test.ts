import type { IHttpResponse } from "@rexeus/typeweaver-core";
import { describe, expect, expectTypeOf, test } from "vitest";
import { executeMiddlewarePipeline } from "../../../src/lib/Middleware.js";
import { except, scoped } from "../../../src/lib/middleware/scoped.js";
import { defineMiddleware } from "../../../src/lib/TypedMiddleware.js";
import { TypeweaverApp } from "../../../src/lib/TypeweaverApp.js";
import { createServerContext } from "../../helpers.js";
import type {
  InferState,
  TypedMiddleware,
} from "../../../src/lib/TypedMiddleware.js";

type NoPhantomUserId<TState> = "userId" extends keyof TState
  ? never
  : { readonly userId?: never };

const marker = defineMiddleware(async (_ctx, next) => {
  const response = await next();
  return {
    ...response,
    header: { ...response.header, "x-marker": "applied" },
  };
});

const middlewareThatReturnsPath = defineMiddleware(async (ctx, _next) => ({
  statusCode: 200,
  header: { "x-request-path": ctx.request.path },
  body: { path: ctx.request.path },
}));

const requiresUserMiddleware = defineMiddleware<{}, { userId: string }>(
  async (ctx, _next) => ({
    statusCode: 200,
    body: { userId: ctx.state.get("userId") },
  })
);

const finalHandler = async () => ({ statusCode: 200, body: { ok: true } });

const finalHandlerShouldNotRun = async () => ({
  statusCode: 500,
  body: { error: "final handler used" },
});

async function executeScopedMiddleware(
  middleware: TypedMiddleware<{}, {}>,
  path: string
): Promise<IHttpResponse> {
  const ctx = createServerContext({ path });

  return executeMiddlewarePipeline([middleware.handler], ctx, finalHandler);
}

async function executeMiddlewareAfterTraceState(
  middleware: TypedMiddleware<{}, {}>,
  path: string
): Promise<IHttpResponse> {
  const ctx = createServerContext({ path });
  const upstream = defineMiddleware<{ traceId: string }>(async (_ctx, next) =>
    next({ traceId: "trace_1" })
  );

  return executeMiddlewarePipeline(
    [upstream.handler, middleware.handler],
    ctx,
    async () => ({
      statusCode: 200,
      body: {
        traceId: ctx.state.get("traceId"),
        path: ctx.request.path,
      },
    })
  );
}

function expectMarkerApplied(response: IHttpResponse): void {
  expect(response.header?.["x-marker"]).toBe("applied");
}

function expectMarkerSkipped(response: IHttpResponse): void {
  expect(response.header?.["x-marker"]).toBeUndefined();
}

describe("scoped middleware", () => {
  test("applies middleware when the path matches exactly", async () => {
    const mw = scoped(["/api/users"], marker);

    const response = await executeScopedMiddleware(mw, "/api/users");

    expectMarkerApplied(response);
  });

  test.each([
    { case: "trailing slash", path: "/api/users/" },
    { case: "duplicate slash", path: "/api//users" },
  ])(
    "applies exact scoped middleware to a canonical $case path",
    async ({ path }) => {
      const mw = scoped(["/api/users"], marker);

      const response = await executeScopedMiddleware(mw, path);

      expectMarkerApplied(response);
    }
  );

  test("skips middleware when the path does not match the scope", async () => {
    const mw = scoped(["/api/users"], marker);

    const response = await executeScopedMiddleware(mw, "/health");

    expectMarkerSkipped(response);
  });

  test("delegates to downstream handlers when scoped middleware is skipped", async () => {
    const mw = scoped(["/api/users"], marker);

    const response = await executeScopedMiddleware(mw, "/health");

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({ ok: true });
  });

  test("skipped scoped middleware preserves upstream state for downstream handlers", async () => {
    const mw = scoped(["/admin/*"], marker);

    const response = await executeMiddlewareAfterTraceState(mw, "/health");

    expectMarkerSkipped(response);
    expect(response.body).toEqual({ traceId: "trace_1", path: "/health" });
  });

  test("applied scoped middleware reads state provided by upstream middleware", async () => {
    const ctx = createServerContext({ path: "/api/users" });
    const upstream = defineMiddleware<{ userId: string }>(async (_ctx, next) =>
      next({ userId: "u_1" })
    );
    const mw = scoped(["/api/*"], requiresUserMiddleware);

    const response = await executeMiddlewarePipeline(
      [upstream.handler, mw.handler],
      ctx,
      finalHandlerShouldNotRun
    );

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({ userId: "u_1" });
  });

  test.each([
    { case: "exact prefix", path: "/api" },
    { case: "direct child", path: "/api/users" },
    { case: "nested child", path: "/api/users/123" },
  ])("applies wildcard scoped middleware to the $case", async ({ path }) => {
    const mw = scoped(["/api/*"], marker);

    const response = await executeScopedMiddleware(mw, path);

    expectMarkerApplied(response);
  });

  test("applies wildcard scoped middleware to canonical equivalent child paths", async () => {
    const mw = scoped(["/api/*"], marker);

    const response = await executeScopedMiddleware(mw, "/api//users/123/");

    expectMarkerApplied(response);
  });

  test("does not apply wildcard scoped middleware to unrooted request paths", async () => {
    const mw = scoped(["/api/*"], marker);

    const response = await executeScopedMiddleware(mw, "api/users");

    expectMarkerSkipped(response);
    expect(response.body).toEqual({ ok: true });
  });

  test("applies parameterized scoped middleware to one matching segment", async () => {
    const mw = scoped(["/users/:id"], marker);

    const response = await executeScopedMiddleware(mw, "/users/42");

    expectMarkerApplied(response);
  });

  test("rejects parameterized scoped middleware matches with extra segments", async () => {
    const mw = scoped(["/users/:id"], marker);

    const response = await executeScopedMiddleware(mw, "/users/42/posts");

    expectMarkerSkipped(response);
    expect(response.body).toEqual({ ok: true });
  });

  test("applies middleware when any scoped pattern matches", async () => {
    const mw = scoped(["/api/*", "/admin/*"], marker);

    const response = await executeScopedMiddleware(mw, "/admin/dashboard");

    expectMarkerApplied(response);
  });

  test("returns the wrapped middleware response when it short-circuits", async () => {
    const guard = defineMiddleware(async (_ctx, _next) => ({
      statusCode: 403,
      body: { code: "FORBIDDEN", message: "Nope" },
    }));
    const mw = scoped(["/secret/*"], guard);

    const response = await executeScopedMiddleware(mw, "/secret/data");

    expect(response.statusCode).toBe(403);
    expect(response.body).toEqual({ code: "FORBIDDEN", message: "Nope" });
  });

  test("passes the original request context to wrapped middleware", async () => {
    const mw = scoped(["/api/*"], middlewareThatReturnsPath);

    const response = await executeScopedMiddleware(mw, "/api/users");

    expect(response.header?.["x-request-path"]).toBe("/api/users");
    expect(response.body).toEqual({ path: "/api/users" });
  });

  test.each([
    { case: "root path", path: "/" },
    { case: "API path", path: "/api/users" },
    { case: "health path", path: "/health" },
  ])(
    "skips middleware for every $case when scoped paths are empty",
    async ({ path }) => {
      const mw = scoped([], marker);

      const response = await executeScopedMiddleware(mw, path);

      expectMarkerSkipped(response);
      expect(response.statusCode).toBe(200);
      expect(response.body).toEqual({ ok: true });
    }
  );
});

describe("excluded middleware", () => {
  test("applies middleware when the path does not match an exclusion", async () => {
    const mw = except(["/health"], marker);

    const response = await executeScopedMiddleware(mw, "/api/users");

    expectMarkerApplied(response);
  });

  test("skips middleware when the path matches an exact exclusion", async () => {
    const mw = except(["/health"], marker);

    const response = await executeScopedMiddleware(mw, "/health");

    expectMarkerSkipped(response);
  });

  test.each([
    { case: "trailing slash", path: "/health/" },
    { case: "duplicate slash", path: "/health//" },
  ])(
    "skips middleware for a canonical exact $case exclusion",
    async ({ path }) => {
      const mw = except(["/health"], marker);

      const response = await executeScopedMiddleware(mw, path);

      expectMarkerSkipped(response);
      expect(response.body).toEqual({ ok: true });
    }
  );

  test("skips middleware when any excluded pattern matches", async () => {
    const mw = except(["/health", "/ready"], marker);

    const response = await executeScopedMiddleware(mw, "/ready");

    expectMarkerSkipped(response);
  });

  test("skips middleware for wildcard exclusions", async () => {
    const mw = except(["/internal/*"], marker);

    const response = await executeScopedMiddleware(mw, "/internal/metrics");

    expectMarkerSkipped(response);
  });

  test("applies middleware on non-excluded wildcard paths", async () => {
    const mw = except(["/internal/*"], marker);

    const response = await executeScopedMiddleware(mw, "/api/data");

    expectMarkerApplied(response);
  });

  test("skips middleware for parameterized exclusions", async () => {
    const mw = except(["/users/:id/debug"], marker);

    const response = await executeScopedMiddleware(mw, "/users/42/debug");

    expectMarkerSkipped(response);
  });

  test("executes downstream handlers when middleware is excluded", async () => {
    const mw = except(["/health"], marker);

    const response = await executeScopedMiddleware(mw, "/health");

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({ ok: true });
  });

  test("excluded middleware preserves upstream state for downstream handlers", async () => {
    const mw = except(["/health"], marker);

    const response = await executeMiddlewareAfterTraceState(mw, "/health");

    expectMarkerSkipped(response);
    expect(response.body).toEqual({ traceId: "trace_1", path: "/health" });
  });

  test("passes the original request context to wrapped middleware when not excluded", async () => {
    const mw = except(["/health"], middlewareThatReturnsPath);

    const response = await executeScopedMiddleware(mw, "/api/users");

    expect(response.header?.["x-request-path"]).toBe("/api/users");
    expect(response.body).toEqual({ path: "/api/users" });
  });

  test("applied excluded middleware reads state provided by upstream middleware", async () => {
    const ctx = createServerContext({ path: "/api/users" });
    const upstream = defineMiddleware<{ userId: string }>(async (_ctx, next) =>
      next({ userId: "u_1" })
    );
    const mw = except(["/health"], requiresUserMiddleware);

    const response = await executeMiddlewarePipeline(
      [upstream.handler, mw.handler],
      ctx,
      finalHandlerShouldNotRun
    );

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({ userId: "u_1" });
  });

  test.each([
    { case: "root path", path: "/" },
    { case: "API path", path: "/api/users" },
    { case: "health path", path: "/health" },
  ])(
    "applies middleware for every $case when excluded paths are empty",
    async ({ path }) => {
      const mw = except([], marker);

      const response = await executeScopedMiddleware(mw, path);

      expectMarkerApplied(response);
    }
  );
});

describe("scoped and excluded middleware type-level safety checked by TypeScript", () => {
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
