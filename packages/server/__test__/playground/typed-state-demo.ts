/**
 * Type-Safe State Playground
 *
 * Open this file in your IDE and hover over variables to see the types.
 * Try uncommenting the lines marked "UNCOMMENT TO SEE ERROR" to see
 * compile-time errors with clear messages.
 *
 * This is NOT a test file — it's a hands-on demo of the type system.
 */

import { StateMap } from "../../src/lib/StateMap";
import { defineMiddleware } from "../../src/lib/TypedMiddleware";
import { TypeweaverApp } from "../../src/lib/TypeweaverApp";
import type { ServerContext } from "../../src/lib/ServerContext";
import type { InferState } from "../../src/lib/TypedMiddleware";

// ─────────────────────────────────────────────────────────────────────────────
// 1. DEFINE TYPED MIDDLEWARE — state is passed through next()
// ─────────────────────────────────────────────────────────────────────────────

// Auth middleware — provides { userId: string }, requires nothing
const auth = defineMiddleware<{ userId: string }>(async (ctx, next) => {
  const token = ctx.request.header?.["authorization"];
  return next({ userId: token?.toString() ?? "anonymous" });
  //           ↑ MUST pass { userId: string } — enforced by NextFn<{ userId: string }>
});

// Permissions middleware — provides { permissions: string[] }, requires { userId: string }
const permissions = defineMiddleware<
  { permissions: string[] },
  { userId: string }
>(async (ctx, next) => {
  const userId = ctx.state.get("userId");
  //    ↑ Hover: string — no | undefined! State is guaranteed by upstream auth middleware
  return next({ permissions: [`read:${userId}`, "write"] });
});

// Tenant middleware — provides { tenantId: string }, requires nothing
const tenant = defineMiddleware<{ tenantId: string }>(async (_ctx, next) => {
  return next({ tenantId: "tenant_acme" });
});

// Pass-through middleware — provides nothing, next() takes no args
const logger = defineMiddleware(async (ctx, next) => {
  console.log(ctx.request.path);
  return next();
  //     ↑ No argument needed — NextFn<{}> = () => Promise<IHttpResponse>
});

// Short-circuiting guard — can return early without calling next()
const guard = defineMiddleware<{ userId: string }>(async (ctx, next) => {
  if (!ctx.request.header?.["authorization"]) {
    return { statusCode: 401, body: { message: "Unauthorized" } };
    //       ↑ Early return — no next() call, no state enforcement
  }
  return next({ userId: "u_verified" });
});

// UNCOMMENT TO SEE ERROR — forgetting to pass state to next():
// defineMiddleware<{ userId: string }>(async (_ctx, next) => next());
//                                                           ↑ Expected 1 argument, but got 0

// ─────────────────────────────────────────────────────────────────────────────
// 2. BUILD APP — TYPES ACCUMULATE
// ─────────────────────────────────────────────────────────────────────────────

const app = new TypeweaverApp()
  //              ↑ Hover: TypeweaverApp<{}>
  .use(auth)
  //  ↑ Hover: TypeweaverApp<{} & { userId: string }>
  .use(permissions)
  //  ↑ Hover: TypeweaverApp<{} & { userId: string } & { permissions: string[] }>
  .use(tenant);
//  ↑ Hover: TypeweaverApp<... & { tenantId: string }>

// ─────────────────────────────────────────────────────────────────────────────
// 3. EXTRACT STATE TYPE
// ─────────────────────────────────────────────────────────────────────────────

type AppState = InferState<typeof app>;
//                ↑ Hover: { userId: string } & { permissions: string[] } & { tenantId: string }

// Verify: you can create a value matching AppState
const _stateCheck: AppState = {
  userId: "u_1",
  permissions: ["read"],
  tenantId: "t_1",
};

// ─────────────────────────────────────────────────────────────────────────────
// 4. TYPED STATE MAP — autocomplete and type checking
// ─────────────────────────────────────────────────────────────────────────────

const state = new StateMap<AppState>();

state.set("userId", "u_42"); // ✅ key exists, value is string
state.set("permissions", ["read"]); // ✅ key exists, value is string[]

// UNCOMMENT TO SEE ERROR — wrong value type:
// state.set("userId", 123);
//                      ↑ Argument of type 'number' is not assignable to parameter of type 'string'

// UNCOMMENT TO SEE ERROR — nonexistent key:
// state.set("nonExistent", "value");
//           ↑ Argument of type '"nonExistent"' is not assignable to parameter of type '"userId" | "permissions" | "tenantId"'

const userId = state.get("userId");
//    ↑ Hover: string — no | undefined, state is provably set via next(state) enforcement

const perms = state.get("permissions");
//    ↑ Hover: string[]

// UNCOMMENT TO SEE ERROR — typo in key:
// state.get("userID");
//           ↑ Argument of type '"userID"' is not assignable to parameter of type '"userId" | "permissions" | "tenantId"'

// ─────────────────────────────────────────────────────────────────────────────
// 5. TYPED HANDLER CONTEXT
// ─────────────────────────────────────────────────────────────────────────────

async function exampleHandler(_req: any, ctx: ServerContext<AppState>) {
  const userId = ctx.state.get("userId");
  //    ↑ Hover: string

  const perms = ctx.state.get("permissions");
  //    ↑ Hover: string[]

  const tenantId = ctx.state.get("tenantId");
  //    ↑ Hover: string

  // UNCOMMENT TO SEE ERROR — key doesn't exist:
  // ctx.state.get("typo");

  return { statusCode: 200, body: { userId, perms, tenantId } };
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. WRONG MIDDLEWARE ORDER — COMPILE ERROR
// ─────────────────────────────────────────────────────────────────────────────

// UNCOMMENT TO SEE THE MAGIC — permissions requires userId, but auth hasn't run yet:
//
// const wrongApp = new TypeweaverApp()
//   .use(permissions) // ← ERROR: StateRequirementError — missing: "userId"
//   .use(auth);
//
// The error message shows:
//   Type 'TypedMiddleware<{ permissions: string[] }, { userId: string }>'
//   is not assignable to type 'StateRequirementError<{ userId: string }, {}>'
//   with property 'missing: "userId"'

// ─────────────────────────────────────────────────────────────────────────────
// Suppress unused variable warnings
void _stateCheck;
void userId;
void perms;
void exampleHandler;
void app;
void logger;
void guard;
