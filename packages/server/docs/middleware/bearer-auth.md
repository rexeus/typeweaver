# 🪪 Bearer Auth

HTTP Bearer Token Authentication. Extracts the token from the `Authorization` header, verifies it
via a user-supplied function, and provides the raw `token` as middleware state.

---

## 📥 Import

```ts
import { bearerAuth } from "@rexeus/typeweaver-server";
```

## 🚀 Usage

```ts
const app = new TypeweaverApp()
  .use(
    bearerAuth({
      verifyToken: async token => {
        const payload = await jwt.verify(token, secret);
        return payload !== null;
      },
    })
  )
  .route(new UserRouter({ requestHandlers }));
```

## ⚙️ Options

`BearerAuthOptions`

- `verifyToken` (**required**): Validates the extracted bearer token
  - Type: `(token: string, ctx: ServerContext) => boolean | Promise<boolean>`
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
  token: string;
}
```

Downstream middleware and handlers can access `ctx.state.get("token")`.

## 💡 Examples

**Simple token verification**

```ts
app.use(
  bearerAuth({
    verifyToken: token => validTokens.has(token),
  })
);
```

**Custom unauthorized response**

```ts
app.use(
  bearerAuth({
    verifyToken: verify,
    onUnauthorized: ctx => ({
      statusCode: 401,
      header: { "www-authenticate": 'Bearer realm="API"' },
      body: { code: "INVALID_TOKEN", message: "Token expired or invalid" },
    }),
  })
);
```

## 🎯 Scoped Usage

Because `bearerAuth` provides state (`{ token }`), it cannot be wrapped with `scoped()` directly.
Instead, handle path filtering inside the middleware using `pathMatcher`:

```ts
import { defineMiddleware, pathMatcher } from "@rexeus/typeweaver-server";

const isPublic = pathMatcher("/health");

const auth = defineMiddleware<{ token: string }>(async (ctx, next) => {
  if (isPublic(ctx.request.path)) return next({ token: "" });

  // ... verify bearer token ...
  return next({ token });
});
```

See [Scoped / Except](scoped.md) for why this constraint exists and alternative patterns.
