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
- **Type-safe middleware** — compile-time state guarantees via `defineMiddleware`, `StateMap`, and
  `InferState`
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
npx typeweaver generate --input ./api/spec/index.ts --output ./api/generated --plugins server
```

More on the CLI in
[@rexeus/typeweaver](https://github.com/rexeus/typeweaver/tree/main/packages/cli/README.md#️-cli).

## 📂 Generated Output

For a resource `User`, the plugin generates:

```
generated/
  lib/server/              ← TypeweaverApp, middleware types, etc.
  user/
    UserRouter.ts          ← Router class + ServerUserApiHandler type
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
import type { ServerUserApiHandler } from "./generated";

export const userHandlers: ServerUserApiHandler = {
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
      body: {
        id: request.param.userId,
        name: "Jane",
        email: "jane@example.com",
      },
    };
  },

  async handleDeleteUserRequest() {
    return { statusCode: HttpStatusCode.NO_CONTENT };
  },
};
```

> Generated response factory functions (e.g. `createGetUserSuccessResponse`) are also available for
> constructing typed responses with pre-set `type` and `statusCode` discriminators.

### Create the app

```ts
// server.ts
import { TypeweaverApp, UserRouter } from "./generated";
import { userHandlers } from "./user-handlers";

const app = new TypeweaverApp();
app.route(new UserRouter({ requestHandlers: userHandlers }));

export { app };
```

### Start the server

**Bun**

```ts
import { app } from "./server";

Bun.serve({ fetch: app.fetch, port: 3000 });
```

**Deno**

```ts
import { app } from "./server.ts";

Deno.serve({ port: 3000 }, app.fetch);
```

**Node.js**

```ts
import { createServer } from "node:http";
import { nodeAdapter } from "./generated/lib/server";
import { app } from "./server";

createServer(nodeAdapter(app)).listen(3000);
```

### Multiple routers

```ts
app.route(new UserRouter({ requestHandlers: userHandlers }));
app.route("/api/v1", new OrderRouter({ requestHandlers: orderHandlers }));
```

### 🔗 Middleware

Middleware is defined with `defineMiddleware` and follows a return-based onion model. Each
middleware declares what state it **provides** downstream and what state it **requires** from
upstream — all checked at compile time.

**Providing state** — pass state to `next()`:

```ts
import { defineMiddleware } from "./generated/lib/server";

const auth = defineMiddleware<{ userId: string }>(async (ctx, next) => {
  const token = ctx.request.header?.["authorization"];
  return next({ userId: parseToken(token) });
});
```

When `TProvides` has keys, `next()` **requires** the state object as its argument — you can't forget
to provide it.

**Requiring upstream state** — declare dependencies:

```ts
const permissions = defineMiddleware<{ permissions: string[] }, { userId: string }>(
  async (ctx, next) => {
    const userId = ctx.state.get("userId"); // string — no cast, no undefined
    return next({ permissions: await loadPermissions(userId) });
  }
);
```

Registering `permissions` before `auth` produces a **compile-time error** because `userId` is not
yet available in the accumulated state.

**Pass-through middleware** — `next()` takes no arguments:

```ts
const logger = defineMiddleware(async (ctx, next) => {
  const start = Date.now();
  const response = await next();
  console.log(
    `${ctx.request.method} ${ctx.request.path} -> ${response.statusCode} (${Date.now() - start}ms)`
  );
  return response;
});
```

**Short-circuit** — return a response without calling `next()`:

```ts
const guard = defineMiddleware(async (ctx, next) => {
  if (!ctx.request.header?.["authorization"]) {
    return { statusCode: 401, body: { message: "Unauthorized" } };
  }
  return next();
});
```

**Path-scoped guard** — use `pathMatcher` to limit middleware to specific routes:

```ts
import { defineMiddleware, pathMatcher } from "./generated/lib/server";

const isUsersPath = pathMatcher("/users/*");

