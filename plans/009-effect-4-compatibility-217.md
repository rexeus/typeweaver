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
- **Support Effect 4 workspaces through process isolation now** — the CLI owns a nested Effect 3
  runtime and can generate Effect-independent outputs without sharing the application's runtime.
- **Use a coordinated Effect 4 TypeWeaver line after upstream stability** — migrate gen, first-party
  plugins, CLI, and the adapter together rather than multiplying every plugin into v3/v4 packages.
- **Retain the previous TypeWeaver line for Effect 3 consumers** — simultaneous majors in one
  package are not promised. Revisit only if the product explicitly funds an Effect-neutral plugin
  ABI and per-major bridges as a separate architecture project.

## Plan

- [ ] 1. **Phase A: record the compatibility matrix in an ADR**
  - **Outcome:** users can distinguish independent, process-isolated, and Effect-native surfaces.
  - **Evidence:** ADR, package READMEs, `doctor`, and release notes state identical supported ranges
    and exclusions.
- [ ] 2. **Phase A: add packed Effect 4 workspace evidence**
  - **Outcome:** an app on the selected exact Effect 4 version installs the TypeWeaver CLI as build
    tooling and generates plain outputs without unresolved peers or runtime-identity crossing.
  - **Evidence:** packed pnpm consumer test verifies install graph, CLI process execution,
    generation, and plain output typecheck; it also proves plugin/adapter imports remain
    intentionally rejected.
- [ ] 3. **Phase A: deliver a dedicated compatibility PR**
  - **Outcome:** the current release line makes no misleading Effect 4 promise.
  - **Evidence:** docs, doctor, packed consumers, Effect diagnostics, full repository gate, and CI
    pass.
- [ ] 4. **Phase B entry gate: confirm stable upstream contracts**
  - **Outcome:** exact stable Effect, platform, CLI, Vitest, language-service, and source-reference
    versions are selected before production migration.
  - **Evidence:** no RC or unstable CLI dependency remains in the proposed public support contract;
    otherwise phase B stays blocked.
- [ ] 5. **Phase B: supersede ADR 0008 and port generator infrastructure**
  - **Outcome:** services, layers, scopes, Cause handling, platform APIs, and scoped-plugin state
    have Effect 4-native implementations with preserved lifecycle/concurrency behavior.
  - **Evidence:** focused migration tests prove per-call isolation, acquisition/release,
    interruption, issue ordering, and no duplicate runtime identity.
- [ ] 6. **Phase B: port plugins, CLI, and Effect adapter in dependency order**
  - **Outcome:** all Effect-integrated packages share one Effect 4 identity while independent
    outputs remain Effect-free.
  - **Evidence:** packed plugin consumer, generated projects, adapter
    lifecycle/failure/abort/shutdown, Node/Deno/Bun, Windows, and full release gates pass.
- [ ] 7. **Phase B: publish migration guidance for the coordinated line**
  - **Outcome:** Effect 3 users have an explicit supported previous line and Effect 4 users have one
    coherent upgrade path.
  - **Evidence:** package peers, baseline config, doctor, docs, Changesets, and release notes agree.

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
