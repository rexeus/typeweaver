# Plan 002: Mature the core contract and OpenAPI projection

> **Executor instructions:** Start only after the Stage 1 PR is open and green. Read `GOAL.md`,
> `plans/README.md`, this plan, and the Stage 1 migration notes. Branch from the exact Stage 1 head
> and keep this PR stacked on the Stage 1 branch. Run every verification gate and stop instead of
> improvising.

## Status

- **Stage:** 2
- **Status:** IN PROGRESS
- **Priority:** P1
- **Effort:** L
- **Risk:** HIGH
- **Depends on:** Plan 001 PR open and green
- **Category:** architecture, public contract, OpenAPI, diagnostics
- **Planned at:** commit `3c97d402`, 2026-07-26
- **Branch:** `feat/contract-and-openapi-maturity`
- **PR base:** `feat/product-truth-and-type-safety`

## Outcome

TypeWeaver has one generator-neutral metadata/security model, a read-only plugin validation
contract, and explicit validated OpenAPI 3.1.2 and 3.2.0 projections.

## Drift check

Run first against the live Stage 1 base:

```sh
git diff --stat 3c97d402..HEAD -- \
  packages/core packages/gen packages/openapi packages/zod-to-json-schema \
  packages/test-utils docs/adr packages/*/README.md
```

Re-read all changed public types before following the excerpts below. Update the plan in a dedicated
commit if Stage 1 changed any assumption.

## Current state

- `packages/core/src/defineSpec.ts` contains only `resources`.
- `packages/core/src/defineOperation.ts` contains `operationId`, path, method, summary, request, and
  responses.
- `packages/core/src/RequestDefinition.ts` models header, path parameters, query, and one body
  schema.
- `packages/gen/src/NormalizedSpec.ts` is the canonical plugin-facing model.
- `packages/gen/src/plugins/Plugin.ts` has initialize, collect, generate, and finalize hooks but no
  read-only validation hook.
- `packages/openapi/src/types.ts` hardcodes OpenAPI `3.1.1`; components contain responses and
  schemas only.
- `packages/openapi/README.md:78-80` explicitly says security schemes are not inferred.
- `buildOpenApiDocument` already returns warnings beside a deterministic document, and the
  integration suite validates the committed fixture with Spectral.
- Issue #169 requires security semantics to live in the TypeWeaver contract, not as OpenAPI-only
  metadata. Issues #177, #179, and #188 define the diagnostics direction.

## Scope

### In scope

- authoring types in `packages/core`
- normalized types and normalization in `packages/gen`
- optional read-only plugin validation and stable issue types/codes
- OpenAPI builder, plugin, types, options, tests, fixtures, and docs
- metadata/security consumption needed by first-party generators to preserve or expose the contract
  without implementing authentication enforcement
- accepted ADRs, Changesets, migrations, and CI/test support

### Out of scope

- authentication provider implementations or authorization enforcement
- generated command clients and Effect handlers: Plan 003
- full OpenAPI importer, callbacks, webhooks, or lossless round-trip
- changing TypeWeaver's Zod-first schema authority
- native Effect `HttpApi`
- Effect 4 or Effect-baseline changes

## Target contract

The implementation may refine names for clarity, but must preserve these semantics and document any
deviation:

- Spec metadata includes at least `title`, `version`, optional `description`, reusable tag metadata,
  security schemes, and an optional default security requirement.
- Resources may add description, tags, and a security override.
- Operations may add description, deprecation, tags, and a security override.
- Security schemes are generator-neutral discriminated unions covering HTTP bearer/basic, API keys
  in header/query/cookie, OAuth2, and OpenID Connect.
- Security requirements use OpenAPI-compatible AND-within-object and OR-between-objects semantics so
  projection is lossless.
- `security: undefined` means inherit, `security: []` means explicitly public, and a non-empty list
  overrides the inherited requirement.
- Normalization resolves effective metadata/security while preserving enough source information for
  diagnostics.