const usersGuard = defineMiddleware(async (ctx, next) => {
  if (!isUsersPath(ctx.request.path)) return next();
  if (!ctx.request.header?.["authorization"]) {
    return { statusCode: 401, body: { message: "Unauthorized" } };
  }
  return next();
});
```

`pathMatcher` supports exact matches (`"/health"`) and prefix matches (`"/users/*"`).

**Chaining** — state accumulates through `.use()`:

```ts
const app = new TypeweaverApp()
  .use(auth) // provides { userId: string }
  .use(permissions) // requires { userId }, provides { permissions: string[] }
  .route(new TodoRouter({ requestHandlers: todoHandlers }));
```

**`InferState`** — extract the accumulated state type for handlers:

```ts
import type { InferState } from "./generated/lib/server";

type AppState = InferState<typeof app>;
// { userId: string } & { permissions: string[] }
```

Middleware runs for **all** requests, including 404s and 405s, so global concerns like logging and
CORS always execute.

### 📦 Built-in Middleware

Ready-to-use middleware included with the server plugin.

| Middleware                                                                                                          | Description                          | State           |
| ------------------------------------------------------------------------------------------------------------------- | ------------------------------------ | --------------- |
| [`cors`](https://github.com/rexeus/typeweaver/blob/main/packages/server/docs/middleware/cors.md)                    | CORS headers & preflight handling    | —               |
| [`basicAuth`](https://github.com/rexeus/typeweaver/blob/main/packages/server/docs/middleware/basic-auth.md)         | HTTP Basic Authentication            | `{ username }`  |
| [`bearerAuth`](https://github.com/rexeus/typeweaver/blob/main/packages/server/docs/middleware/bearer-auth.md)       | HTTP Bearer Token Authentication     | `{ token }`     |
| [`logger`](https://github.com/rexeus/typeweaver/blob/main/packages/server/docs/middleware/logger.md)                | Request/response logging with timing | —               |
| [`secureHeaders`](https://github.com/rexeus/typeweaver/blob/main/packages/server/docs/middleware/secure-headers.md) | OWASP security headers               | —               |
| [`requestId`](https://github.com/rexeus/typeweaver/blob/main/packages/server/docs/middleware/request-id.md)         | Request ID generation & propagation  | `{ requestId }` |
| [`poweredBy`](https://github.com/rexeus/typeweaver/blob/main/packages/server/docs/middleware/powered-by.md)         | `X-Powered-By` header                | —               |
| [`scoped` / `except`](https://github.com/rexeus/typeweaver/blob/main/packages/server/docs/middleware/scoped.md)     | Path-based middleware filtering      | —               |

```ts
import { cors, logger, secureHeaders, bearerAuth, requestId } from "@rexeus/typeweaver-server";

const app = new TypeweaverApp()
  .use(cors())
  .use(secureHeaders())
  .use(logger())
  .use(requestId())
  .use(bearerAuth({ verifyToken: verify }))
  .route(new UserRouter({ requestHandlers }));
```

Each middleware is documented in detail — click the links above.

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

### ⚙️ Router Configuration

Each router accepts `TypeweaverRouterOptions`:

| Option                           | Type                         | Default    | Description                        |
| -------------------------------- | ---------------------------- | ---------- | ---------------------------------- |
| `requestHandlers`                | `Server<Resource>ApiHandler` | _required_ | Handler methods for each operation |
| `validateRequests`               | `boolean`                    | `true`     | Enable/disable request validation  |
| `validateResponses`              | `boolean`                    | `true`     | Enable/disable response validation |
| `handleRequestValidationErrors`  | `boolean \| function`        | `true`     | Handle request validation errors   |
| `handleResponseValidationErrors` | `boolean \| function`        | `true`     | Handle response validation errors  |
| `handleHttpResponseErrors`       | `boolean \| function`        | `true`     | Handle thrown typed HTTP responses |
| `handleUnknownErrors`            | `boolean \| function`        | `true`     | Handle unexpected errors           |

When set to `true`, error handlers use sensible defaults (400/500 responses). When set to `false`,
errors fall through to the next handler in the chain (except `handleResponseValidationErrors`, where
`false` means the invalid response is returned as-is — validation still runs for field stripping,
but invalid responses pass through unchanged). When set to a function, it receives the error and
`ServerContext` and must return an `IHttpResponse`. If a custom error handler throws, the framework
catches the exception and falls through gracefully to the next handler.

### 🚨 Error Handling

#### Throwing errors in handlers

Throw any object matching `ITypedHttpResponse` (i.e. `{ type: string, statusCode: number, ... }`)
from your handlers — the framework catches it automatically and returns it as the response:

```ts
import { HttpStatusCode } from "@rexeus/typeweaver-core";

