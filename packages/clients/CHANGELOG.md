# @rexeus/typeweaver-clients

## 0.10.2

### Patch Changes

- 4719f61: Enforce explicit `.js` file extensions on all relative imports for strict ESM compliance. Switch `moduleResolution` to `NodeNext`. Generated code now includes proper extensions, ensuring compatibility with strict ESM consumers.
- Updated dependencies [4719f61]
  - @rexeus/typeweaver-zod-to-ts@0.10.2
  - @rexeus/typeweaver-core@0.10.2
  - @rexeus/typeweaver-gen@0.10.2

## 0.10.1

### Patch Changes

- 5389382: Switch internal bundler to rolldown.
- a76e62e: Unify generator build mechanics behind shared tsdown helpers, enforce plugin
  dependency ordering, simplify the precompiled `types` lib build path, and switch
  the CLI spec bundler from `tsdown` to direct `rolldown` usage.
- Updated dependencies [5389382]
- Updated dependencies [a76e62e]
  - @rexeus/typeweaver-zod-to-ts@0.10.1
  - @rexeus/typeweaver-core@0.10.1
  - @rexeus/typeweaver-gen@0.10.1

## 0.10.0

### Minor Changes

- 40f90d3: ### Supply chain hardening

  - Replace `ejs` dependency with a zero-dependency template engine
  - Replace `case` dependency with built-in `toPascalCase` and `toCamelCase` utilities
  - Remove `tsx` from production dependencies; TypeScript config files (`.ts`, `.mts`, `.cts`) are no longer supported by the published CLI
  - Add clean safety guards to prevent destructive `rm` on workspace roots
  - Enable npm provenance on publish

  ### Naming convention validation

  - Validate `operationId` and `resourceName` during spec normalization
  - Reject `snake_case` and `kebab-case` identifiers with dedicated error types (`InvalidOperationIdError`, `InvalidResourceNameError`)
  - Supported formats: camelCase (preferred) and PascalCase (for compatibility)

### Patch Changes

- Updated dependencies [40f90d3]
  - @rexeus/typeweaver-core@0.10.0
  - @rexeus/typeweaver-gen@0.10.0
  - @rexeus/typeweaver-zod-to-ts@0.10.0

## 0.9.2

### Patch Changes

- @rexeus/typeweaver-core@0.9.2
- @rexeus/typeweaver-gen@0.9.2
- @rexeus/typeweaver-zod-to-ts@0.9.2

## 0.9.1

### Patch Changes

- @rexeus/typeweaver-core@0.9.1
- @rexeus/typeweaver-gen@0.9.1
- @rexeus/typeweaver-zod-to-ts@0.9.1

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
  - @rexeus/typeweaver-zod-to-ts@0.9.0
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
  - @rexeus/typeweaver-zod-to-ts@0.8.0

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
- @rexeus/typeweaver-zod-to-ts@0.7.0

## 0.6.5

### Patch Changes

- @rexeus/typeweaver-core@0.6.5
- @rexeus/typeweaver-gen@0.6.5
- @rexeus/typeweaver-zod-to-ts@0.6.5

## 0.6.4

### Patch Changes

- bee197f: Normalize custom `headerName` option to lowercase in `requestId` middleware so that
  mixed-case values like `"X-Request-Id"` match HTTP-layer-normalized headers correctly
- Updated dependencies [bee197f]
  - @rexeus/typeweaver-zod-to-ts@0.6.4
  - @rexeus/typeweaver-core@0.6.4
  - @rexeus/typeweaver-gen@0.6.4

## 0.6.3

### Patch Changes

- be839c7: Widen remaining bare `RequestHandler` types in `RouteDefinition` and
  `TypeweaverRouter.route()` to `RequestHandler<any, any, any>`
- Updated dependencies [be839c7]
  - @rexeus/typeweaver-zod-to-ts@0.6.3
  - @rexeus/typeweaver-core@0.6.3
  - @rexeus/typeweaver-gen@0.6.3

## 0.6.2

### Patch Changes

- 9fbe741: Widen `RequestHandler` constraint in `TypeweaverApp.route()` from bare `RequestHandler`
  to `RequestHandler<any, any, any>` to resolve contravariance error under `strictFunctionTypes`
- Updated dependencies [9fbe741]
  - @rexeus/typeweaver-zod-to-ts@0.6.2
  - @rexeus/typeweaver-core@0.6.2
  - @rexeus/typeweaver-gen@0.6.2

## 0.6.1

### Patch Changes

- @rexeus/typeweaver-core@0.6.1
- @rexeus/typeweaver-gen@0.6.1
- @rexeus/typeweaver-zod-to-ts@0.6.1

## 0.6.0

### Minor Changes

- 10dc399: Replace built-in Prettier formatter with oxfmt

  The `--prettier` / `--no-prettier` CLI flags have been renamed to `--format` / `--no-format`. The
  `prettier` config option is now `format`. Generated code is now formatted using oxfmt instead of
  Prettier.

### Patch Changes

- Updated dependencies [10dc399]
  - @rexeus/typeweaver-zod-to-ts@0.6.0
  - @rexeus/typeweaver-core@0.6.0
  - @rexeus/typeweaver-gen@0.6.0

## 0.5.1

### Patch Changes

- @rexeus/typeweaver-core@0.5.1
- @rexeus/typeweaver-gen@0.5.1
- @rexeus/typeweaver-zod-to-ts@0.5.1

## 0.5.0

### Minor Changes

