# `@rexeus/typeweaver-server`

> Generate a Fetch-native server boundary with typed handlers, request and response validation,
> routing, error mapping, and composable middleware—without adopting a separate web framework.

[![npm version](https://img.shields.io/npm/v/@rexeus/typeweaver-server.svg)](https://www.npmjs.com/package/@rexeus/typeweaver-server)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](../../LICENSE)

## Choose this projection when

Use `server` when you want application code to implement generated handler contracts while the
generated runtime deals with HTTP routing and the Fetch `Request`/`Response` boundary.

Choose [`hono`](../hono/README.md) instead when your application already uses Hono and should remain
inside its context and middleware model.

## Generate it

```bash
pnpm add -D @rexeus/typeweaver
pnpm add @rexeus/typeweaver-core zod

pnpm typeweaver generate \
  --input ./api/spec/index.ts \
  --output ./api/generated \
  --plugins server
```

The `types` projection is included automatically. The server runtime is copied into the generated
output, so application code imports routers and runtime helpers from that output rather than from
the generator package.

## Generated surface

For a `todo` resource:

```text
api/generated/
├── lib/server/                 # app, router, adapters, middleware, errors
└── todo/
    ├── TodoRouter.ts           # router and ServerTodoApiHandler contract
    └── ...generated operation types and validators
```

## Implement handlers

```ts
import {
  createGetTodoSuccessResponse,
  createTodoNotFoundResponse,
  type ServerTodoApiHandler,
} from "./api/generated/index.js";

export const todoHandlers: ServerTodoApiHandler = {
  async handleGetTodoRequest(request, context) {
    const todo = await findTodo(request.param.todoId, {
      signal: context.signal,
    });

    if (!todo) {
      return createTodoNotFoundResponse({
        body: {
          message: "Todo not found",
          todoId: request.param.todoId,
        },
      });
    }

    return createGetTodoSuccessResponse({ body: todo });
  },
};
```

<!-- docs-example: fetch-server-handler -->

The generated Fetch handler signature and response factory are typechecked in the
[server handler fixture](../cli/examples/documentation/fetch-server-handler.ts).

TypeScript requires the resource handler record to cover every generated operation. Each method
receives the validated request and a `ServerContext` that includes the incoming cancellation signal
and middleware state.

## Mount routers

```ts
import { TodoRouter, TypeweaverApp } from "./api/generated/index.js";
import { todoHandlers } from "./todo-handlers.js";

export const app = new TypeweaverApp().route(new TodoRouter({ requestHandlers: todoHandlers }));
```

Mount multiple resources or a path prefix:

```ts
const app = new TypeweaverApp()
  .route(new HealthRouter({ requestHandlers: healthHandlers }))
  .route("/api/v1", new TodoRouter({ requestHandlers: todoHandlers }));
```

`app.fetch` is a standard Fetch handler. Connect it to the host runtime:

```ts
// Node.js
import { createServer } from "node:http";
import { nodeAdapter } from "./api/generated/lib/server/index.js";

createServer(nodeAdapter(app)).listen(3000);
```

```ts
// Bun
Bun.serve({ port: 3000, fetch: app.fetch });
```

```ts
// Deno
Deno.serve({ port: 3000 }, app.fetch);
```

Runtime support should be verified against the host and generated bundle you deploy; the server
contract itself is built on standard Fetch primitives.

## Validation and error mapping

Request and response validation are enabled by default. They are explicit router options rather than
unconditional product-wide behavior:

```ts
const router = new TodoRouter({
  requestHandlers: todoHandlers,
  validateRequests: true,
  validateResponses: true,
  handleRequestValidationErrors: true,
  handleResponseValidationErrors: true,
  handleHttpResponseErrors: true,
  handleUnknownErrors: true,
});
```

| Option                           | Default | Purpose                                                  |
| -------------------------------- | ------- | -------------------------------------------------------- |
| `validateRequests`               | `true`  | validate and parse incoming request parts                |
| `validateResponses`              | `true`  | validate and parse handler responses                     |
| `handleRequestValidationErrors`  | `true`  | return the default 400 or use a custom mapper            |
| `handleResponseValidationErrors` | `true`  | return the default 500 or use a custom mapper            |
| `handleHttpResponseErrors`       | `true`  | return thrown typed HTTP responses as declared responses |
| `handleUnknownErrors`            | `true`  | return a sanitized 500 or use a custom mapper            |

Setting an error handler option to a function lets the application map the framework error into its
own declared response shape.

```ts
const router = new TodoRouter({
  requestHandlers: todoHandlers,
  handleRequestValidationErrors: error => ({
    type: "ValidationError",
    statusCode: 400,
    body: {
      code: "VALIDATION_ERROR",
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

A `false` value delegates/falls through according to the specific boundary. For response-validation
errors, `false` returns the original invalid response rather than converting it to the default 500;
validation still runs.

## Application-level error reporting

Configure the top-level app boundary:

```ts
const app = new TypeweaverApp({
  maxBodySize: 5 * 1024 * 1024,
  onError: error => logger.error({ error }, "Unhandled request failure"),
});
```

| App option    | Default           | Meaning                                                                       |
| ------------- | ----------------- | ----------------------------------------------------------------------------- |
| `maxBodySize` | `1_048_576` bytes | maximum request body size before a 413 response                               |
| `onError`     | `console.error`   | reports failures handled by the default unknown-error boundary and safety net |

Custom unknown-error handlers replace the default reporting strategy. Report the error inside your
custom handler when you need metrics or logs.

## Typed middleware

Middleware uses a return-based onion model and can declare state it provides and requires.

```ts
import { defineMiddleware, type InferState } from "./api/generated/lib/server/index.js";

const authentication = defineMiddleware<{ userId: string }>(async (context, next) => {
  const userId = await authenticate(context.request);
  return next({ userId });
});

const permissions = defineMiddleware<{ permissions: string[] }, { userId: string }>(
  async (context, next) => {
    const userId = context.state.get("userId");
    return next({ permissions: await loadPermissions(userId) });
  }
);

const app = new TypeweaverApp()
  .use(authentication)
  .use(permissions)
  .route(new TodoRouter({ requestHandlers: todoHandlers }));

type AppState = InferState<typeof app>;
```

Registering middleware before its required state exists is a compile-time error. Middleware may also
short-circuit by returning a response without calling `next()`.

Built-in middleware is copied into the generated runtime:

- [`cors`](./docs/middleware/cors.md)
- [`basicAuth`](./docs/middleware/basic-auth.md)
- [`bearerAuth`](./docs/middleware/bearer-auth.md)
- [`logger`](./docs/middleware/logger.md)
- [`secureHeaders`](./docs/middleware/secure-headers.md)
- [`requestId`](./docs/middleware/request-id.md)
- [`poweredBy`](./docs/middleware/powered-by.md)
- [`scoped` and `except`](./docs/middleware/scoped.md)

```ts
import { cors, logger, requestId, secureHeaders } from "./api/generated/lib/server/index.js";

const app = new TypeweaverApp()
  .use(requestId())
  .use(logger())
  .use(secureHeaders())
  .use(cors())
  .route(new TodoRouter({ requestHandlers: todoHandlers }));
```

## Routing behavior

The generated runtime includes:

- automatic HEAD fallback to a matching GET handler when no explicit HEAD operation exists;
- 404 responses for unknown routes;
- 405 responses with an `Allow` header when the route exists for another method;
- path parameter extraction;
- body parsing and size limits;
- response serialization over Fetch primitives.

These are runtime behaviors, not a promise that application authentication or business rules are
generated.

## Boundaries

This projection does not:

- implement business logic;
- enforce contract security declarations automatically;
- choose a deployment platform;
- generate an ORM or persistence layer;
- claim performance characteristics without a reproducible benchmark.

## Related documentation

- [Migration guide](../../MIGRATION.md)
- [Getting started](../../docs/getting-started.md)
- [Hono integration](../hono/README.md)
- [Effect handlers](../effect/README.md)
- [Generated types and validators](../types/README.md)
- [Contract authoring](../core/README.md)

## License

Apache 2.0 © Dennis Wentzien 2026
