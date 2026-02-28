# 🎯 Scoped / Except

Path-based middleware filtering. `scoped` runs a middleware only on matching paths; `except` runs it
on all paths _except_ matching ones.

---

## 📥 Import

```ts
import { scoped, except } from "@rexeus/typeweaver-server";
```

## 🚀 Usage

```ts
import { cors, logger, scoped, except } from "@rexeus/typeweaver-server";

const app = new TypeweaverApp()
  .use(scoped(["/api/*"], cors({ origin: "https://app.example.com" })))
  .use(except(["/health", "/ready"], logger()))
  .route(new UserRouter({ requestHandlers }));
```

## 🔧 API

**`scoped(paths, middleware)`**

Runs `middleware` only when the request path matches at least one of the given patterns.
Non-matching requests skip straight to `next()`.

**`except(paths, middleware)`**

Runs `middleware` on all paths _except_ those matching the given patterns. Matching requests skip
straight to `next()`.

## ⚙️ Pattern Syntax

Both functions use the same pattern syntax as `pathMatcher`:

| Pattern        | Matches                        | Example                         |
| -------------- | ------------------------------ | ------------------------------- |
| `"/users"`     | Exact match only               | `/users`                        |
| `"/api/*"`     | Any path starting with `/api/` | `/api/users`, `/api/orders/123` |
| `"/users/:id"` | Parameterized segment          | `/users/123`, `/users/abc`      |

## ⚠️ Type Constraint

Both functions only accept `TypedMiddleware<{}, {}>` — middleware that neither provides nor requires
state.

This is intentional: if a state-providing middleware were skipped on certain paths, downstream
consumers would see `undefined` state at runtime despite compile-time guarantees.

**For auth or other state-providing middleware**, handle path filtering inside the middleware itself
using `pathMatcher`:

```ts
import { defineMiddleware, pathMatcher } from "@rexeus/typeweaver-server";

const isPublic = pathMatcher("/health");

const auth = defineMiddleware<{ userId: string }>(async (ctx, next) => {
  if (isPublic(ctx.request.path)) return next({ userId: "anonymous" });
  // ... verify token ...
  return next({ userId });
});
```

## 💡 Examples

**CORS only on API routes**

```ts
app.use(scoped(["/api/*"], cors()));
```

**Logging everywhere except health checks**

```ts
app.use(except(["/health", "/ready"], logger()));
```

**Combine multiple patterns**

```ts
app.use(
  scoped(["/api/*", "/webhooks/*"], secureHeaders({ strictTransportSecurity: "max-age=31536000" }))
);
```

**Powered-By only on public routes**

```ts
app.use(except(["/internal/*"], poweredBy()));
```
