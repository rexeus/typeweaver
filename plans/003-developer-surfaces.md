# Plan 003: Deliver plugin, CLI, generated-command, and Effect surfaces

> **Executor instructions:** Stage 2 was green and subsequently merged by the human owner. On
> 2026-07-26, the owner authorized this branch to integrate current `main` and target `main`. Read
> all prior migration notes and the final normalized contract before designing generated APIs.
> Execute work packages in order and stop instead of improvising.

## Status

- **Stage:** 3
- **Status:** DONE
- **Priority:** P1
- **Effort:** XL
- **Risk:** HIGH
- **Depends on:** Plan 002 green and human-merged
- **Category:** plugin DX, CLI, generator, Effect integration, final review
- **Planned at:** commit `3c97d402`, 2026-07-26
- **Branch:** `feat/developer-surfaces`
- **PR base:** `main` (owner-authorized after the Stage 1 and 2 merges)

## Outcome

Developers can scaffold and validate TypeWeaver projects/plugins, generate a real command-line
client from a contract, and opt into Effect-returning server handlers with production-grade
lifecycle behavior.

## Drift check

Run first against the live Stage 2 head:

```sh
git diff --stat 3c97d402..HEAD -- \
  packages/gen packages/cli packages/clients packages/server \
  packages/test-utils docs README.md package.json pnpm-workspace.yaml
```

Re-read all changed plugin, diagnostics, security, and normalized-model APIs. Update this plan
before implementation if package ownership or public names changed.

## Current state

- `packages/gen/src/plugins/Plugin.ts` is Effect-native, but service-dependent third-party plugins
  must manually own Layer/Scope lifecycle.
- `docs/plugin-authoring.md` documents a private scoped-service pattern, while reusable public
  scaffold/test helpers are limited.
- `packages/cli/src/cli.ts:98-102` exposes an `init` command that only logs “coming soon”.
- The CLI has a mature Effect runtime and generation services but no first-class `validate` or
  `doctor` command.
- The clients package already generates Fetch-based API consumers that a generated command client
  can compose rather than reimplementing HTTP.
- `packages/server/src/lib/RequestHandler.ts` is Promise-only.
- `TypeweaverApp.fetch` is the real Fetch runtime boundary and `executeHandler` awaits the route
  handler. This is the correct boundary for one managed Effect runtime and request interruption.

## Scope

### In scope

- public plugin scaffold, test kit, and optional scoped-layer helper
- `typeweaver init`, `validate`, `doctor`, and narrowly required CLI diagnostics/pipeline
  improvements
- new published generator package `@rexeus/typeweaver-command`
- new optional published integration package `@rexeus/typeweaver-effect`
- server integration points required for Effect handlers
- examples, docs, Changesets, packed consumers, generated fixtures, and CI
- final evidence-backed review of the entire three-stage stack

### Out of scope

- `watch`, migrations automation, IDE/LSP integration, shell completion, and interactive TUI
- flattening arbitrary nested request bodies into individual CLI flags
- authentication provider login flows or secret storage
- native Effect `HttpApi` generation or Effect Schema authoring
- making Effect mandatory for ordinary generated clients/servers
- merging PRs, publishing packages, or releasing

## Work packages

### 1. Make third-party plugin authoring a product surface

**Status:** DONE — the public lifecycle test kit, scoped-Layer helper, non-interactive scaffold,
golden process tests, and packed external consumer are complete.

Expose a supported plugin test kit that can build safe in-memory contexts, run the full lifecycle,
inspect generated files/issues, and provide test Layers without importing private CLI internals.
Provide an Effect 3.22-compatible helper for plugins that own a scoped Layer, with one acquisition
per generation call and guaranteed release on success, typed failure, defect, and interruption.

Add a non-interactive scaffold path, either `typeweaver add plugin` or a well-scoped
`init --plugin`, that creates:

- package manifest and TypeScript config
- minimal plugin and configurable factory examples
- unit/integration tests using the public test kit
- README with lifecycle, diagnostics, and Effect baseline

Golden-test the scaffold and pack/install it in a temporary external workspace. Do not expose
private services merely to make testing easy.

**Verify:**

```sh
pnpm --filter @rexeus/typeweaver-gen test
pnpm --filter @rexeus/typeweaver test
pnpm verify:packed-consumers
pnpm effect:diagnostics
```

Expected: scaffolded external plugin builds, validates, generates, and releases resources on every
exit path.

### 2. Complete the core CLI workflow

