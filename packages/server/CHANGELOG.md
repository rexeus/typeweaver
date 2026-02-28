# @rexeus/typeweaver-server

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