- Authorization headers may still be described explicitly, but contradictory security/header
  declarations produce a stable issue rather than silent guessing.

Record the final shape and inheritance rules in an accepted ADR before calling the work package
complete.

## Work packages

### 1. Characterize and design the public contract

Add failing type/runtime characterization tests for the current authoring and normalized models.
Create an ADR for metadata/security with examples, inheritance truth table, OpenAPI mapping,
client/server implications, migration, and non-goals.

Validate all names against existing conventions. Prefer discriminated unions and readonly data. Do
not use OpenAPI-specific property names where a neutral domain term is clearer.

**Verify:**

```sh
pnpm --filter @rexeus/typeweaver-core test
pnpm --filter @rexeus/typeweaver-gen test
pnpm docs:check
```

Expected: tests and ADR checks pass; every inheritance case has a test.

### 2. Implement authoring and normalized metadata/security

Implement the accepted contract in core and normalize it once in gen. Reject duplicate scheme names,
unknown requirements, invalid scopes, malformed URLs, and contradictory declarations with
established typed errors.

Update test-project fixtures to exercise public, inherited, overridden, bearer, API-key, OAuth2,
deprecated, description, and tag cases. Update first-party generators only where required to carry
the new normalized shape safely; do not add auth enforcement.

Add Changesets and explicit pre-1.0 migration examples.

**Verify:**

```sh
pnpm --filter @rexeus/typeweaver-core test
pnpm --filter @rexeus/typeweaver-gen test
pnpm test:gen
pnpm verify:generated
pnpm typecheck
```

Expected: all exit 0 and the fixture proves inheritance/override semantics.

### 3. Add a side-effect-free plugin validation phase

Define stable `Issue` and `Severity` types in gen with code, message, JSON Pointer/source location,
hint, and fixability metadata. Add an optional Effect-native `validate` hook and a validation
context that has no output directory, writer, template renderer, or other write capability.

Integrate validation in PluginRegistry with deterministic plugin ordering, typed failures, spans,
and per-call isolation. Existing plugins without `validate` must continue to work. Add compile-time
negative tests proving a validation hook cannot write.

Use stable namespaces such as `TW-SPEC-*` and `TW-PLUGIN-<NAME>-*`; add exhaustiveness tests so new
exported errors or warning codes cannot silently miss registry entries.

**Verify:**

```sh
pnpm --filter @rexeus/typeweaver-gen test
pnpm --filter @rexeus/typeweaver-gen typecheck
pnpm effect:diagnostics
```

Expected: all exit 0; negative context fixture fails for the expected reason.

### 4. Add explicit OpenAPI target profiles

Add an explicit target option for `3.1.2` and `3.2.0`. Default to `3.1.2` for ecosystem
compatibility and document the choice. Do not emit 3.2-only fields in the 3.1 profile.

Project:

- info metadata, descriptions, tags, and deprecation
- `components.securitySchemes`
- effective per-operation security, including explicit public operations
- supported API-key, HTTP, OAuth2, and OpenID Connect shapes

Map every lossy or unsupported projection to a stable OpenAPI plugin issue. Move warnings from
ad-hoc logging into the validation phase without performing file writes. Keep document construction
deterministic.

Build a validator matrix that generates both versions from the same fixture and validates each with
tooling/schema support that explicitly understands the declared version. If an existing validator
cannot validate 3.2, add a second independent official-schema-based check rather than pretending
Spectral proves 3.2 validity.

**Verify:**

```sh
pnpm --filter @rexeus/typeweaver-openapi test
pnpm --filter @rexeus/typeweaver-openapi typecheck
pnpm --filter test-utils test:gen
```

Expected: 3.1.2 and 3.2.0 fixtures pass their declared validators; security and metadata
snapshots/assertions match the normalized contract.

### 5. Publish an honest support matrix

Update root and OpenAPI documentation with:

- default and optional OpenAPI profiles
- supported security and metadata features
- profile-specific differences
- supported, lossy-with-diagnostic, and out-of-scope tables
- migration from 3.1.1 output
- explicit non-support for full import and round-trip

