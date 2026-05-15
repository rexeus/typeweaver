# @rexeus/typeweaver-types

## 0.12.0

### Minor Changes

- c14059d: Add first-class normalized body media metadata and use it for OpenAPI content generation.

  The normalized generator contract now wraps request and response body schemas with
  the effective media type, media source, and transport semantics. Generator authors
  should read `body.schema` for the original Zod schema and use `body.mediaType` /
  `body.transport` when producing wire-format-specific output.

  OpenAPI generation now uses the normalized media type for request and response
  `content` entries, emits binary schemas for raw `application/octet-stream`
  bodies, preserves custom media types, and merges duplicate response variants per
  media type using `anyOf` where schemas overlap.

  Response header merging is now case-insensitive, so equivalent header names with
  different casing are merged without dropping schemas or descriptions.

  BREAKING CHANGE: `@rexeus/typeweaver-gen` normalized request and response body
  values are no longer bare Zod schemas. They are normalized body objects containing
  `schema`, `mediaType`, `mediaTypeSource`, and `transport`.

### Patch Changes

- 99300e7: Add the OpenAPI generator plugin so Typeweaver can emit OpenAPI 3.1.1 JSON documents during generation.
  Fix the schema-less request validator template so generated validators handle routes without request schemas correctly.
- Updated dependencies [c14059d]
  - @rexeus/typeweaver-gen@0.12.0
  - @rexeus/typeweaver-core@0.12.0
  - @rexeus/typeweaver-zod-to-ts@0.12.0

## 0.11.0

### Patch Changes

- 357c14b: Fix framework regressions in generated clients, server error handling, response metadata, and schema-less request generation.

  Generated client commands now preserve caller-supplied headers over generated defaults. Server apps now call `onError` for unknown errors handled by custom unknown-error handlers. Response definitions created from immutable objects no longer fail before derived response cycle validation can surface typed errors. Schema-less generated request commands and validators now compile under strict TypeScript `noUnusedLocals` and `noUnusedParameters`.

- Updated dependencies [b0197e1]
- Updated dependencies [1f866a8]
- Updated dependencies [357c14b]
  - @rexeus/typeweaver-gen@0.11.0
  - @rexeus/typeweaver-zod-to-ts@0.11.0
  - @rexeus/typeweaver-core@0.11.0

## 0.10.5

### Patch Changes

- c6a1542: Fix generated literal request headers, align typed response header optionality with runtime behavior, emit sanitized generated JSDoc, and validate transformed thrown typed HTTP responses after `handleHttpResponseErrors`. Clarify custom unknown error reporting semantics.
- Updated dependencies [c6a1542]
  - @rexeus/typeweaver-core@0.10.5
  - @rexeus/typeweaver-gen@0.10.5
  - @rexeus/typeweaver-zod-to-ts@0.10.5

## 0.10.4

### Patch Changes

- efcb54d: Harden runtime, generator, client, CLI, and build-boundary contracts across Typeweaver.

  This release strengthens fail-closed behavior for malformed requests, malformed responses,
  ambiguous headers, unsafe path values, stale dynamic imports, and shared build lifecycle hooks.
  It also expands the generated-runtime and generator contract suites so these edge cases remain
  locked through public behavior tests.

  Notable fixes include:

  - `@rexeus/typeweaver-core`: reject malformed typed-response shapes and preserve default error
    descriptor fields when callers add extra response body data.
  - `@rexeus/typeweaver-gen`: reject leading-digit generated identifiers and validate inline
    derived response metadata like canonical derived responses.
  - `@rexeus/typeweaver-types`: reject malformed array request parts and return safe validation
    failures for hostile response status values while preserving diagnostics.
  - `@rexeus/typeweaver-clients`: validate base URLs and path parameters before requests reach the
    fetch boundary, including generated file-client transport paths.
  - `@rexeus/typeweaver-server` and `@rexeus/typeweaver-hono`: fail closed on credentialed CORS
    wildcards, malformed JSON, response-validation handler failures, unsafe headers, and response
    normalization edge cases.
  - `@rexeus/typeweaver`: harden CLI config/plugin/spec loading, stale dynamic imports, generated
    index files, and shared `tsdown` post-build `onSuccess` handling.
  - `@rexeus/typeweaver-zod-to-ts`: improve TypeScript output for bigint literals, multi-value
    literals, enum values, variadic tuples, defaults, and optional/default interactions.

- Updated dependencies [efcb54d]
  - @rexeus/typeweaver-zod-to-ts@0.10.4
  - @rexeus/typeweaver-core@0.10.4
  - @rexeus/typeweaver-gen@0.10.4

## 0.10.3

### Patch Changes

- 7a9a8b3: - Normalize generated file names to PascalCase across generators and outputs for more consistent imports.
  - Improve generated response helpers so they only require defined header and body inputs, including coverage for body-only and empty responses.
  - Unify oversized request body handling across Node, Bun, and Deno with a shared server body limit policy and 413 integration coverage.
- Updated dependencies [7a9a8b3]
  - @rexeus/typeweaver-gen@0.10.3
  - @rexeus/typeweaver-core@0.10.3
  - @rexeus/typeweaver-zod-to-ts@0.10.3

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

- edd224c: Fix generated code issues and stabilize CLI binary resolution
  - Fix trailing comma in Response.ejs template that produced `HttpResponse<Header, Body,>` in
    generated response classes
  - Widen `TypeweaverRouter` generic constraint from `RequestHandler` to
    `RequestHandler<any, any, any>` to resolve contravariance error under `strictFunctionTypes`
  - Add persistent `bin/` wrapper for CLI so pnpm creates the binary symlink reliably before the
    first build
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

- 645a4bb: Fix baseUrls in clients
- Updated dependencies [645a4bb]
  - @rexeus/typeweaver-zod-to-ts@0.4.2
  - @rexeus/typeweaver-core@0.4.2
  - @rexeus/typeweaver-gen@0.4.2

## 0.4.1

### Patch Changes

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

### Minor Changes

- 73fc785: Support zod v4

### Patch Changes

- Updated dependencies [73fc785]
  - @rexeus/typeweaver-zod-to-ts@0.1.0
  - @rexeus/typeweaver-core@0.1.0
  - @rexeus/typeweaver-gen@0.1.0

## 0.0.4

### Patch Changes

- c46bfc2: Provide more details in ResponseValidationErrors about specific responses and improve
  ResponseValidators
- 4e5b0ea: Support entity-scoped responses & nested input dirs.
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
- Updated dependencies [306bdec]
  - @rexeus/typeweaver-core@0.0.2
  - @rexeus/typeweaver-gen@0.0.2

## 0.0.1

### Patch Changes

- 90182b3: Initial version
- Updated dependencies [90182b3]
  - @rexeus/typeweaver-core@0.0.1
  - @rexeus/typeweaver-gen@0.0.1
