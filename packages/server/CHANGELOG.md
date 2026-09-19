# @rexeus/typeweaver-server

## 0.13.0

### Minor Changes

- 33c3554: Migrate the runtime, plugin API, and CLI to Effect.

  The plugin API moves from class-based `BasePlugin` extension to V2 records returned by
  `definePlugin(...)` and `definePluginWithLibCopy(...)`. Lifecycle stages return
  `Effect<void, PluginExecutionError>` instead of `Promise<void> | void`. Error surfaces in the
  Effect-enabled packages use `Data.TaggedError`, including lifecycle failures
  (`PluginExecutionError`) and construction-time misconfiguration (`PluginConfigError`). The CLI is
  built on `@effect/cli`, with concise error formatting that preserves every failure and defect in
  composite causes, plus structured log lines. The
  `GeneratorContext` additionally exposes an Effect-native surface (`writeFileEffect`,
  `renderTemplateEffect`, `addGeneratedFileEffect`) with the same path-safety and atomic-write
  guarantees, routed through `@effect/platform`'s `FileSystem` service.

  Generator recovery now keeps publication and cleanup boundaries consistent under defects and Fiber
  interruption. Spec bundles are written to a scoped staging directory and renamed into place only
  after Rolldown settles successfully. Because Rolldown does not expose cancellation, an interrupted
  bundle waits for that Promise to settle before releasing its scope and output lock. Generated-file
  replacement and tracking form one commit, so a cleanup failure cannot leave a published but
  untracked file.

  Error payloads that represent multiple failure modes are now discriminated:
  `PluginDependencyError.issue` distinguishes a missing dependency from a structured dependency-cycle
  path, and `UnsafeCleanTargetError.details` carries only the fields required by its reason. The
  generator's `GenerateFailure` type is derived from the actual Effect error channel so cleanup
  failures cannot silently drift out of the public contract.

  Expected formatter and filesystem failures now stay on Effect's typed error channel. Formatter
  module loading, formatting, output traversal, clean-target inspection, output-lock I/O, and
  generated-path probes expose dedicated tagged errors; unexpected programming failures remain
  defects. The test-only in-memory filesystem follows the same missing-path, parent-directory,
  rename, realpath, directory-listing, and scoped-temp semantics as the Node filesystem layer.

  CLI option resolution now preserves custom top-level configuration keys when forwarding the final
  configuration to plugin contexts.

  Programmatic extension APIs with long positional argument lists now use named options objects.
  Construct `NetworkError` with `new NetworkError(message, { code, method, url, cause })`. Custom
  `TypeweaverRouter` subclasses pass one exported `TypeweaverRouteOptions` object to `route`, and
  custom `TypeweaverHono` subclasses pass one exported `TypeweaverHonoRequestOptions` object to
  `handleRequest`.

  The spec authoring API (`defineSpec`, `defineOperation`, `defineResponse`) is unchanged. Existing
  specs that use supported Zod schemas keep working byte-for-byte.

  - Effect-native plugin packages and `@rexeus/typeweaver-gen` now expose
    `peerDependencies.effect: ">=3.22.0 <4"`. The 3.22 lower bound matches the current `@effect/*`
    runtime family; 3.21.2 would install a second nominally incompatible Effect identity. Plugin
    authors must install one Effect 3 version satisfying that range.

  - `@rexeus/typeweaver-core`'s `DuplicateResponseNameError` stays a plain `Error` (the authoring
    package carries no effect dependency) and now exposes the offending `responseName`.
    `@rexeus/typeweaver-gen` wraps it at the normalization boundary into a tagged
    `DuplicateResponseNameError`, so the `NormalizationError` union is fully `catchTag`-addressable.

  Breaking changes are documented in the
  [migration guide](https://github.com/rexeus/typeweaver/blob/main/MIGRATION.md#migrating-from-012x-to-013x).
  Background on the design decisions:

  - ADR 0003 — Effect-native plugin API (V2)
  - ADR 0004 — FileSystem service adoption
  - ADR 0005 — Effect.Service patterns
  - ADR 0006 — CLI error and log formatting
  - ADR 0007 — Generator per-call isolation

- fc4cee6: Expose the incoming Fetch `AbortSignal` on `ServerContext` so handlers and optional runtime adapters
  can stop work when a request is cancelled.
- 450408d: Replace the implicit `any` HTTP body default with an `unknown` boundary, narrow response bodies in
  the Fetch adapters, and reject non-serializable Hono response bodies with
  `HonoResponseSerializationError`.
- 8700698: Separate raw HTTP transport requests from validated Zod output, add compile-time request-boundary
  schema checks, serialize domain scalars in generated clients, and make Server and Hono handler types
  truthful for every request-validation mode.

  Operation-specific `IRaw<OperationId>Request` types derive from `IRawHttpRequest` and specialize only
  the router-guaranteed path parameters. Query and header stay open transport records with
  lowercase/runtime keys and undeclared values possible, and `method` stays `HttpMethod` because a HEAD
  request may fall back to a GET route; the body stays optional `unknown`. A dynamic `boolean`
  validation mode exposes the validated/raw union, and `validateRequests` is required whenever a router
  is specialized as `false` or `boolean`.

  Request fields are rejected by their output kind and transport cardinality rather than by schema
  class. Fields whose output is not a client scalar or readonly scalar array, whose raw input cannot
  deliver the transport shape, or whose input/output cardinality disagrees are rejected at
  `defineOperation`. A bare `unknown`/`any` pipe input delegates raw acceptance to its downstream
  schema, so `unknown.pipe(z.string())` and `unknown.pipe(z.coerce.number())` stay valid while
  `unknown.pipe(z.number())` and `any.pipe(z.number())` are rejected. Every `z.preprocess`/transform
  pipe input is opaque and rejected even when a callback would coerce safely. Open object containers
  (`z.looseObject`, `.loose()`, `.passthrough()`, and non-`never` `.catchall`) are rejected with a
  pointer to `z.record`; default strip objects, `z.strictObject`, `.catchall(z.never())`, and
  `z.record(...)` remain supported. Strict request objects receive undeclared wire keys so
  `z.strictObject` and `.catchall(z.never())` reject them instead of validating a filtered object;
  default objects continue to strip undeclared keys. Array elements are inspected, so
  `any`/`unknown`/`never`/nested/object/nullish elements are rejected for object fields and record
  values, and only the exact broad base `z.ZodType` carried by `RequestDefinition` escapes
  classification.

  `__proto__` is reserved in every request transport part (param, query, header) and route placeholder.
  Statically knowable reserved names are rejected at `defineOperation`: request object shapes with a
  `__proto__` key, record key literals/enums containing `__proto__`, and `:__proto__` route
  placeholders; detectable key pipes, transforms, preprocess schemas, and non-string keys are rejected
  as before, while plain string, string refinement/format, literal, and enum keys remain supported.
  Record key schemas must preserve each raw key exactly: because Zod string mutators (`.trim()`,
  `.toLowerCase()`, `.toUpperCase()`) are opaque `ZodString` overwrites, the generated validator parses
  every own raw record key with the key schema before the container parse and reports an explicit issue
  when the key fails parsing, produces a non-string, changes identity, or resolves to `__proto__`.
  Generated clients reject an own `__proto__` param, query, or header key with
  `RequestSerializationError` reason `reserved-key` before path, URL, or header construction.
  `constructor` and `toString` remain supported in records and path parameters. Request-header object
  schemas reject declared names that collide case-insensitively. Finite record header keys are restored
  from normalized wire casing to the single declared spelling before key identity validation; query
  keys remain case-sensitive. Non-finite header record keys retain the lowercase/runtime transport
  spelling and their schema must accept that spelling.

  Request headers use the separate broad coercing/domain-output contract
  (`HttpRequestHeaderSchema`); the normalized spec reflects this with
  `NormalizedRequest.header: HttpRequestHeaderSchema`. The response-header contract is the unchanged
  transport-safe `HttpHeaderSchema` (`string`/`string[]` only) from the stack base.

  Generated clients reject an empty query array before `fetch` with `RequestSerializationError` reason
  `empty-array`, because it cannot be distinguished from an absent key; pass `undefined` to omit a
  query key. An empty header array is allowed and serializes to the empty comma-list `""`, which the
  validator normalizes back to `[]` for array header schemas. Embedded path placeholders preserve
  delimiter characters in parameter values: generated clients percent-encode the following static
  delimiter inside each value before the server router splits the segment.
  The Hono plugin rejects embedded path placeholders with `TW-PLUGIN-HONO-001` because Hono cannot
  extract them faithfully; Hono path parameters must occupy complete slash-delimited segments.

  This is a breaking pre-1.0 type change for code that consumes bare requests, calls generated
  validators directly, disables request validation, specializes a router as `false`/`boolean`, relied
  on raw query/header values being scalar or schema-cased, relied on an open/catchall request object,
  used a transforming record key, used an own `__proto__` record key, or sent empty query arrays. Use
  `IRawHttpRequest` at transport and middleware boundaries, operation-specific generated request types
  after validation, and follow the typed HTTP boundary migration guide.

### Patch Changes

- Updated dependencies [545331b]
- Updated dependencies [db12a9a]
- Updated dependencies [33c3554]
- Updated dependencies [a83c79b]
- Updated dependencies [a9a79dc]
- Updated dependencies [f4fd035]
- Updated dependencies [4ccbed1]
- Updated dependencies [b539a81]
- Updated dependencies [450408d]
- Updated dependencies [8700698]
  - @rexeus/typeweaver-gen@0.13.0
  - @rexeus/typeweaver-core@0.13.0

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

- Updated dependencies [c14059d]
  - @rexeus/typeweaver-gen@0.12.0
  - @rexeus/typeweaver-core@0.12.0

## 0.11.0

### Patch Changes

- 357c14b: Fix framework regressions in generated clients, server error handling, response metadata, and schema-less request generation.

  Generated client commands now preserve caller-supplied headers over generated defaults. Server apps now call `onError` for unknown errors handled by custom unknown-error handlers. Response definitions created from immutable objects no longer fail before derived response cycle validation can surface typed errors. Schema-less generated request commands and validators now compile under strict TypeScript `noUnusedLocals` and `noUnusedParameters`.

- Updated dependencies [b0197e1]
- Updated dependencies [357c14b]
  - @rexeus/typeweaver-gen@0.11.0
  - @rexeus/typeweaver-core@0.11.0

## 0.10.5

### Patch Changes

- c6a1542: Fix generated literal request headers, align typed response header optionality with runtime behavior, emit sanitized generated JSDoc, and validate transformed thrown typed HTTP responses after `handleHttpResponseErrors`. Clarify custom unknown error reporting semantics.
- Updated dependencies [c6a1542]
  - @rexeus/typeweaver-core@0.10.5
  - @rexeus/typeweaver-gen@0.10.5

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

## 0.10.2

### Patch Changes

- 4719f61: Enforce explicit `.js` file extensions on all relative imports for strict ESM compliance. Switch `moduleResolution` to `NodeNext`. Generated code now includes proper extensions, ensuring compatibility with strict ESM consumers.
- Updated dependencies [4719f61]
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

## 0.9.2

### Patch Changes

- ff722c3: Return ArrayBuffer instead of Uint8Array/Buffer from body collectors for broader runtime compatibility
  - @rexeus/typeweaver-core@0.9.2
  - @rexeus/typeweaver-gen@0.9.2

## 0.9.1

### Patch Changes

- @rexeus/typeweaver-core@0.9.1
- @rexeus/typeweaver-gen@0.9.1

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
