# @rexeus/typeweaver-effect

## 0.13.0

### Minor Changes

- 8acb009: Add the optional Effect-native Fetch server adapter with generated operation types, one managed
  application runtime, typed failure mapping, request interruption, operation spans, and idempotent
  Layer shutdown.
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

- db12a9a: An Effect 4 app can run the `typeweaver` CLI as a separate process to generate plain output. The
  Effect peer range stays `>=3.22.0 <4`. The only tested Effect 4 version is `4.0.0-rc.115` (pnpm,
  strict peers); every other Effect 4 version is UNVERIFIED. `typeweaver doctor` now resolves the
  project-declared Effect at the project boundary as
  `TW-DOCTOR-011` (skipped only when the project does not declare Effect and no Effect-native or
  custom plugin is configured; an undeclared project that selects the `effect` projection or a custom
  plugin fails; a conditional warning for the exact `4.0.0-rc.115` pin with built-in plain
  projections; UNVERIFIED warnings for any other Effect 4 version; and failure for the Effect-native
  `effect` projection or a custom plugin unless the workspace declares a supported stable Effect 3
  runtime). It also renames
  `TW-DOCTOR-008` to the CLI's own bundled Effect runtime. The binary CLI remains usable in an Effect 4
  workspace through process isolation, while the CLI programmatic API, `@rexeus/typeweaver-gen` plugin
  authoring, first-party plugin imports, and `@rexeus/typeweaver-effect` stay on Effect `>=3.22.0 <4`.
  Packed evidence covers all built-in plain projections and rejects a strict-peer Effect 4 install of
  the Effect-native packages.

  The CLI now validates the project-declared Effect with a direct `semver` dependency: `doctor` passes
  only a stable release that satisfies the project's declared specifier under standard semver
  (prereleases never pass), and a declaration that cannot be verified fails truthfully instead of
  passing on a hoisted parent Effect.

- Updated dependencies [545331b]
- Updated dependencies [db12a9a]
- Updated dependencies [33c3554]
- Updated dependencies [a83c79b]
- Updated dependencies [a9a79dc]
- Updated dependencies [f4fd035]
- Updated dependencies [4ccbed1]
- Updated dependencies [b539a81]
- Updated dependencies [fc4cee6]
- Updated dependencies [450408d]
- Updated dependencies [8700698]
  - @rexeus/typeweaver-gen@0.13.0
  - @rexeus/typeweaver-core@0.13.0
  - @rexeus/typeweaver-server@0.13.0

## 0.12.0

Initial package baseline. Public release changes are recorded through Changesets.
