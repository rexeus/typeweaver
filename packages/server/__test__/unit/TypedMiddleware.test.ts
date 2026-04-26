import { HttpMethod } from "@rexeus/typeweaver-core";
import type { IHttpRequest, IHttpResponse } from "@rexeus/typeweaver-core";
import { describe, expect, test } from "vitest";
import { StateMap } from "../../src/lib/StateMap.js";
import { defineMiddleware } from "../../src/lib/TypedMiddleware.js";
import { TypeweaverApp } from "../../src/lib/TypeweaverApp.js";
import { TypeweaverRouter } from "../../src/lib/TypeweaverRouter.js";
import {
  createServerContext,
  noopResponseValidator,
  noopValidator,
} from "../helpers.js";
import type { RequestHandler } from "../../src/lib/RequestHandler.js";
import type { InferState } from "../../src/lib/TypedMiddleware.js";
import type { TypeweaverRouterOptions } from "../../src/lib/TypeweaverRouter.js";

type AuthState = { readonly userId: string };
type PermissionsState = { readonly permissions: readonly string[] };
type AuthResponseBody = {
  readonly userId: string;
  readonly permissions?: readonly string[];
};
type StateEchoHandlers<TState extends AuthState> = {
  readonly handleGet: RequestHandler<IHttpRequest, IHttpResponse, TState>;
};

class StateEchoRouter<TState extends AuthState> extends TypeweaverRouter<
  StateEchoHandlers<TState>
> {
  public constructor(
    options: TypeweaverRouterOptions<StateEchoHandlers<TState>>
  ) {
    super(options);
    this.route(
      "getTest",
      HttpMethod.GET,
      "/test",
      noopValidator,
      noopResponseValidator,
      this.requestHandlers.handleGet
    );
  }
}

function createAppThatEchoesMiddlewareState<TState extends AuthState>(
  app: TypeweaverApp<TState>,
  handleGet: StateEchoHandlers<TState>["handleGet"]
): TypeweaverApp<TState> {
  return app.route(
    new StateEchoRouter<TState>({
      validateRequests: false,
      requestHandlers: { handleGet },
    })
  );
}

const echoAuthState: StateEchoHandlers<AuthState>["handleGet"] = async (
  _req,
  ctx
) => ({
  statusCode: 200,
  body: { userId: ctx.state.get("userId") },
});

const echoAuthAndPermissionsState: StateEchoHandlers<
  AuthState & PermissionsState
>["handleGet"] = async (_req, ctx) => ({
  statusCode: 200,
  body: {
    userId: ctx.state.get("userId"),
    permissions: ctx.state.get("permissions"),
  },
});

async function readAuthResponseBody(
  response: Response
): Promise<AuthResponseBody> {
  return (await response.json()) as AuthResponseBody;
}

describe("typed middleware", () => {
  describe("defineMiddleware", () => {
    test("creates a middleware descriptor with a callable handler", () => {
      const mw = defineMiddleware<{ userId: string }>(async (_ctx, next) =>
        next({ userId: "u_1" })
      );

      expect(typeof mw.handler).toBe("function");
    });

    test("passes provided state through next to downstream handlers", async () => {
      const mw = defineMiddleware<{ userId: string }>(async (_ctx, next) => {
        return next({ userId: "u_42" });
      });
      const ctx = createServerContext();

      const response = await mw.handler(ctx, async (state) => {
        if (state) ctx.state.merge(state);
        return {
          statusCode: 200,
          body: { userId: ctx.state.get("userId") },
        };
      });

      expect(response.body).toEqual({ userId: "u_42" });
    });

    test("allows pass-through middleware to call next without state", async () => {
      const mw = defineMiddleware(async (_ctx, next) => next());
      const ctx = createServerContext();

      const response = await mw.handler(ctx, async () => ({
        statusCode: 200,
        body: { reached: true },
      }));

      expect(response.body).toEqual({ reached: true });
    });
  });

  describe("TypeweaverApp typed middleware", () => {
    test("delivers middleware-provided state to mounted route handlers through fetch", async () => {
      const auth = defineMiddleware<AuthState>(async (_ctx, next) =>
        next({ userId: "u_runtime" })
      );
      const app = createAppThatEchoesMiddlewareState(
        new TypeweaverApp().use(auth),
        echoAuthState
      );

      const res = await app.fetch(new Request("http://localhost/test"));
      const data = await readAuthResponseBody(res);

      expect(res.status).toBe(200);
      expect(data).toEqual({ userId: "u_runtime" });
    });

    test("delivers state derived from upstream middleware to mounted route handlers", async () => {
      const auth = defineMiddleware<AuthState>(async (_ctx, next) =>
        next({ userId: "u_runtime" })
      );
      const permissions = defineMiddleware<PermissionsState, AuthState>(
        async (ctx, next) => {
          const userId = ctx.state.get("userId");
          return next({ permissions: [`read:${userId}`] });
        }
      );
      const app = createAppThatEchoesMiddlewareState(
        new TypeweaverApp().use(auth).use(permissions),
        echoAuthAndPermissionsState
      );

      const res = await app.fetch(new Request("http://localhost/test"));
      const data = await readAuthResponseBody(res);

      expect(res.status).toBe(200);
      expect(data).toEqual({
        userId: "u_runtime",
        permissions: ["read:u_runtime"],
      });
    });
  });

  describe("type-level safety checked by TypeScript", () => {
    test("typecheck rejects middleware whose required state is missing", () => {
      const permissions = defineMiddleware<
        { permissions: string[] },
        { userId: string }
      >(async (_ctx, next) => next({ permissions: [] }));

      // @ts-expect-error — userId is required before permissions can run.
      new TypeweaverApp().use(permissions);
    });

    test("typecheck accepts middleware whose required state is already available", () => {
      const auth = defineMiddleware<{ userId: string }>(async (_ctx, next) =>
        next({ userId: "u_1" })
      );
      const permissions = defineMiddleware<
        { permissions: string[] },
        { userId: string }
      >(async (_ctx, next) => next({ permissions: [] }));

      new TypeweaverApp().use(auth).use(permissions);
    });

    test("typecheck rejects access to unknown state keys", () => {
      const state = new StateMap<{ userId: string }>();

      // @ts-expect-error — nonExistent is not a key of the typed state.
      state.get("nonExistent");
    });

    test("typecheck rejects state values with the wrong type", () => {
      const state = new StateMap<{ userId: string }>();

      // @ts-expect-error — userId must be a string.
      state.set("userId", 123);
    });

    test("typecheck infers accumulated state from a typed app", () => {
      const auth = defineMiddleware<{ userId: string }>(async (_ctx, next) =>
        next({ userId: "test" })
      );
      const app = new TypeweaverApp().use(auth);

      type State = InferState<typeof app>;
      const inferredState: State = { userId: "test" };

      void inferredState;
    });

    test("typecheck requires next state when middleware declares provided keys", () => {
      // @ts-expect-error — next must receive the declared userId state.
      defineMiddleware<{ userId: string }>(async (_ctx, next) => next());
    });

    test("typecheck allows next without state for pass-through middleware", () => {
      const passThrough = defineMiddleware(async (_ctx, next) => next());

      void passThrough;
    });
  });
});
