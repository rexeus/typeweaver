# Define and deliver the Effect 4 compatibility path

## Outcome

TypeWeaver states and proves what works in an Effect 4 workspace today without misrepresenting
Effect-native interoperability, then migrates the plugin and adapter ecosystem as a coordinated line
only after Effect 4's stable contracts are available.

## Context and handoff

Issue #217 challenges the accepted Effect 3.22 baseline from ADR 0008. Research against pinned
Effect 3.22 and `effect@4.0.0-rc.115` showed that lifecycle types are not mutually assignable and
that each runtime rejects the other major's Effect values. `@rexeus/typeweaver-gen` exposes Effect
in its plugin ABI, and `@rexeus/typeweaver-effect` exposes it in generated handler/runtime
contracts. Core, plain generated clients/servers, and process-isolated CLI use can remain
independent of an application's Effect major.

As of 2026-09-16, Effect 4 is still an RC and its CLI lives under an unstable API. Phase A is ready
for planning and delivery. Phase B is conditional work, not an immediate compatibility promise.

## Related plans

- **Roadmap:** [004](004-post-maturity-roadmap.md)
- **Previous milestone:** [008](008-generate-check-216.md)
- **Dependencies:** phase B requires stable Effect 4, aligned platform/testing/tooling releases, and
  a separately approved baseline ADR.

## Scope

### In scope

- Phase A compatibility matrix for Core authoring, CLI generation, plain generated output, plugin
  authoring, and Effect adapter use.
- A packed Effect 4 consumer proving isolated CLI generation without duplicate-runtime confusion.
- `doctor`, package docs, and release notes that agree with the matrix.
- A superseding ADR and coordinated migration plan once phase B entry criteria are met.

### Out of scope

- Broadening current peers to `>=3.22.0 <5`.
- Executing Effect 4 values in an Effect 3 plugin runtime or vice versa.
- Native Effect `HttpApi`, Effect Schema authoring, or mandatory Effect for plain consumers.
- Publishing a durable compatibility range against an Effect 4 RC.

## Decisions

- **Keep the current 0.13 line on Effect 3** — its public plugin ABI and adapter are Effect-native;
  widening the peer range would be both type- and runtime-unsound.
- **Prove the exact `effect@4.0.0-rc.115` binary-CLI path through process isolation now** — the CLI
  owns a nested Effect 3 runtime and can generate Effect-independent outputs from Effect-neutral
  inputs without sharing the application's runtime. Every other Effect 4 version is unverified.
- **Use a coordinated Effect 4 TypeWeaver line after upstream stability** — migrate gen, first-party
  plugins, CLI, and the adapter together rather than multiplying every plugin into v3/v4 packages.
- **Retain the previous TypeWeaver line for Effect 3 consumers** — simultaneous majors in one
  package are not promised. Revisit only if the product explicitly funds an Effect-neutral plugin
  ABI and per-major bridges as a separate architecture project.

## Plan

- [x] 1. **Phase A: record the compatibility matrix in an ADR**
  - **Outcome:** users can distinguish independent, process-isolated, and Effect-native surfaces.
  - **Evidence:** [ADR 0010](../docs/adr/0010-effect-4-workspace-compatibility.md) is accepted and
    supplements ADR 0008; `docs/README.md`, the CLI/gen/effect package READMEs,
    `docs/plugin-authoring.md`, `MIGRATION.md`, and the root README state the same supported ranges
    and exclusions. `pnpm verify:effect-version` enforces the exact metadata, unchanged v3
    runtime/peers, CLI dependency/no Effect peer, gen/effect v3 peers, and the ADR/docs matrix
    tokens.
