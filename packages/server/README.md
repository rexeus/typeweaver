# 🧵✨ @rexeus/typeweaver-server

[![npm version](https://img.shields.io/npm/v/@rexeus/typeweaver-server.svg)](https://www.npmjs.com/package/@rexeus/typeweaver-server)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)

Typeweaver is a type-safe HTTP API framework built for API-first development with a focus on
developer experience. Use typeweaver to specify your HTTP APIs in TypeScript and Zod, and generate
clients, validators, routers, and more ✨

## 📝 Server Plugin

This plugin generates a **lightweight, dependency-free server** with built-in routing and middleware
from your typeweaver API definitions. No external framework required — everything runs on the
standard Fetch API (`Request`/`Response`).

For each resource, it produces a `<ResourceName>Router` class that registers routes, validates
requests, and wires your handler methods with full type safety. Mount routers on the provided
`TypeweaverApp` to get a complete server with middleware support.

> Choose this plugin for a zero-dependency, Fetch API-native server. For Hono framework integration,
> see [@rexeus/typeweaver-hono](../hono/README.md).

### Key Features

- **Zero runtime dependencies** — no Hono, Express, or Fastify required
- **Fetch API compatible** — works with Bun, Deno, Cloudflare Workers, and Node.js (>=18)
- **High-performance radix tree router** — O(d) lookup where d = number of path segments
- **Return-based middleware** — clean onion model without shared mutable state
- **Automatic HEAD handling** — falls back to GET handlers per HTTP spec
- **405 Method Not Allowed** — with proper `Allow` header

---

## 📥 Installation

```bash
# Install the CLI and the plugin as a dev dependency
npm install -D @rexeus/typeweaver @rexeus/typeweaver-server

# Install the runtime as a dependency
npm install @rexeus/typeweaver-core
```

## 💡 How to use

```bash
npx typeweaver generate --input ./api/definition --output ./api/generated --plugins server
```

More on the CLI in
[@rexeus/typeweaver](https://github.com/rexeus/typeweaver/tree/main/packages/cli/README.md#️-cli).

## 📂 Generated Output

For a resource `User`, the plugin generates:

```
generated/
  lib/server/              ← TypeweaverApp, middleware types, etc.
  user/
    UserRouter.ts          ← Router class + UserApiHandler type
    GetUserRequest.ts      ← Request types (IGetUserRequest)
    GetUserResponse.ts     ← Response types + factory classes
    ...
```

Import `TypeweaverApp`, routers, and types from `./generated`.

## 🚀 Usage

### Implement handlers

Each handler receives the typed request and returns a typed response — plain objects with
`statusCode`, `header`, and `body`. Content-Type is auto-set to `application/json` for object
bodies.

```ts
// user-handlers.ts
import { HttpStatusCode } from "@rexeus/typeweaver-core";
import type { UserApiHandler } from "./generated";

export const userHandlers: UserApiHandler = {
  async handleListUsersRequest() {
    return {
      statusCode: HttpStatusCode.OK,
      body: [{ id: "1", name: "Jane", email: "jane@example.com" }],
    };
  },

  async handleCreateUserRequest(request) {
    return {
      statusCode: HttpStatusCode.CREATED,
      body: { id: "1", name: request.body.name, email: request.body.email },
    };
  },

  async handleGetUserRequest(request) {
    return {
      statusCode: HttpStatusCode.OK,
      body: { id: request.param.userId, name: "Jane", email: "jane@example.com" },
    };
  },

  async handleDeleteUserRequest() {
    return { statusCode: HttpStatusCode.NO_CONTENT };
  },
};
```

> Generated response classes (e.g. `GetUserSuccessResponse`) are also available for when you need
> runtime type checks or `instanceof` discrimination in error handling.

### Create the app

```ts
// server.ts
import { TypeweaverApp, UserRouter } from "./generated";
import { userHandlers } from "./user-handlers";

const app = new TypeweaverApp();
app.route(new UserRouter({ requestHandlers: userHandlers }));

export default app;
```

### Start the server

**Bun**

```ts
import app from "./server";

Bun.serve({ fetch: app.fetch, port: 3000 });
```

**Deno**

```ts
import app from "./server.ts";

Deno.serve({ port: 3000 }, app.fetch);
```

**Node.js**

Node.js requires converting between `http.IncomingMessage` and Fetch API `Request`:

```ts
import { createServer } from "node:http";
import app from "./server";

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
  const body = await new Promise<string>(resolve => {
    let data = "";
    req.on("data", chunk => (data += chunk));
    req.on("end", () => resolve(data));
  });
  const request = new Request(url, {
    method: req.method,
    headers: req.headers as HeadersInit,
    body: ["GET", "HEAD"].includes(req.method!) ? undefined : body,
  });
  const response = await app.fetch(request);
  res.writeHead(response.status, Object.fromEntries(response.headers));
  res.end(await response.text());
});
server.listen(3000);
```

### Multiple routers

```ts
app.route(new UserRouter({ requestHandlers: userHandlers }));
app.route("/api/v1", new OrderRouter({ requestHandlers: orderHandlers }));
```

### 🔗 Middleware

Middleware follows a return-based onion model. Each middleware receives `ServerContext` and a
`next()` function. Call `next()` to pass control downstream — or return early to short-circuit.

**Logging**

```ts
app.use(async (ctx, next) => {
  const start = Date.now();
  const response = await next();
  console.log(
    `${ctx.request.method} ${ctx.request.path} -> ${response.statusCode} (${Date.now() - start}ms)`
  );
  return response;
});
```

**Auth guard** (path-scoped, short-circuit)

```ts
app.use("/users/*", async (ctx, next) => {
  if (!ctx.request.header?.["authorization"]) {
    return { statusCode: 401, body: { message: "Unauthorized" } };
  }
  return next();
});
```

**State passing** — share data between middleware and handlers via `ctx.state`:

```ts
// In middleware
app.use(async (ctx, next) => {
  const token = ctx.request.header?.["authorization"];
  ctx.state.set("userId", parseToken(token));
  return next();
});

// In handler
async handleGetUserRequest(request, ctx) {
  const userId = ctx.state.get("userId") as string;
  // ...
}
```

Middleware runs for **all** requests, including 404s and 405s, so global concerns like logging and
CORS always execute.

### 🛠️ App Options

`TypeweaverApp` accepts an optional options object:

| Option        | Type                       | Default            | Description                                                 |
| ------------- | -------------------------- | ------------------ | ----------------------------------------------------------- |
| `maxBodySize` | `number`                   | `1_048_576` (1 MB) | Max request body size in bytes. Exceeding returns `413`.    |
| `onError`     | `(error: unknown) => void` | `console.error`    | Error callback. Falls back to `console.error` if it throws. |

```ts
const app = new TypeweaverApp({
  maxBodySize: 5 * 1024 * 1024, // 5 MB
  onError: error => logger.error("Unhandled error", error),
});
```

### ⚙️ Configuration

Each router accepts `TypeweaverRouterOptions`:

| Option                     | Type                   | Default    | Description                        |
| -------------------------- | ---------------------- | ---------- | ---------------------------------- |
| `requestHandlers`          | `<Resource>ApiHandler` | _required_ | Handler methods for each operation |
| `validateRequests`         | `boolean`              | `true`     | Enable/disable request validation  |
| `handleValidationErrors`   | `boolean \| function`  | `true`     | Handle validation errors           |
| `handleHttpResponseErrors` | `boolean \| function`  | `true`     | Handle thrown `HttpResponse`       |
| `handleUnknownErrors`      | `boolean \| function`  | `true`     | Handle unexpected errors           |

When set to `true`, error handlers use sensible defaults (400/500 responses). When set to `false`,
errors fall through to the next handler in the chain. When set to a function, it receives
`(error, ctx)` and must return an `IHttpResponse`:

```ts
new UserRouter({
  requestHandlers: userHandlers,
  handleValidationErrors: (error, ctx) => ({
    statusCode: 400,
    body: { message: "Validation failed", details: error.message },
  }),
});
```

### 📋 Error Responses

| Status | Code                    | When                                                          |
| ------ | ----------------------- | ------------------------------------------------------------- |
| `400`  | `BAD_REQUEST`           | Malformed request body                                        |
| `400`  | Validation issues       | `handleValidationErrors: true` and request fails validation   |
| `404`  | `NOT_FOUND`             | No matching route                                             |
| `405`  | `METHOD_NOT_ALLOWED`    | Route exists but method not allowed (includes `Allow` header) |
| `413`  | `PAYLOAD_TOO_LARGE`     | Request body exceeds `maxBodySize`                            |
| `500`  | `INTERNAL_SERVER_ERROR` | Unhandled error in handler                                    |

All error responses follow the shape: `{ code: string, message: string }`.

## 📄 License

Apache 2.0 © Dennis Wentzien 2026
