# @rexeus/typeweaver-server

## 0.9.0

### Minor Changes

- f3dfcf5: Switch typeweaver to the new functional spec-entrypoint architecture.
  This removes the legacy filesystem- and class-based definition flow in favor of
  `defineSpec`, `defineOperation`, `defineResponse`, and `defineDerivedResponse`,
  and updates the CLI, generators, runtime defaults, and generated outputs to use
  the new normalized spec pipeline.
  ### Breaking changes
  - Remove legacy `Http*Definition` classes
  - Remove filesystem-based definition discovery
  - Require a spec entrypoint file for CLI generation
  - Update generated runtime/output structure and centralized default errors

### Patch Changes

- Updated dependencies [f3dfcf5]
  - @rexeus/typeweaver-core@0.9.0
  - @rexeus/typeweaver-gen@0.9.0

## 0.8.0

### Minor Changes

- 424f170: Replace generated response classes with tagged plain objects across the core, types,
  clients, server, and hono packages. Generated clients now return the full response union instead
  of throwing typed error responses, and generated server and hono routers now validate responses
  before sending them, stripping extra fields from valid bodies. This release also renames
  `handleValidationErrors` to `handleRequestValidationErrors` and adds configurable response
  validation error handling for generated routers.

### Patch Changes

- Updated dependencies [424f170]
  - @rexeus/typeweaver-core@0.8.0
  - @rexeus/typeweaver-gen@0.8.0

## 0.7.0

### Minor Changes

- 834109f: - Expose operationId from API definitions at runtime.
  - The operationId defined in OpenAPI specs is now available across all runtime layers: server
    middleware and handlers via `ctx.route.operationId`, client request commands via
    `this.operationId`, and Hono route handlers through the middleware context.
  - This enables logging, tracing, and metrics keyed to the original API operation without
    hardcoding strings.
  - Simplify response class constructors.
    - Response constructors no longer accept `statusCode` — each class hard-codes its own status
      code via a direct property initializer. The constructor parameter type changes from
      `I…Response` to `Omit<I…Response, "statusCode">`. Responses without header or body use a
      zero-arg constructor.
    - Fix ResponseValidator to call the zero-arg constructor for empty responses.

### Patch Changes

- @rexeus/typeweaver-core@0.7.0
- @rexeus/typeweaver-gen@0.7.0

## 0.6.5

### Patch Changes

- @rexeus/typeweaver-core@0.6.5
- @rexeus/typeweaver-gen@0.6.5

## 0.6.4

### Patch Changes

- bee197f: Normalize custom `headerName` option to lowercase in `requestId` middleware so that
  mixed-case values like `"X-Request-Id"` match HTTP-layer-normalized headers correctly
- Updated dependencies [bee197f]
  - @rexeus/typeweaver-core@0.6.4
  - @rexeus/typeweaver-gen@0.6.4

## 0.6.3

### Patch Changes

- be839c7: Widen remaining bare `RequestHandler` types in `RouteDefinition` and
  `TypeweaverRouter.route()` to `RequestHandler<any, any, any>`
- Updated dependencies [be839c7]
  - @rexeus/typeweaver-core@0.6.3
  - @rexeus/typeweaver-gen@0.6.3

## 0.6.2

### Patch Changes

- 9fbe741: Widen `RequestHandler` constraint in `TypeweaverApp.route()` from bare `RequestHandler`
  to `RequestHandler<any, any, any>` to resolve contravariance error under `strictFunctionTypes`
- Updated dependencies [9fbe741]
  - @rexeus/typeweaver-core@0.6.2
  - @rexeus/typeweaver-gen@0.6.2

## 0.6.1

### Patch Changes

- edd224c: Fix generated code issues and stabilize CLI binary resolution
  - Fix trailing comma in Response.ejs template that produced `HttpResponse<Header, Body,>` in
    generated response classes
  - Widen `TypeweaverRouter` generic constraint from `RequestHandler` to
    `RequestHandler<any, any, any>` to resolve contravariance error under `strictFunctionTypes`
  - Add persistent `bin/` wrapper for CLI so pnpm creates the binary symlink reliably before the
    first build
  - @rexeus/typeweaver-core@0.6.1
  - @rexeus/typeweaver-gen@0.6.1

## 0.6.0

### Minor Changes

- 10dc399: Replace built-in Prettier formatter with oxfmt

  The `--prettier` / `--no-prettier` CLI flags have been renamed to `--format` / `--no-format`. The
  `prettier` config option is now `format`. Generated code is now formatted using oxfmt instead of
  Prettier.

### Patch Changes

- Updated dependencies [10dc399]
  - @rexeus/typeweaver-core@0.6.0
  - @rexeus/typeweaver-gen@0.6.0

## 0.5.1

### Patch Changes

- 072dcd4: Add `@rexeus/typeweaver-server` — a dependency-free server plugin with built-in routing
  and middleware.
  - Fetch API compatible (`Request`/`Response`) — works with Bun, Deno, Cloudflare Workers, and
    Node.js (>=18)
  - High-performance radix tree router with O(d) lookup and path parameter support
  - Return-based middleware pipeline (onion model) with path-scoped and global middleware
  - Automatic HEAD → GET fallback and 405 Method Not Allowed with `Allow` header
  - Configurable error handling for validation errors, `HttpResponse` errors, and unknown errors
  - Request validation using generated validators
  - Support for JSON, `+json` (RFC 6839), text, form-urlencoded, and multipart/form-data bodies
  - @rexeus/typeweaver-core@0.5.1
  - @rexeus/typeweaver-gen@0.5.1
