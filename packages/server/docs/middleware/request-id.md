# 🏷️ Request ID

Generates a unique request ID for every request and propagates it via a response header. If the
incoming request already carries the header, its value is reused instead of generating a new one.

---

## 📥 Import

```ts
import { requestId } from "@rexeus/typeweaver-server";
```

## 🚀 Usage

```ts
const app = new TypeweaverApp().use(requestId()).route(new UserRouter({ requestHandlers }));
```

## ⚙️ Options

`RequestIdOptions`

- `headerName`: Request/response header name used to read and write the ID
  - Type: `string`
  - Default: `"x-request-id"`
- `generator`: ID generator function, called when no existing header is found
  - Type: `() => string`
  - Default: `crypto.randomUUID()`

## 🔒 State

The middleware provides:

```ts
{
  requestId: string;
}
```

Downstream middleware and handlers can access `ctx.state.get("requestId")`.

## 🔧 Behavior

1. If the incoming request contains the configured header, its value is reused as the request ID.
2. Otherwise, the `generator` function is called to produce a new ID.
3. The ID is set on the response via the same header and provided as state.

## 💡 Examples

**Default** — uses `X-Request-Id` and `crypto.randomUUID()`

```ts
app.use(requestId());
```

**Custom header name**

```ts
app.use(requestId({ headerName: "x-correlation-id" }));
```

**Custom generator**

```ts
import { nanoid } from "nanoid";

app.use(requestId({ generator: () => nanoid() }));
```

## 🎯 Scoped Usage

Because `requestId` provides state (`{ requestId }`), it cannot be wrapped with `scoped()` directly.
Instead, handle path filtering inside the middleware using `pathMatcher`:

```ts
import { defineMiddleware, pathMatcher } from "@rexeus/typeweaver-server";

const isInternal = pathMatcher("/internal/*");

const tracingId = defineMiddleware<{ requestId: string }>(async (ctx, next) => {
  const id = isInternal(ctx.request.path) ? "internal" : crypto.randomUUID();
  return next({ requestId: id });
});
```

See [Scoped / Except](scoped.md) for why this constraint exists and alternative patterns.
