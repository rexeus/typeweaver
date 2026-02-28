# 🔑 Basic Auth

HTTP Basic Authentication. Parses the `Authorization` header, verifies credentials via a
user-supplied function, and provides the authenticated `username` as middleware state.

---

## 📥 Import

```ts
import { basicAuth } from "@rexeus/typeweaver-server";
```

## 🚀 Usage

```ts
const app = new TypeweaverApp()
  .use(
    basicAuth({
      verifyCredentials: async (username, password) => {
        const user = await db.findByUsername(username);
        return user !== undefined && (await verify(user.hash, password));
      },
    })
  )
  .route(new UserRouter({ requestHandlers }));
```

## ⚙️ Options

`BasicAuthOptions`

- `verifyCredentials` (**required**): Validates the decoded credentials
  - Type: `(username: string, password: string, ctx: ServerContext) => boolean | Promise<boolean>`
- `realm`: Realm for the `WWW-Authenticate` header
  - Type: `string`
  - Default: `"Secure Area"`
- `unauthorizedMessage`: Message in the default 401 response body
  - Type: `string`
  - Default: `"Unauthorized"`
- `onUnauthorized`: Custom 401 response factory — overrides the default response entirely
  - Type: `(ctx: ServerContext) => IHttpResponse`

## 🔒 State

On successful authentication the middleware provides:

```ts
{
  username: string;
}
```

Downstream middleware and handlers can access `ctx.state.get("username")`.

## 💡 Examples

**Custom realm**

```ts
app.use(
  basicAuth({
    verifyCredentials: verify,
    realm: "Admin Panel",
  })
);
```

**Custom unauthorized response**

```ts
app.use(
  basicAuth({
    verifyCredentials: verify,
    onUnauthorized: ctx => ({
      statusCode: 401,
      header: { "www-authenticate": 'Basic realm="API"' },
      body: { code: "AUTH_REQUIRED", message: "Please authenticate" },
    }),
  })
);
```

## 🎯 Scoped Usage

Because `basicAuth` provides state (`{ username }`), it cannot be wrapped with `scoped()` directly.
Instead, handle path filtering inside the middleware using `pathMatcher`:

```ts
import { defineMiddleware, pathMatcher } from "@rexeus/typeweaver-server";

const isPublic = pathMatcher("/health");

const auth = defineMiddleware<{ username: string }>(async (ctx, next) => {
  if (isPublic(ctx.request.path)) return next({ username: "anonymous" });

  // ... verify credentials, extract username ...
  return next({ username });
});
```

See [Scoped / Except](scoped.md) for why this constraint exists and alternative patterns.