Every documented option and example must join the executable-docs system from Plan 001.

**Verify:**

```sh
pnpm docs:check
pnpm --filter @rexeus/typeweaver-openapi test
```

### 6. Finish the stacked stage

Run the full gate, commit logical work packages, push, and open a ready PR against
`feat/product-truth-and-type-safety`. Repair CI until green. Record the exact base, PR URL, head,
and evidence in `GOAL.md`.

## Work package evidence

| Work package                                   | Status      | Commit    | Evidence                                                                                                                                                                                  |
| ---------------------------------------------- | ----------- | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Characterize and design the public contract | DONE        | `dc6251a` | Core type and Gen runtime characterizations failed before behavior changed; ADR 0009 fixes the accepted shape and inheritance table; Core 150/150, Gen 303/303, and docs checks pass      |
| 2. Authoring and normalized metadata/security  | DONE        | `a83c79b` | Core 151/151 and Gen 318/318 tests pass; generated 225-file fixture is reproducible; workspace typecheck, docs, lint, format, Effect diagnostics, and Changeset status pass               |
| 3. Side-effect-free plugin validation          | DONE        | `f4fd035` | Gen 325/325 and package typecheck pass; negative tsc fixture rejects write access; registry tests prove deterministic ordering, typed failures, spans, isolation, and stable codes        |
| 4. Explicit OpenAPI target profiles            | DONE        | `567724e` | OpenAPI 126/126 tests and package typecheck pass; both profiles pass the official-schema validator, the 3.1.2 generated fixture passes Spectral, and all 225 generated fixtures reproduce |
| 5. Honest support matrix                       | DONE        | `f91399f` | Documentation characterization failed before the change; afterward docs checks and all 129 OpenAPI tests pass with supported, lossy-with-diagnostic, and out-of-scope boundaries enforced |
| 6. Stacked stage delivery                      | IN PROGRESS | `978a7d9` | The complete Node 24 local gate passed at the recorded head with an empty final status; remote divergence, ready PR creation, and required GitHub checks remain                           |

## Test plan

- Core type/runtime tests for metadata/security shapes and inheritance.
- Normalization tests for every scheme, invalid references, explicit public operations, and
  deterministic output.
- Plugin validation lifecycle, ordering, failure, isolation, and no-write type tests.
- Exhaustive stable-code registry tests.
- OpenAPI unit tests per target plus externally validated generated fixtures.
- Executable docs, generated fixtures, packed consumers, multi-runtime bundles, and the full stage
  gate.

## Done criteria

- [x] The accepted ADR and implementation agree on all target-contract semantics.
- [x] Security is generator-neutral and normalized once.
- [x] Plugin validation is Effect-native, deterministic, and write-incapable.
- [x] Stable issue registries are exhaustive.
- [x] Both OpenAPI targets pass an honest validator matrix.
- [x] Docs state the support boundary without overclaiming.
- [x] Public changes have Changesets and migrations.
- [ ] Full local gate and all GitHub checks pass.
- [ ] Stage 2 PR targets the Stage 1 branch, is open, green, and unmerged.
- [ ] Goal and plan index contain Stage 2 evidence.

## STOP conditions

Stop and report if:

- the proposed security model cannot map to both OpenAPI targets without losing core semantics
- implementation starts enforcing authentication rather than describing it
- a validator used for 3.2 does not explicitly support 3.2
- validation requires a write-capable context
- a change would make Effect mandatory for non-Effect consumers
- a native Effect `HttpApi`, Effect Schema authority, or OpenAPI importer becomes necessary
- the stacked branch is remote-ahead/diverged or its intended base is missing

## Maintenance notes

Reviewers should focus on inheritance semantics, stable diagnostic compatibility, the absence of
OpenAPI leakage into core types, and whether the 3.2 validation claim is backed by a version-aware
validator. Future generators must consume the normalized security model rather than reinterpreting
authoring definitions.
