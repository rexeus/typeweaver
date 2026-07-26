# @rexeus/typeweaver-zod-to-ts

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

- 6c78fba: Reject unsupported lazy, template-literal, custom, and transform schemas with an exported,
  structured `UnsupportedZodTypeError` instead of silently generating TypeScript `unknown`.

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
