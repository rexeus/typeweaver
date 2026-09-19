# `@rexeus/typeweaver-hono`

> Generate Hono routers whose handler signatures, validation, declared responses, and error
> boundaries come from your TypeWeaver contract.

[![npm version](https://img.shields.io/npm/v/@rexeus/typeweaver-hono.svg)](https://www.npmjs.com/package/@rexeus/typeweaver-hono)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](../../LICENSE)

## Choose this projection when

Use `hono` when your application already uses Hono or needs direct access to its `Context`,
middleware ecosystem, and deployment adapters.

Choose [`server`](../server/README.md) when you prefer TypeWeaver's Fetch-native app, router, and
typed middleware model without a web-framework dependency.

## Install and generate

```bash
pnpm add -D @rexeus/typeweaver
pnpm add @rexeus/typeweaver-core hono zod

pnpm typeweaver generate \
  --input ./api/spec/index.ts \
  --output ./api/generated \
  --plugins hono
```

The package supports Hono `>=4.11.0 <5`. The `types` projection is included automatically.

## Generated surface

For a `todo` resource, generation adds a `TodoHono.ts` router and copies the Hono adapter runtime
into `lib/hono/`.

The generated resource file exports:

- a `HonoTodoApiHandler` contract;
- one handler method per operation;
- a `TodoHono` router class;
- operation-specific request/response types through the generated barrel.

## Implement handlers

```ts
import type { Context } from "hono";
import {
  createGetTodoSuccessResponse,
  createTodoNotFoundResponse,
  type GetTodoResponse,
  type HonoTodoApiHandler,
  type IGetTodoRequest,
} from "./api/generated/index.js";

export class TodoHandlers implements HonoTodoApiHandler {
  async handleGetTodoRequest(request: IGetTodoRequest, context: Context): Promise<GetTodoResponse> {
    const todo = await findTodo(request.param.todoId, {
      requestId: context.req.header("x-request-id"),
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
  }
}
```

<!-- docs-example: hono-handler -->

The generated Hono handler signature and response factory are typechecked in the
[Hono handler fixture](../cli/examples/documentation/hono-handler.ts).

The generated interface keeps request and response types synchronized with the contract while
leaving application services and Hono context ownership in your code.

## Mount the router

```ts
import { Hono } from "hono";
import { TodoHono } from "./api/generated/index.js";
import { TodoHandlers } from "./todo-handlers.js";

const app = new Hono();

app.route(
  "/",
  new TodoHono({
    requestHandlers: new TodoHandlers(),
  })
);

export default app;
```

Use the Hono adapter appropriate for your deployment target to serve `app.fetch`.

## Router options

```ts
const router = new TodoHono({
  requestHandlers: new TodoHandlers(),
  validateRequests: true,
  validateResponses: true,
  handleRequestValidationErrors: true,
  handleBodyParseErrors: true,
  handleResponseValidationErrors: true,
  handleHttpResponseErrors: true,
  handleUnknownErrors: true,
  strict: true,
});
```

| Option                           | Default  | Purpose                                    |
| -------------------------------- | -------- | ------------------------------------------ |
| `requestHandlers`                | required | generated operation handlers               |
| `validateRequests`               | `true`   | validate and parse incoming request parts  |
| `validateResponses`              | `true`   | validate and parse handler responses       |
| `handleRequestValidationErrors`  | `true`   | default 400 or custom mapper               |
| `handleBodyParseErrors`          | `true`   | sanitized 400 for malformed request bodies |
| `handleResponseValidationErrors` | `true`   | default 500 or custom mapper               |
| `handleHttpResponseErrors`       | `true`   | return thrown typed HTTP responses         |
| `handleUnknownErrors`            | `true`   | sanitized 500 or custom mapper             |

Standard Hono options such as `strict` and `getPath` pass through the same options object.

Each error handler accepts `true`, `false`, or a custom function. Custom functions receive the
relevant error plus Hono context and return an `IHttpResponse`.

```ts
const router = new TodoHono({
  requestHandlers: new TodoHandlers(),
  handleRequestValidationErrors: (error, context) => ({
    type: "ValidationError",
    statusCode: 400,
    body: {
      requestId: context.req.header("x-request-id"),
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

When unknown-error handling is disabled, errors propagate to Hono's own error boundary, such as
`app.onError`.

## Body and response behavior

The adapter:

- reads path, query, header, and body values into the generated request shape;
- recognizes JSON and vendor `+json` media types;
- reports malformed bodies through `HonoBodyParseError` and the configured body-error boundary;
- validates declared responses when enabled;
- strips extra object fields when the declared Zod response schema parses them;
- serializes the resulting `IHttpResponse` through Hono.

Import adapter errors from the generated runtime barrel when a custom handler needs an `instanceof`
check:

```ts
import {
  HonoBodyParseError,
  HonoResponseSerializationError,
} from "./api/generated/lib/hono/index.js";
```

## Security boundary

TypeWeaver security declarations can become OpenAPI requirements and generated client/command
inputs. The Hono plugin does not turn them into authentication middleware automatically. Apply Hono
middleware or application logic explicitly.

## Boundaries

This plugin does not:

- replace Hono's deployment adapters;
- create application services or context variables;
- enforce authentication declarations automatically;
- introduce a second router beside Hono;
- require the Fetch-native TypeWeaver server package.

## Related documentation

- [Migration guide](../../MIGRATION.md)
- [Getting started](../../docs/getting-started.md)
- [Fetch-native server](../server/README.md)
- [Generated types and validators](../types/README.md)
- [Contract authoring](../core/README.md)

## License

Apache 2.0 © Dennis Wentzien 2026
