---
"@rexeus/typeweaver-clients": minor
"@rexeus/typeweaver-server": minor
"@rexeus/typeweaver-types": minor
"@rexeus/typeweaver-hono": minor
"@rexeus/typeweaver": minor
---

- Expose operationId from API definitions at runtime.
  - The operationId defined in OpenAPI specs is now available across all runtime layers: server
    middleware and handlers via `ctx.route.operationId`, client request commands via
    `this.operationId`, and Hono route handlers through the middleware context.
  - This enables logging, tracing, and metrics keyed to the original API operation without
    hardcoding strings.
- Simplify response class constructors.
  - Response constructors no longer accept `statusCode` — each class hard-codes its own status code
    via a direct property initializer. The constructor parameter type changes from `I…Response` to
    `Omit<I…Response, "statusCode">`. Responses without header or body use a zero-arg constructor.
  - Fix ResponseValidator to call the zero-arg constructor for empty responses.