async handleGetUserRequest(request) {
  const user = await db.findUser(request.param.userId);
  if (!user) {
    // Plain objects work — anything with `type` and `statusCode` is recognized
    throw {
      type: "NotFoundError",
      statusCode: HttpStatusCode.NOT_FOUND,
      header: { "Content-Type": "application/json" },
      body: { message: "Resource not found", code: "NOT_FOUND_ERROR" },
    };
  }
  return {
    type: "GetUserSuccess",
    statusCode: HttpStatusCode.OK,
    header: { "Content-Type": "application/json" },
    body: user,
  };
}
```

Generated factory functions (e.g. `createNotFoundErrorResponse`) are a convenient shorthand — they
set `type` and `statusCode` for you so you only pass `header` and `body`:

```ts
import { createNotFoundErrorResponse } from "./generated";

throw createNotFoundErrorResponse({
  header: { "Content-Type": "application/json" },
  body: { message: "Resource not found", code: "NOT_FOUND_ERROR" },
});
```

When `handleHttpResponseErrors` is `true` (the default), thrown typed HTTP responses
(`ITypedHttpResponse`) are returned as-is. No extra configuration needed.

#### Custom error mapping

Use custom handler functions to transform errors into your own response shape.

**Validation errors** — map framework validation errors to your spec-defined format:

```ts
new UserRouter({
  requestHandlers: userHandlers,
  handleRequestValidationErrors: (error, ctx) => ({
    type: "ValidationError",
    statusCode: HttpStatusCode.BAD_REQUEST,
    header: { "Content-Type": "application/json" },
    body: {
      code: "VALIDATION_ERROR",
      message: "Request is invalid",
      issues: {
        body: error.bodyIssues,
        query: error.queryIssues,
        param: error.pathParamIssues,
        header: error.headerIssues,
      },
    },
  }),
});
```

**HTTP response errors** — log thrown errors and pass them through:

```ts
new UserRouter({
  requestHandlers: userHandlers,
  handleHttpResponseErrors: (error, ctx) => {
    logger.warn("HTTP error", {
      status: error.statusCode,
      path: ctx.request.path,
    });
    return error;
  },
});
```

**Unknown errors** — catch unexpected failures and return a safe response:

```ts
new UserRouter({
  requestHandlers: userHandlers,
  handleUnknownErrors: (error, ctx) => {
    logger.error("Unhandled error", { error, path: ctx.request.path });
    return {
      type: "InternalServerError",
      statusCode: HttpStatusCode.INTERNAL_SERVER_ERROR,
      header: { "Content-Type": "application/json" },
      body: { code: "INTERNAL_SERVER_ERROR", message: "Something went wrong" },
    };
  },
});
```

### 📋 Error Responses

| Status | Code                    | When                                                                 |
| ------ | ----------------------- | -------------------------------------------------------------------- |
| `400`  | `BAD_REQUEST`           | Malformed request body                                               |
| `400`  | Validation issues       | `handleRequestValidationErrors: true` and request fails validation   |
| `404`  | `NOT_FOUND`             | No matching route                                                    |
| `405`  | `METHOD_NOT_ALLOWED`    | Route exists but method not allowed (includes `Allow` header)        |
| `413`  | `PAYLOAD_TOO_LARGE`     | Request body exceeds `maxBodySize`                                   |
| `500`  | `INTERNAL_SERVER_ERROR` | `handleResponseValidationErrors: true` and response fails validation |
| `500`  | `INTERNAL_SERVER_ERROR` | Unhandled error in handler                                           |

All error responses follow the shape: `{ code: string, message: string }`.

## 📄 License

Apache 2.0 © Dennis Wentzien 2026
