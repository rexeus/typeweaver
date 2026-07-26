# Plan 001: Establish product truth and close type-safety gaps

> **Executor instructions:** Read `GOAL.md` and `plans/README.md` first. Execute the work packages
> in order, run every verification gate, and record evidence before moving on. Stop instead of
> improvising when a STOP condition applies.

## Status

- **Stage:** 1
- **Status:** IN PROGRESS
- **Priority:** P1
- **Effort:** L
- **Risk:** MED
- **Depends on:** planning PR merged into `main`
- **Category:** docs, correctness, type safety, DX
- **Planned at:** commit `3c97d402`, 2026-07-26
- **Branch:** `feat/product-truth-and-type-safety`
- **PR base:** `main`

## Outcome

The repository tells the truth about TypeWeaver, its public examples are compiled, unsupported
schemas fail explicitly, and public HTTP body contracts no longer leak `any`.

## Drift check

Run first:

```sh
git diff --stat 3c97d402..HEAD -- \
  README.md AGENTS.md docs packages/core packages/zod-to-ts \
  packages/server packages/hono scripts package.json \
  .github/workflows/quality-check.yml
```

If the planning PR introduced only `GOAL.md` and `plans/`, continue. If any listed implementation
path changed independently, compare it with the current state below and update this plan before
implementing.

## Current state

- `README.md:44-58` claims active performance testing and that no `any` can enter public types. The
  repository has no reproducible performance benchmark, while `packages/core/src/HttpBody.ts:3`
  exports `IHttpBody = any | undefined`.
- `AGENTS.md:6-28` lists stale packages and refers to Node 22, pnpm 10.12.1, pkgroll, ESLint, and
  Prettier. `package.json` requires Node 24 and pnpm 10.34.5 and uses tsdown, Oxlint, and Oxfmt.
- ADR 0001 and ADR 0002 remain `Proposed` although their architecture is implemented. ADR 0001
  contains the obsolete bare-array `defineSpec` resource example tracked by #198 and #200.
- `scripts/check-markdown-links.mjs` verifies local file targets but does not compile code blocks.
  `docs:check` checks Markdown links, `verify:effect-version` enforces the Effect dependency and
  version contracts, and `verify:architecture-contracts` composes both checks into the durable
  architecture gate.
- `packages/cli/examples/tsconfig.json` proves that checked-in TypeScript examples can be
  typechecked as part of a package command. Use this as the executable-docs pattern.
- `packages/zod-to-ts/src/tsTypeGenerator.ts` intentionally maps `z.unknown()` to TypeScript
  `unknown`, but also silently widens unsupported lazy, template literal, custom, and transform
  schemas. Issue #193 documents the failure mode.
- `packages/server/src/lib/FetchApiAdapter.ts:320-378` and the corresponding Hono adapter accept
  `any` bodies. Generated request/response types flow from `IHttpBody`.

## Scope

### In scope

- `VISION.md`, root/package READMEs, `AGENTS.md`, ADR 0001 and ADR 0002
- documentation examples and verification scripts
- `packages/core`, `packages/zod-to-ts`, `packages/server`, and `packages/hono` public body/type
  boundaries and their tests/templates
- test project specs and regenerated fixtures required to prove behavior
- root scripts, CI wiring, and Changesets required by these changes
- a documentation-only backlog reconciliation artifact if useful

### Out of scope

- security/auth metadata and OpenAPI version profiles: Plan 002
- new CLI commands, plugin scaffolding, generated CLI, Effect handlers: Plan 003
- arbitrary removal of internal `unknown` values or safe runtime narrowing
- implementing recursive TypeScript declarations for `z.lazy`
- performance optimization without a benchmark

## Work packages

### 1. Establish the product vision and repository truth

Create `VISION.md` in English. It must define:

- target users and their jobs
- the one-contract/many-projections promise
- product principles and explicit non-goals from `GOAL.md`
- the north-star workflow
- standards and runtime portability
- Effect's optional role
- measurable success signals

Update the root README, package table, project-status claims, AGENTS guidance, and affected package
READMEs to match the repository. Resolve ADR 0001/0002 questions against the live normalized model
and change their status to `Accepted` only when each implemented decision is documented. Correct
every obsolete `defineSpec` example.

Add a small repository-truth test that reads `package.json` and asserts that version/tool names
stated in `AGENTS.md` match the package manifest. Add a VISION-contract test that checks required
headings, not prose wording.

**Verify:**

```sh
pnpm docs:check
rg -n 'Node 22|10\.12\.1|pkgroll|Prettier|ESLint' AGENTS.md README.md docs
rg -n '^Proposed$|todo: \[GetTodo\]' docs/adr/0001-functional-spec-api.md docs/adr/0002-normalized-core-model.md
```

Expected: docs check passes; the stale-token searches return no false claims in active guidance;
both ADRs match implemented reality.

### 2. Make public documentation executable

Create a deterministic documentation-example verification system. Prefer checked-in example `.ts`
files included by dedicated `tsconfig` files over a fragile Markdown parser. Every public quickstart
and plugin-authoring code path must have a corresponding fixture identified from the Markdown page.

At minimum cover:

- root `defineOperation`/`defineSpec` quickstart
- core response derivation
- generation CLI/config
- minimal and scoped-service plugins
- clients
- Hono and Fetch-native server handlers
- OpenAPI plugin options

Add a root command such as `verify:docs-examples`, call it from `docs:check`, and wire `docs:check`
into the quality workflow if it is not already transitively guaranteed. Add a negative self-test
proving that a deliberately invalid example causes the checker to fail.

