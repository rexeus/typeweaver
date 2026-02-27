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
// 1. DEFINE TYPED MIDDLEWARE
// ─────────────────────────────────────────────────────────────────────────────

// Auth middleware — provides { userId: string }, requires nothing
const auth = defineMiddleware<{ userId: string }>(async (ctx, next) => {
  const token = ctx.request.header?.["authorization"];
  ctx.state.set("userId", token?.toString() ?? "anonymous");
  //                ↑ Hover: only accepts "userId" as key, only accepts string as value
  return next();
});

// Permissions middleware — provides { permissions: string[] }, requires { userId: string }
const permissions = defineMiddleware<
  { permissions: string[] },
  { userId: string }
>(async (ctx, next) => {
  const userId = ctx.state.get("userId");
  //                              ↑ Hover: string | undefined — typed!
  ctx.state.set("permissions", [`read:${userId}`, "write"]);
  return next();
});

// Tenant middleware — provides { tenantId: string }, requires nothing
const tenant = defineMiddleware<{ tenantId: string }>(async (ctx, next) => {
  ctx.state.set("tenantId", "tenant_acme");
  return next();
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. BUILD APP — TYPES ACCUMULATE
// ─────────────────────────────────────────────────────────────────────────────

const app = new TypeweaverApp()
  //              ↑ Hover: TypeweaverApp<Record<string, unknown>>
  .use(auth)
  //  ↑ Hover: TypeweaverApp<Record<string, unknown> & { userId: string }>
  .use(permissions)
  //  ↑ Hover: TypeweaverApp<Record<string, unknown> & { userId: string } & { permissions: string[] }>
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
//    ↑ Hover: string | undefined — honest typing

const perms = state.get("permissions");
//    ↑ Hover: string[] | undefined

// UNCOMMENT TO SEE ERROR — typo in key:
// state.get("userID");
//           ↑ Argument of type '"userID"' is not assignable to parameter of type '"userId" | "permissions" | "tenantId"'

// ─────────────────────────────────────────────────────────────────────────────
// 5. TYPED HANDLER CONTEXT
// ─────────────────────────────────────────────────────────────────────────────

async function exampleHandler(_req: any, ctx: ServerContext<AppState>) {
  const userId = ctx.state.get("userId");
  //    ↑ Hover: string | undefined

  const perms = ctx.state.get("permissions");
  //    ↑ Hover: string[] | undefined

  const tenantId = ctx.state.get("tenantId");
  //    ↑ Hover: string | undefined

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
//   is not assignable to type 'StateRequirementError<{ userId: string }, Record<string, unknown>>'
//   with property 'missing: "userId"'

// ─────────────────────────────────────────────────────────────────────────────
// 7. UNTYPED MIDDLEWARE STILL WORKS (backward compatible)
// ─────────────────────────────────────────────────────────────────────────────

const appWithMixed = new TypeweaverApp()
  .use(auth) // typed — accumulates
  .use(async (_ctx, next) => next()) // untyped — passes through, returns `this`
  .use("/admin/*", async (_ctx, next) => next()) // path-scoped — passes through, returns `this`
  .use(permissions); // typed — accumulates

// All three middleware styles coexist.

// ─────────────────────────────────────────────────────────────────────────────
// Suppress unused variable warnings
void _stateCheck;
void userId;
void perms;
void exampleHandler;
void app;
void appWithMixed;