- d2bb619: - Replace axios with native fetch API.
  - The fetchFn prop on ApiClientProps allows injecting a custom fetch implementation.
  - Response header validation now correctly splits comma-delimited values per RFC 7230 when the
    schema expects an array.

### Patch Changes

- Updated dependencies [d2bb619]
  - @rexeus/typeweaver-zod-to-ts@0.5.0
  - @rexeus/typeweaver-core@0.5.0
  - @rexeus/typeweaver-gen@0.5.0

## 0.4.2

### Patch Changes

- 3208c25: - Fix ApiClient URL construction to support relative base paths
  - ApiClient now uses string concatenation instead of `new URL()` for path construction, allowing
    relative base paths like `/api` without requiring a full origin URL.
- 645a4bb: Fix baseUrls in clients
- Updated dependencies [645a4bb]
  - @rexeus/typeweaver-zod-to-ts@0.4.2
  - @rexeus/typeweaver-core@0.4.2
  - @rexeus/typeweaver-gen@0.4.2

## 0.4.1

### Patch Changes

- 3d939a2: - Fix ApiClient URL construction to support relative base paths
  - ApiClient now uses string concatenation instead of `new URL()` for path construction, allowing
    relative base paths like `/api` without requiring a full origin URL.
  - @rexeus/typeweaver-core@0.4.1
  - @rexeus/typeweaver-gen@0.4.1
  - @rexeus/typeweaver-zod-to-ts@0.4.1

## 0.4.0

### Minor Changes

- 4c96840: Improve bundling

### Patch Changes

- Updated dependencies [4c96840]
  - @rexeus/typeweaver-zod-to-ts@0.4.0
  - @rexeus/typeweaver-core@0.4.0
  - @rexeus/typeweaver-gen@0.4.0

## 0.3.2

### Patch Changes

- b49b9d6: Fix undefined query strings in client
  - @rexeus/typeweaver-core@0.3.2
  - @rexeus/typeweaver-gen@0.3.2
  - @rexeus/typeweaver-zod-to-ts@0.3.2

## 0.3.1

### Patch Changes

- @rexeus/typeweaver-core@0.3.1
- @rexeus/typeweaver-gen@0.3.1
- @rexeus/typeweaver-zod-to-ts@0.3.1

## 0.3.0

### Minor Changes

- 76b2a3b: - Add support for Bun & Deno
  - Add support for Commonjs in addition to ESM

### Patch Changes

- Updated dependencies [76b2a3b]
  - @rexeus/typeweaver-zod-to-ts@0.3.0
  - @rexeus/typeweaver-core@0.3.0
  - @rexeus/typeweaver-gen@0.3.0

## 0.2.1

### Patch Changes

- Updated dependencies [77fb21d]
  - @rexeus/typeweaver-core@0.2.1
  - @rexeus/typeweaver-gen@0.2.1
  - @rexeus/typeweaver-zod-to-ts@0.2.1

## 0.2.0

### Minor Changes

- 35be4c9: - Improve package descriptions
  - Update all dependencies to latest versions

### Patch Changes

- Updated dependencies [35be4c9]
  - @rexeus/typeweaver-zod-to-ts@0.2.0
  - @rexeus/typeweaver-core@0.2.0
  - @rexeus/typeweaver-gen@0.2.0

## 0.1.2

### Patch Changes

- Updated dependencies [95beee9]
  - @rexeus/typeweaver-core@0.1.2
  - @rexeus/typeweaver-gen@0.1.2
  - @rexeus/typeweaver-zod-to-ts@0.1.2

## 0.1.1

### Patch Changes

- Updated dependencies [f1ccb30]
  - @rexeus/typeweaver-core@0.1.1
  - @rexeus/typeweaver-gen@0.1.1
  - @rexeus/typeweaver-zod-to-ts@0.1.1

## 0.1.0

### Patch Changes

- Updated dependencies [73fc785]
  - @rexeus/typeweaver-zod-to-ts@0.1.0
  - @rexeus/typeweaver-core@0.1.0
  - @rexeus/typeweaver-gen@0.1.0

## 0.0.4

### Patch Changes

- c46bfc2: Provide more details in ResponseValidationErrors about specific responses and improve
  ResponseValidators
- f9437df: Improve header & query param handling in clients and hono routers.
- 74f411f: Definitions are now embedded in generated code, so the output is self-contained.
- 4e5b0ea: Support entity-scoped responses & nested input dirs.
- eebc31d: Make unknown response handling in clients configurable
- e564680: Fix issue with shared and entity-based responses
- c46bfc2: Improve client handling of UnknownResponses
- Updated dependencies [84c8f9f]
- Updated dependencies [c46bfc2]
- Updated dependencies [4e5b0ea]
- Updated dependencies [e564680]
- Updated dependencies [2ec3eaf]
- Updated dependencies [c46bfc2]
  - @rexeus/typeweaver-gen@0.0.4
  - @rexeus/typeweaver-core@0.0.4
  - @rexeus/typeweaver-zod-to-ts@0.0.4

## 0.0.3

### Patch Changes

- 7324748: Fix issue when single plugins are used. There were dependencies between the plugins which
  now have been resolved.
- Updated dependencies [7324748]
  - @rexeus/typeweaver-zod-to-ts@0.0.3
  - @rexeus/typeweaver-core@0.0.3
  - @rexeus/typeweaver-gen@0.0.3

## 0.0.2

### Patch Changes

- 306bdec: Update package.json exports & add bin command

## 0.0.1

### Patch Changes

- 90182b3: Initial version