**Status:** DONE — `validate` and `doctor` provide scoped no-write workflows with stable human/JSON
reports and public Zod schemas. `init` now publishes a complete Todo starter transactionally,
requires an explicit target, supports dry-run/force/config-format policy, preserves existing package
manifests, and restores all target files after injected publication failure.

Replace the `init` stub with an atomic, non-destructive project bootstrap. Implement:

- `validate`: no output writes, human/JSON reports, stable codes, severity threshold, plugin
  validation, and deterministic exit codes
- `doctor`: Node/pnpm/runtime, config/spec resolution, plugin availability, output permissions, and
  Effect-reference diagnostics where relevant
- `init`: explicit target, dry-run/force policy, rollback on failure, generated starter
  spec/config/scripts, and clear next steps

Reuse the Stage 2 issue model and the existing Effect services/layers. Keep stdout machine-readable
under `--json`; send human diagnostics to the intended stream. Add a Zod schema for JSON reports and
process-level tests for exit codes and no-write behavior.

No command may silently overwrite user files. `validate` must remain side-effect-free apart from
temporary files cleaned within its scope.

**Verify:**

```sh
pnpm --filter @rexeus/typeweaver test
pnpm --filter @rexeus/typeweaver test:process
pnpm --filter @rexeus/typeweaver typecheck
pnpm --filter @rexeus/typeweaver typecheck:contracts
```

Expected: commands pass success/failure/process tests; the literal “coming soon” no longer exists.

### 3. Generate command-line API clients

**Status:** DONE — the generated Node.js command client composes the Fetch client, preserves
contract-derived security and cancellation, exposes stable flags/output/exit codes, and passes real
server plus packed external-consumer verification.

Create `packages/command` published as `@rexeus/typeweaver-command`. It is a generator plugin
consuming the normalized contract and generated Fetch client, not a second HTTP implementation.

MVP contract:

- one deterministic subcommand per operation ID
- path, query, and header inputs as documented flags
- request body through `--body`, `--body-file`, or stdin
- `--base-url` plus environment-based configuration
- contract-derived bearer/API-key security inputs without storing secrets
- structured JSON output by default, with a stable human-readable alternative
- documented exit codes for usage, validation, HTTP, network, and internal failures
- cancellation and signal forwarding
- collision/reserved-word diagnostics

Use `@effect/cli` internally if it reduces duplication, but generated consumers must install only
documented runtime peers and must not need TypeWeaver's developer CLI at runtime. Do not flatten
arbitrary nested Zod bodies into flags in this goal.

Generate a command client from `packages/test-utils` and run process integration tests against a
real local TypeWeaver server. Cover public and secured operations, body modes, query/path values,
non-2xx responses, malformed input, network failure, and interruption.

**Verify:**

```sh
pnpm --filter @rexeus/typeweaver-command test
pnpm --filter @rexeus/typeweaver-command typecheck
pnpm --filter @rexeus/typeweaver-command build
pnpm --filter @rexeus/typeweaver test:gen
pnpm verify:packed-consumers
```

Expected: generated CLI process tests pass against a real local server and the packed package works
in a temporary consumer.

### 4. Add optional Effect-native server handlers

**Status:** DONE — the Fetch-native server exposes request cancellation, while the optional adapter
owns one Effect 3.22 `ManagedRuntime` at the application boundary and generates typed handler/error
mapper records for the existing routers. Runtime, type-contract, real Fetch-server, static-boundary,
diagnostic, documentation-example, generated-fixture, and packed-consumer proofs are complete.

Create `packages/effect` published as `@rexeus/typeweaver-effect`. Build on the existing
server/router contract rather than generating a second server stack. The public handler shape should
preserve request/response specificity and expose typed failure and service requirements:

```ts
type EffectRequestHandler<Request, Response, Error, Requirements> = (
  request: Request,
  context: ServerContext
) => Effect.Effect<Response, Error, Requirements>;
```

Refine names/generics as needed, but require these semantics:

- one `ManagedRuntime`/Layer owned at application or adapter boundary
- no runtime construction per request or generated artifact
- no `Effect.runPromise` inside individual user handlers
- request abort interrupts the running Effect
- typed handler errors map through an explicit user-configurable response mapper
- defects are sanitized and reported through the existing server error boundary
- operation ID, method, and route annotate spans/logs
- shutdown releases scoped services exactly once
- ordinary Promise handlers continue to work without importing Effect

Research exact APIs in the pinned Effect 3.22 source before implementation. Provide generated
handler types and an executable example with a service Layer, typed error, cancellation, and
graceful shutdown.

**Verify:**

