# @rexeus/typeweaver-openapi

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

- 567724e: Replace the hard-coded OpenAPI 3.1.1 output with explicit `3.1.2` and `3.2.0` target profiles,
  defaulting to 3.1.2. Project generator-neutral metadata, tags, deprecation, security schemes, and
  effective operation security from `NormalizedSpec`.

  Remove API identity from OpenAPI plugin options and expose representability loss through stable
  `TW-PLUGIN-OPENAPI-*` issues returned by the side-effect-free plugin validation hook.

### Patch Changes

- Updated dependencies [545331b]
- Updated dependencies [33c3554]
- Updated dependencies [a83c79b]
- Updated dependencies [f4fd035]
- Updated dependencies [4ccbed1]
- Updated dependencies [b539a81]
  - @rexeus/typeweaver-gen@0.13.0
  - @rexeus/typeweaver-zod-to-json-schema@0.13.0

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
  - @rexeus/typeweaver-zod-to-json-schema@0.12.0
  - @rexeus/typeweaver-gen@0.12.0
