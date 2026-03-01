---
"@rexeus/typeweaver-clients": minor
"@rexeus/typeweaver-server": minor
"@rexeus/typeweaver-types": minor
"@rexeus/typeweaver-hono": minor
"@rexeus/typeweaver": minor
---

- Expose operationId from API definitions at runtime.
  - The operationId defined in OpenAPI specs is now available across all runtime layers:
    server middleware and handlers via `ctx.route.operationId`, client request commands
    via `this.operationId`, and Hono route handlers through the middleware context.
  - This enables logging, tracing, and metrics keyed to the original API operation without
    hardcoding strings.