- [x] 2. **Phase A: add packed Effect 4 workspace evidence**
  - **Outcome:** an app on the selected exact Effect 4 version installs the TypeWeaver CLI as build
    tooling and generates plain outputs without unresolved peers or runtime-identity crossing.
  - **Evidence:** `scripts/test-packed-consumers.mjs` packs pnpm fixtures with strict peers and
    overrides for every packed TypeWeaver tarball. A minimal fixture (packed CLI + core, exact
    `effect@4.0.0-rc.115`, Zod and TypeScript tooling, no Hono) proves the Hono peer became optional
    and install succeeds. A second fixture adds Hono and generates all advertised plain projections
    (`types`, `clients`, `server`, `hono`, `command`, `openapi`, `aws-cdk`) through
    `pnpm exec typeweaver`; it asserts each projection output exists, scans every generated
    TypeScript/JavaScript module specifier (static, side-effect, re-export, dynamic import, and
    `require`) for forbidden `effect`/gen/effect-adapter imports, typechecks and runs an application
    module that imports both `effect@4.0.0-rc.115` and the generated output, runs `doctor` asserting
    `TW-DOCTOR-008` pass and the `TW-DOCTOR-011` exact-pin conditional warning, proves only the
    application anchor resolves the RC while every effect-declaring installed TypeWeaver package in
    the CLI subtree resolves one Effect 3 realpath (exactly two physical identities), proves
    gen/effect are unavailable phantom imports, and rejects a strict-peer Effect 4 install of the
    packed gen/effect packages.
- [ ] 3. **Phase A: deliver a dedicated compatibility PR**
  - **Outcome:** the current release line makes no misleading Effect 4 promise.
  - **Evidence:** docs, doctor, packed consumers, Effect diagnostics, focused tests, and the
    repository gate pass locally; the milestone stays IN PROGRESS until the dedicated PR's required
    checks pass.
- [ ] 4. **Phase B entry gate: confirm stable upstream contracts** — **BLOCKED: Effect 4 is still
      `4.0.0-rc.115`; no stable release or aligned platform/CLI toolchain exists.**
  - **Outcome:** exact stable Effect, platform, CLI, Vitest, language-service, and source-reference
    versions are selected before production migration.
  - **Evidence:** not started. Phase A pins the RC only as workspace evidence.
- [ ] 5. **Phase B: supersede ADR 0008 and port generator infrastructure** — **BLOCKED by work
      package 4.**
  - **Outcome:** services, layers, scopes, Cause handling, platform APIs, and scoped-plugin state
    have Effect 4-native implementations with preserved lifecycle/concurrency behavior.
  - **Evidence:** not started.
- [ ] 6. **Phase B: port plugins, CLI, and Effect adapter in dependency order** — **BLOCKED by work
      package 4.**
  - **Outcome:** all Effect-integrated packages share one Effect 4 identity while independent
    outputs remain Effect-free.
  - **Evidence:** not started.
- [ ] 7. **Phase B: publish migration guidance for the coordinated line** — **BLOCKED by work
      package 4.**
  - **Outcome:** Effect 3 users have an explicit supported previous line and Effect 4 users have one
    coherent upgrade path.
  - **Evidence:** not started.

## Risks and open questions

- **Scoped plugin state** — Effect 4 removes the current `FiberRef`/scope arrangement; phase B needs
  a design that preserves concurrent per-call isolation before implementation.
- **Future major lockstep** — retaining an Effect-native plugin ABI means future Effect majors still
  coordinate gen and plugins. An Effect-neutral ABI is the stronger long-term boundary but is a much
  larger product decision.
- **RC test pin** — phase A may pin one RC only as workspace evidence; it must not imply support for
  all RCs or stable Effect 4.

## References

- [Issue #217](https://github.com/rexeus/typeweaver/issues/217) — compatibility goals and questions.
- [`config/effect-baseline.json`](../config/effect-baseline.json) — current version authority.
- [ADR 0008](../docs/adr/0008-effect-v3-baseline.md) — accepted Effect 3 contract.
- [`Plugin.ts`](../packages/gen/src/plugins/Plugin.ts) — Effect-native plugin lifecycle ABI.
- [`runtime.ts`](../packages/effect/src/runtime.ts) — Effect-native generated handler boundary.
