# @rexeus/typeweaver-server

## 0.6.1

### Patch Changes

- edd224c: Fix generated code issues and stabilize CLI binary resolution

  - Fix trailing comma in Response.ejs template that produced `HttpResponse<Header, Body,>` in
    generated response classes
  - Widen `TypeweaverRouter` generic constraint from `RequestHandler` to
    `RequestHandler<any, any, any>` to resolve contravariance error under `strictFunctionTypes`
  - Add persistent `bin/` wrapper for CLI so pnpm creates the binary symlink reliably before the first
    build
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
