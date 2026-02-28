# 🌐 CORS

Cross-Origin Resource Sharing headers and preflight handling.

---

## 📥 Import

```ts
import { cors } from "@rexeus/typeweaver-server";
```

## 🚀 Usage

```ts
const app = new TypeweaverApp().use(cors()).route(new UserRouter({ requestHandlers }));
```

## ⚙️ Options

`CorsOptions`

- `origin`: Allowed origin(s) or a function that resolves per-request
  - Type: `string | string[] | ((origin: string) => string | undefined)`
  - Default: `"*"`
- `allowMethods`: Methods for `Access-Control-Allow-Methods`
  - Type: `string[]`
  - Default: `["GET", "HEAD", "PUT", "POST", "PATCH", "DELETE"]`
- `allowHeaders`: Headers for `Access-Control-Allow-Headers`
  - Type: `string[]`
  - Default: mirrors the request's `Access-Control-Request-Headers`
- `exposeHeaders`: Headers the browser may access via `Access-Control-Expose-Headers`
  - Type: `string[]`
- `maxAge`: Preflight cache duration in seconds (`Access-Control-Max-Age`)
  - Type: `number`
- `credentials`: Set `Access-Control-Allow-Credentials: true`
  - Type: `boolean`
  - Default: `false`

## 🔧 Preflight Handling

The middleware automatically responds to preflight `OPTIONS` requests with `204 No Content` and the
appropriate CORS headers. Non-preflight requests pass through to downstream handlers with CORS
headers appended to the response.

When `credentials` is `true` and the request includes an `Origin` header, the response reflects the
exact origin instead of `*` — as required by the spec. A `Vary: Origin` header is added whenever the
response origin is not `*`.

## 💡 Examples

**Wildcard (default)**

```ts
app.use(cors());
```

**Specific origin**

```ts
app.use(cors({ origin: "https://app.example.com" }));
```

**Multiple origins**

```ts
app.use(cors({ origin: ["https://app.example.com", "https://admin.example.com"] }));
```

**Function-based origin**

```ts
app.use(
  cors({
    origin: origin => (origin.endsWith(".example.com") ? origin : undefined),
  })
);
```

**With credentials**

```ts
app.use(
  cors({
    origin: "https://app.example.com",
    credentials: true,
    maxAge: 86400,
  })
);
```

## 🎯 Scoped Usage

Limit CORS to specific paths with [`scoped`](scoped.md):

```ts
import { cors, scoped } from "@rexeus/typeweaver-server";

app.use(scoped(["/api/*"], cors({ origin: "https://app.example.com" })));
```

See [Scoped / Except](scoped.md) for pattern syntax and details.
