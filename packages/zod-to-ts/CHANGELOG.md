# @rexeus/typeweaver-zod-to-ts

## 0.12.0

## 0.11.0

### Minor Changes

- 1f866a8: Expand Zod-to-TypeScript generation for Zod v4 wrapper schemas.

  `z.nonoptional()`, `z.readonly()`, `z.catch()`, `z.pipe()`, `z.nan()`, `z.file()`, and `z.success()` now emit concrete TypeScript types where possible instead of falling back to `unknown`. Object property keys that are reserved identifiers or otherwise unsafe are emitted as string literal keys.

## 0.10.5

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

## 0.10.3

## 0.10.2

### Patch Changes

- 4719f61: Enforce explicit `.js` file extensions on all relative imports for strict ESM compliance. Switch `moduleResolution` to `NodeNext`. Generated code now includes proper extensions, ensuring compatibility with strict ESM consumers.

## 0.10.1

### Patch Changes

- 5389382: Switch internal bundler to rolldown.

## 0.10.0

## 0.9.2

## 0.9.1

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

## 0.8.0

## 0.7.0

## 0.6.5

## 0.6.4

### Patch Changes

- bee197f: Normalize custom `headerName` option to lowercase in `requestId` middleware so that
  mixed-case values like `"X-Request-Id"` match HTTP-layer-normalized headers correctly

## 0.6.3

### Patch Changes

- be839c7: Widen remaining bare `RequestHandler` types in `RouteDefinition` and
  `TypeweaverRouter.route()` to `RequestHandler<any, any, any>`

## 0.6.2

### Patch Changes

- 9fbe741: Widen `RequestHandler` constraint in `TypeweaverApp.route()` from bare `RequestHandler`
  to `RequestHandler<any, any, any>` to resolve contravariance error under `strictFunctionTypes`

## 0.6.1

## 0.6.0

### Minor Changes

- 10dc399: Replace built-in Prettier formatter with oxfmt

  The `--prettier` / `--no-prettier` CLI flags have been renamed to `--format` / `--no-format`. The
  `prettier` config option is now `format`. Generated code is now formatted using oxfmt instead of
  Prettier.

## 0.5.1

## 0.5.0

### Minor Changes

- d2bb619: - Replace axios with native fetch API.
  - The fetchFn prop on ApiClientProps allows injecting a custom fetch implementation.
  - Response header validation now correctly splits comma-delimited values per RFC 7230 when the
    schema expects an array.

## 0.4.2

### Patch Changes

- 645a4bb: Fix baseUrls in clients

## 0.4.1

## 0.4.0

### Minor Changes

- 4c96840: Improve bundling

## 0.3.2

## 0.3.1

## 0.3.0

### Minor Changes

- 76b2a3b: - Add support for Bun & Deno
  - Add support for Commonjs in addition to ESM

## 0.2.1

## 0.2.0

### Minor Changes

- 35be4c9: - Improve package descriptions
  - Update all dependencies to latest versions

## 0.1.2

## 0.1.1

## 0.1.0

### Minor Changes

- 73fc785: Support zod v4

## 0.0.4

### Patch Changes

- 4e5b0ea: Support entity-scoped responses & nested input dirs.

## 0.0.3

### Patch Changes

- 7324748: Fix issue when single plugins are used. There were dependencies between the plugins which
  now have been resolved.