**Verify:**

```sh
pnpm docs:check
pnpm typecheck
```

Expected: both exit 0; the checker reports every declared public example group.

### 3. Fail honestly on unsupported Zod schemas

Introduce a stable exported error for schema shapes the TypeScript generator cannot represent.
Preserve the legitimate `z.unknown()` conversion. Replace silent `unknown` fallback only for
unsupported lazy, template-literal, custom, and transform paths.

The error must include a stable code, schema kind, and actionable reason. Tests must cover every
unsupported kind exposed by the installed Zod version and prove that supported `z.unknown()` remains
supported. Document the limitation and the failure behavior.

If a conversion is lossless and small, it may be implemented instead of rejected only with direct
runtime/type tests. Do not invent a lossy representation merely to avoid the error.

**Verify:**

```sh
pnpm --filter @rexeus/typeweaver-zod-to-ts test
pnpm --filter @rexeus/typeweaver-zod-to-ts typecheck
pnpm verify:generated
```

Expected: all exit 0; unsupported cases throw the stable error; `z.unknown()` still emits `unknown`.

### 4. Remove public HTTP body `any`

Design an explicit body boundary using `unknown` and/or a documented transport body union. The
public default must not be `any`. Update core request/response types, Fetch adapters, Hono adapters,
server templates, generated fixtures, and serialization narrowing.

Add compile-time contracts with an `IsAny<T>` helper that fail when public request, response,
handler, or adapter body types resolve to `any`. Add runtime tests for JSON values, strings,
`ArrayBuffer`, `Blob`, null/undefined, unserializable values, and malformed external input.

Breaking changes are allowed, but include a Changeset and migration section showing consumers how to
narrow or specify body types.

**Verify:**

```sh
pnpm --filter @rexeus/typeweaver-core test
pnpm --filter @rexeus/typeweaver-server test
pnpm --filter @rexeus/typeweaver-hono test
pnpm --filter @rexeus/typeweaver typecheck:contracts
pnpm test:gen
pnpm --filter @rexeus/typeweaver test:bundle:all
```

Expected: all exit 0; type-contract tests prove no public body default is `any`.

### 5. Reconcile evidence and finish the stage

Review live issues #193, #198, #200 and any stale audit issues affected by the merged Effect work.
Record which are implemented, superseded, or still open in the PR description or a checked-in
roadmap note. Do not mutate issues.

Run the full gate from `GOAL.md`, create logical English Conventional Commits, push the branch, and
create a ready-for-review PR against `main`. Repair CI until all required checks are green. Record
the PR URL and evidence in `GOAL.md`.

## Work package evidence

| Work package                           | Status      | Commit     | Evidence                                                                                                                                                                                 |
| -------------------------------------- | ----------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Product vision and repository truth | DONE        | `62856a3d` | `pnpm docs:check`, `pnpm format:check`, and `pnpm lint` pass; both required stale-state searches return no matches                                                                       |
| 2. Executable public documentation     | DONE        | `31ad8594` | Nine declared fixture groups and the invalid-example self-test pass through `pnpm docs:check`; `pnpm typecheck` passes 23/23 tasks                                                       |
| 3. Honest unsupported-schema failures  | DONE        | `6c78fba8` | Six formerly silent fallback cases now throw the exported stable error; 121/121 tests and package typecheck pass; 225 generated fixtures are unchanged                                   |
| 4. Public HTTP body boundary           | DONE        | `450408d5` | `IsAny` contracts, 150 Core/833 Server/112 Hono tests, 225 deterministic fixtures, root typecheck, and Node/Deno/Bun bundle gates pass                                                   |
| 5. Stage reconciliation and delivery   | IN PROGRESS |            | Live issues #193/#198/#200 remain open but are implemented here; #199 is superseded by the pinned Effect 3.22 tooling; the complete local Node 24 gate passes with an empty final status |

## Test plan

- Documentation contract/self-tests for vision headings, toolchain truth, and example coverage.
- TypeScript fixtures for every public quickstart path.
- Zod-to-TS unit tests for supported `unknown` and every unsupported shape.
- Public type tests using `IsAny`.
- Fetch/Hono/server serialization and parsing boundary tests.
- Regenerated Node/Deno/Bun fixtures and packed-consumer/full-stage checks.

## Done criteria

- [ ] Work packages 1 through 5 are complete with evidence.
- [x] No unchecked public code example is presented as supported.
- [x] No false performance claim remains.
- [x] Unsupported schema generation fails with stable diagnostics.
- [x] Public HTTP body defaults are not `any`.
- [x] Breaking public changes have Changesets and migration notes.
- [ ] Full local gate and all GitHub checks pass.
- [ ] Stage 1 PR targets `main`, is open, green, and unmerged.
- [ ] `GOAL.md` and `plans/README.md` record Stage 1 evidence.

## STOP conditions

Stop and report if:

- implemented code materially contradicts an ADR decision and resolving it requires choosing a
  different product architecture
- a supported Zod schema is discovered to depend on the silent fallback
- removing `any` requires excluding a currently supported transport body rather than
  typing/narrowing it
- a generated output would need to be hand-edited
- the branch is remote-ahead or diverged
- a narrow check fails twice without a new hypothesis, or the same tool/CI job fails three times
  without materially different evidence

## Maintenance notes

Future public examples must join the executable-docs manifest. Future schema support must add both
positive conversion tests and stable failure behavior. Reviewers should focus on whether the new
body boundary remains ergonomic while actually preventing `any`, and whether documentation claims
are proven rather than aspirational.
