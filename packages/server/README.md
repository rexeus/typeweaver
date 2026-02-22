# @rexeus/typeweaver-server

[![npm version](https://img.shields.io/npm/v/@rexeus/typeweaver-server.svg)](https://www.npmjs.com/package/@rexeus/typeweaver-server)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)

Typeweaver is a type-safe HTTP API framework built for API-first development with a focus on
developer experience. Use typeweaver to specify your HTTP APIs in TypeScript and Zod, and generate
clients, validators, routers, and more.

## Server Plugin

This plugin generates a **lightweight, dependency-free server** with built-in routing and middleware
from your typeweaver API definitions. No external framework required — everything runs on the
standard Fetch API (`Request`/`Response`).

For each resource, it produces a `<ResourceName>Router` class that registers routes, validates
requests, and wires your handler methods with full type safety. Mount routers on the provided
`TypeweaverApp` to get a complete server with middleware support.

### Key Features

- **Zero dependencies** — no Hono, Express, or Fastify required
- **Fetch API compatible** — works with Bun, Deno, Cloudflare Workers, and Node.js (>=18)
- **High-performance radix tree router** — O(d) lookup where d = number of path segments
- **Return-based middleware** — clean onion model without shared mutable state
- **Automatic HEAD handling** — falls back to GET handlers per HTTP spec
- **405 Method Not Allowed** — with proper `Allow` header

---

## Installation

```bash
# Install the CLI and the plugin as a dev dependency
npm install -D @rexeus/typeweaver @rexeus/typeweaver-server

# Install the runtime as a dependency
npm install @rexeus/typeweaver-core
```

## How to use

```bash
npx typeweaver generate --input ./api/definition --output ./api/generated --plugins server
```

More on the CLI in [@rexeus/typeweaver](https://github.com/rexeus/typeweaver/tree/main/packages/cli/README.md#️-cli).

## Generated Output

For each resource (e.g., `Todo`) this plugin generates a router class that handles routing and
request validation for all operations. Generated files are like `<ResourceName>Router.ts` — e.g.
`TodoRouter.ts`.

## Usage

Implement your handlers and mount the generated routers on a `TypeweaverApp`.

```ts
// api/user-handlers.ts
import { HttpStatusCode } from "@rexeus/typeweaver-core";
import type { IGetUserRequest, GetUserResponse } from "./generated";
import type { ServerContext } from "./generated/lib/server";

export const userHandlers = {
  async handleGetUserRequest(
    request: IGetUserRequest,
    ctx: ServerContext
  ): Promise<GetUserResponse> {
    // Access shared state from middleware
    const userId = ctx.state.get("userId") as string;

    return {
      statusCode: HttpStatusCode.OK,
      header: { "Content-Type": "application/json" },
      body: { id: request.param.userId, name: "Jane", email: "jane@example.com" },
    };
  },
  // Implement other operation handlers: handleCreateUserRequest, ...
};
```

```ts
// api/server.ts
import { TypeweaverApp } from "./generated/lib/server";
import { UserRouter } from "./generated";

const app = new TypeweaverApp();

// Global middleware
app.use(async (ctx, next) => {
  console.log(`${ctx.request.method} ${ctx.request.path}`);
  return next();
});

// Path-scoped middleware (short-circuit)
app.use("/users/*", async (ctx, next) => {
  const token = ctx.request.header?.["authorization"];
  if (!token) {
    return { statusCode: 401, body: { message: "Unauthorized" } };
  }
  return next();
});

// Mount the generated router
app.route(new UserRouter({
  requestHandlers: userHandlers,
  validateRequests: true,
  handleValidationErrors: true,
  handleHttpResponseErrors: true,
  handleUnknownErrors: true,
}));

// Optionally mount with a prefix
// app.route("/api/v1", new UserRouter({ requestHandlers: userHandlers }));

// Start — works with any Fetch API-compatible runtime
Bun.serve({ fetch: app.fetch, port: 3000 });
// Deno.serve({ port: 3000 }, app.fetch);
```

### Middleware

Middleware follows a return-based onion model. Each middleware receives the `ServerContext` and a
`next()` function. Call `next()` to pass control downstream and receive the response — or return
early to short-circuit the pipeline.

```ts
// Logging middleware
app.use(async (ctx, next) => {
  const start = Date.now();
  const response = await next();
  console.log(`${ctx.request.method} ${ctx.request.path} -> ${response.statusCode} (${Date.now() - start}ms)`);
  return response;
});

// Auth guard (short-circuit)
app.use("/admin/*", async (ctx, next) => {
  if (!ctx.request.header?.["authorization"]) {
    return { statusCode: 401, body: { message: "Unauthorized" } };
  }
  return next();
});
```

Middleware runs for **all** requests, including 404s and 405s, so global concerns like logging and
CORS always execute.

### Configuration

`TypeweaverRouterOptions<RequestHandlers>`

- `requestHandlers`: object implementing the generated `<ResourceName>ApiHandler` interface
- `validateRequests` (default: `true`): enable/disable request validation
- `handleValidationErrors`: `true` | `false` | `(err, ctx) => IHttpResponse`
  - If `true` (default), returns `400 Bad Request` with validation issues in the body
  - If `false`, lets the error propagate
  - If function, calls the function with the error and context, expects an `IHttpResponse` to
    return, so you can customize the response in the way you want
- `handleHttpResponseErrors`: `true` | `false` | `(err, ctx) => IHttpResponse`
  - If `true` (default), returns thrown `HttpResponse` as-is, they will be sent as the response
  - If `false`, lets the error propagate, which will likely result in a `500 Internal Server Error`
  - If function, calls the function with the error and context, expects an `IHttpResponse` to
    return, so you can customize the response in the way you want
- `handleUnknownErrors`: `true` | `false` | `(err, ctx) => IHttpResponse`
  - If `true` (default), returns `500 Internal Server Error` with a generic message
  - If `false`, lets the error propagate
  - If function, calls the function with the error and context, expects an `IHttpResponse` to
    return, so you can customize the response in the way you want

## License

Apache 2.0 © Dennis Wentzien 2025