```sh
pnpm verify:effect-reference
pnpm --filter @rexeus/typeweaver-effect test
pnpm --filter @rexeus/typeweaver-effect typecheck
pnpm --filter @rexeus/typeweaver-server test
pnpm effect:diagnostics
pnpm verify:packed-consumers
```

Expected: lifecycle and interruption tests pass; static checks find no per-handler runtime
construction or undocumented `runPromise` boundary.

### 5. Complete documentation and product examples

**Status:** DONE — root and package catalogs include the optional Effect adapter, the root guide
contains an explicit plain Fetch/Hono/generated CLI/Effect selection matrix, and documentation
verification executes the public plugin-scaffold, `init`, `validate`, and `doctor` process workflows
in addition to typechecking the generated command and Effect handler fixtures.

Update root/package docs and executable fixtures for:

- third-party plugin from scaffold to generated output
- `init`, `validate`, and `doctor`
- generated command client, security, body input, output, and exit codes
- Effect handler setup, Layer ownership, error mapping, cancellation, and shutdown
- explicit choice between plain server, Hono, generated CLI, and Effect adapter

Document Effect as optional and keep the native `HttpApi` direction in the non-goals/future-research
section. Every code path joins `docs:check`.

### 6. Perform the final evidence review

**Status:** DONE — `docs/reviews/product-maturity-evidence.md` maps every criterion through the
reviewed Stage 3 source head and records the fresh cross-dimensional review with both high-impact
findings resolved. The complete local gate passed at `42a1d157`; ready PR #212 targets `main` and
all quality-check, Windows security, CodeQL, and Socket checks passed at `e2041464`.

Create an English evidence report under `docs/reviews/` that maps every `GOAL.md` criterion to:

- implementing commit and file
- narrow test
- full-gate result
- generated or packed artifact
- PR check URL/status

Perform a fresh review across correctness, security, public TypeScript API, Effect practices, tests,
maintainability, plugin DX, OpenAPI, and documentation. Every critical or high-confidence
high-impact finding must be fixed and re-verified or recorded as a true blocker. Lower-priority
discoveries pass through the `GOAL.md` discovery gate.

Run the full gate, commit, push, and open a ready PR against `main`. Repair CI until all checks are
green. Record all three PR heads/bases/checks in `GOAL.md`. Do not merge the Stage 3 PR.

## Test plan

- Public plugin test-kit type/runtime tests and external packed scaffold.
- CLI unit, process, JSON-schema, atomic-write, rollback, and no-write tests.
- Generated command golden tests and real-server process integration tests.
- Effect handler type contracts, Layer lifecycle, typed failure, defect, interruption, shutdown,
  span, and plain-Promise compatibility tests.
- Executable docs for every new public workflow.
- Node/Deno/Bun bundles, packed consumers, publish dry run, Windows security CI, and the full
  repository gate.

## Done criteria

- [x] A scaffolded external plugin succeeds using only public APIs.
- [x] `init`, `validate`, and `doctor` are real, tested commands.
- [x] Generated command client passes real-server and packed-consumer tests.
- [x] Effect handlers satisfy runtime ownership, typed error, interruption, and observability
      requirements without affecting plain handlers.
- [x] All new public APIs have Changesets, migrations, and executable docs.
- [x] Final review report maps every goal criterion to evidence.
- [x] No unresolved critical or high-confidence high-impact finding remains in scope.
- [x] Full local gate and all GitHub checks pass.
- [x] Stage 3 PR targets `main`, is open, green, and unmerged.
- [x] The human-merged Stage 1 and 2 PRs, open Stage 3 PR, and plan/goal status are fully recorded.

## STOP conditions

Stop and report if:

- plugin testing requires exporting unsafe private orchestration internals
- CLI bootstrap would overwrite an existing file without explicit user intent
- generated command behavior requires inventing security outside the normalized contract
- Effect integration requires Effect Schema, native `HttpApi`, Effect 4, or Effect as a dependency
  of ordinary server users
- cancellation or scoped-resource release cannot be proven deterministically
- a packed consumer needs undeclared workspace-only dependencies
- the Stage 3 PR branch is remote-ahead/diverged or targets a base other than authorized `main`
- final review finds a critical/high issue with no safe in-scope fix

## Maintenance notes

The generated command package should remain a projection, not a parallel contract. The Effect
package should remain an adapter, not a competing server or schema system. Reviewers should
scrutinize process exit semantics, secret handling, runtime ownership, cancellation, package peer
dependencies, and whether the external plugin/consumer fixtures genuinely avoid workspace-only
shortcuts.
