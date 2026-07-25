# Effect migration: merge-ready completion contract

Status: active  
Audit baseline: `feat/use-effect` at `7488f6d2`, reviewed 2026-07-25  
Runtime baseline: Node 24, pnpm 10, Effect 3.22

## Goal

Make the Effect migration on `feat/use-effect` safe, internally consistent, and merge-ready: dynamic
boundaries must be truthful, lifecycle and resource semantics must hold under concurrency, failure,
defect, and interruption, and the public plugin/CLI contracts must be proven by tests against
packaged artifacts.

## Why

This is a breaking architectural migration in a generator that reads external code and mutates
output trees. Green unit tests alone are not enough: typed failures, exclusive ownership, cleanup,
plugin lifecycle ordering, and consumer compatibility must be real runtime guarantees. When two
implementation paths compete, prefer the smaller design that makes those guarantees mechanically
provable without hiding failures or widening the public API accidentally.

## Audit baseline

The migration is substantial rather than a Promise-to-Effect wrapper:

- services and dependencies are explicit and composed at the runtime edge;
- per-generation plugin registry and file-tracker state are isolated;
- output locking and temporary directories use Effect resource scopes;
- domain failures are mostly typed and observable through tags;
- plugin phases, logs, and spans are explicit;
- normalization, concurrency, lifecycle, path safety, generated output, and consumer compilation
  already have meaningful tests.

The branch is not merge-ready yet. The review found no Critical issue, but the following High-risk
contracts are not currently proven:

- output-lock acquisition and release do not carry an ownership token, allowing a second process to
  reclaim a live but not-yet-initialized lock;
- dependent plugins are finalized in initialization order instead of reverse dependency order;
- config imports and plugin modules are asserted to be typed after only shallow object/name checks;
- the documented service-dependent plugin construction path is not executable through the standard
  loader;
- CLI process behavior and interrupt/defect cleanup are under-tested.

Current diagnostic coverage is useful but is not a completion target:

- `@rexeus/typeweaver-gen`: 296 tests; 88.91% lines, 91.33% branches;
- `@rexeus/typeweaver`: 217 tests; 83.86% lines, 89.34% branches.

Coverage percentages must not be raised by trivial tests. Completion is based on the risky behaviors
below.

## Done

Complete these criteria in order. Mark an item `[x]` only after recording its evidence in the
progress log.

### P0 — safety and truthful boundaries

- [x] **1. Output-lock ownership is race-safe.**

  Acquisition assigns an unguessable ownership token, partial metadata is never treated as dead
  crash debris while its owner may still be acquiring, failed acquisition rolls back only its own
  state, and release removes only the lock owned by its token.

  Verified by:

  - deterministic tests pause between lock-directory creation and metadata publication and prove
    that exactly one of two contenders can enter;
  - tests prove that an old owner cannot release a replacement owner's lock;
  - tests cover unreadable/partial metadata and acquisition-write failure;
  - `pnpm --filter @rexeus/typeweaver exec vitest run __test__/generator.lockfile.test.ts` exits 0.

- [x] **2. Plugin cleanup follows reverse successful initialization order.**

  For `B depends on A`, initialization is `A, B` and finalization is `B, A`. Only successfully
  initialized plugins are finalized, every such plugin gets one cleanup attempt, and cleanup still
  runs after typed failure, defect, and Fiber interruption.

  Verified by:

  - dependency-chain tests assert the exact phase sequence;
  - deterministic typed-failure, defect, and `Fiber.interrupt` tests assert the finalizer set and
    order;
  - `pnpm --filter @rexeus/typeweaver exec vitest run __test__/generator.lifecycle-ordering.test.ts`
    exits 0.

- [x] **3. Imported configuration is parsed instead of asserted.**

  The import boundary validates all known fields (`input`, `output`, `format`, `clean`, and every
  plugin entry/tuple) while preserving supported custom top-level plugin configuration. Invalid
  known fields produce a precise typed config failure and no defect.

  Verified by:

  - table and property tests cover invalid primitive, array, tuple, path, and boolean/string shapes;
  - each case asserts the error tag and `Cause.defects(cause).length === 0`;
  - valid custom top-level keys survive parsing;
  - `pnpm --filter @rexeus/typeweaver test -- ConfigLoader` exits 0.

- [x] **4. Imported plugins are structurally decoded before registration.**

  A plugin requires a non-empty name; `depends` is absent or a string array; and every present
  lifecycle hook is a function. Invalid default exports and factory results fail as a detailed
  `PluginLoadError`, never as a later defect or a silently skipped hook.

  Verified by:

  - loader tests cover every invalid field independently for records and factory results;
  - invalid plugins are never registered or invoked;
  - each failure has an empty defect list;
  - `pnpm --filter @rexeus/typeweaver test -- PluginLoader` exits 0.

- [ ] **5. The public plugin-construction contract has one executable truth.**

  Decide and implement exactly one of these contracts:

  1. the standard loader supports Effect-returning factories with documented Layer/Scope lifetime;
     or
  2. factories remain pure and synchronous, lifecycle methods keep `R = never`, and the guide
     demonstrates a tested internal Layer-provision path.

  Documentation, types, examples, and runtime behavior must describe the same contract. Do not keep
  both contradictory models.

  Verified by:

  - a fixture plugin using the documented service pattern loads and generates successfully through
    the built CLI;
  - its resource is acquired once and released after plugin finalization;
  - the plugin-authoring examples compile in the documentation/consumer test;
  - `pnpm --filter @rexeus/typeweaver test -- PluginLoader` and the built-CLI fixture test exit 0.

### P1 — explicit type and failure contracts

- [ ] **6. Public error types cannot drift from runtime behavior.**

  `GenerateFailure` is derived from or checked for exact equality with the actual
  `Generator.generate` error channel and includes `OutputCleanError`. The public CLI error export is
  either made accurate and side-effect-free or removed from the documented API.

  `PluginDependencyError` and `UnsafeCleanTargetError` use discriminated payloads so impossible
  field combinations cannot be constructed and message rendering needs no missing-field fallback.

  Verified by:

  - positive and negative compile-time tests prove the allowed payloads;
  - a type-equality assertion binds `GenerateFailure` to the method channel;
  - `pnpm typecheck` exits 0.

- [ ] **7. Test TypeScript is part of the compiler gate.**

  Add package test TypeScript configurations or an equivalent type-test setup covering test sources,
  public plugin-author APIs, Effect requirements, error channels, and negative `@ts-expect-error`
  contracts.

  Verified by:

  - a root script typechecks production and test sources;
  - removing one expected type error makes that script fail;
  - CI invokes the script;
  - the script and `pnpm typecheck` exit 0.

- [ ] **8. Expected formatter and filesystem failures remain typed.**

  Operational formatter errors and expected in-memory/Node filesystem errors are represented in the
  typed failure channel. `orDie`/throwing `Effect.sync` is reserved for documented broken
  invariants.

  Verified by:

  - permission/missing-path/failing-formatter tests assert typed errors and zero defects;
  - a shared filesystem contract suite runs against the in-memory test layer and the Node filesystem
    layer;
  - `rg "Effect\\.orDie|Effect\\.sync" packages/cli/src packages/gen/src` has no unexplained
    expected-I/O conversion to defects;
  - relevant CLI and gen tests exit 0.

### P1 — observable entrypoint behavior

- [ ] **9. The built CLI process contract is covered end to end.**

  Spawn the built Node CLI and verify success output, generated files, missing required options,
  invalid config, duplicate/domain validation, conflicting flags, `--verbose`, exit codes, and
  stderr/stdout ownership. Test `runGenerate` wiring rather than only service internals.

  Verified by:

  - process tests execute `dist/index.mjs` rather than importing source;
  - every documented failure class has an asserted exit code and stable output contract;
  - `pnpm --filter @rexeus/typeweaver build` and the process test suite exit 0.

- [ ] **10. Interruption and defect recovery is proven across resources.**

  Deterministic tests interrupt or defect during bundling, initialization, transformation,
  generation, formatting, and atomic output replacement. The output lock, scoped temp directories,
  and initialized plugins are cleaned up, and a second generation in the same process succeeds.

  Verified by:

  - tests use latches/deferred synchronization, not timing sleeps;
  - filesystem assertions prove no owned lock/temp artifact remains;
  - a repeated run after every injected failure succeeds;
  - targeted lifecycle, lock, and bundler suites pass 20 consecutive runs.

### P2 — maintainability and representative architecture

- [ ] **11. Generator orchestration is split at stable domain seams.**

  Extract only the cohesive preflight/lock scope, plugin lifecycle, and postprocessing workflows
  needed to make their contracts independently readable and testable. Do not fragment the pipeline
  into one-line wrappers.

  Verified by:

  - `Generator.generate` remains the single top-level orchestration operation;
  - the three contracts above have focused unit tests;
  - no public API or generation fixture changes unless explicitly documented;
  - lint, typecheck, generation fixtures, and lifecycle tests exit 0.

- [ ] **12. Effect observability and first-party usage match the architecture.**

  Reusable service operations have stable `Effect.fn` names. At least one first-party plugin is the
  reference implementation for the Effect-native context I/O surface; synchronous compatibility
  helpers remain separately tested.

  Verified by:

  - span tests assert stable service and plugin hierarchy;
  - the reference plugin's integration test exercises Effect-native write and render operations;
  - no production service creates or runs a local runtime;
  - `rg "runPromise|runSync|ManagedRuntime\\.make" packages/*/src` shows only approved runtime-edge
    occurrences.

- [ ] **13. Weak tests are replaced, not accumulated.**

  Replace the fixed-case "diamond" property test with a generated graph property or a focused
  example. Remove or strengthen MainLayer tests that only restate type construction. Introduce
  shared factories to eliminate duplicated plugin/context fixtures where doing so preserves local
  readability.

  Verified by:

  - every property-test generator influences the assertion;
  - mutation of dependency ordering, finalizer ordering, or path validation causes a relevant test
    to fail;
  - no new unsafe test `any`, double cast, or compiler suppression exists without a line-level
    rationale;
  - all package tests exit 0.

- [ ] **14. Effect tooling and reference sources are version-correct.**

  The repo must not silently review Effect 3.22 production code against an unpinned Effect 4 beta
  checkout. Make the reference strategy reproducible and add a guard that detects a major/version
  mismatch. Update ADR 0008, migration docs, package READMEs, and plugin-authoring docs to
  consistently state Effect 3.22 and the intentional peer range.

  Configure a compatible Effect language-service diagnostic command and run it in CI.

  Verified by:

  - `scripts/prepare-effect.sh` checks out a documented, reproducible reference;
  - an automated version guard fails on an accidental Effect 4-only reference;
  - `pnpm effect:diagnostics` exists and exits 0;
  - `rg "3\\.21|Effect 4|effect@beta" docs MIGRATION.md README.md` returns only explicitly
    historical or comparison text;
  - docs build/link checks, lint, and typecheck exit 0.

### P3 — packaged consumers and release evidence

- [ ] **15. Packaged consumers prove dependency compatibility.**

  Pack the publishable workspaces into isolated fixtures. A minimal plugin author imports public
  types, compiles, loads through the CLI, and generates output with Effect 3.22 and with the
  documented lowest supported peer version. The test must fail on duplicate/incompatible Effect
  identities.

  Verified by:

  - isolated installs use packed tarballs, not workspace symlinks;
  - both supported-version fixtures typecheck and execute;
  - `pnpm publish:dry` exits 0.

- [ ] **16. Security-sensitive behavior runs on Windows CI.**

  Add a Windows job covering clean-target guards, path safety, output locking, and a built-CLI smoke
  test. Keep the complete existing Ubuntu runtime matrix.

  Verified by:

  - workflow validation exits 0 locally;
  - after human-authorized push, both Ubuntu and Windows quality jobs are green;
  - no platform test is skipped merely because path semantics differ.

- [ ] **17. One reproducible migration gate proves the final state.**

  Add `pnpm verify:effect-migration` as a non-mutating umbrella check used by CI. It must run the
  migration-specific type contracts, unit/integration/process tests, generated-fixture verification,
  and version/reference checks.

  Final local evidence:

  ```sh
  source /Users/denniswentzien/.nvm/nvm.sh
  nvm use 24
  pnpm install --frozen-lockfile
  pnpm format:check
  pnpm lint
  pnpm typecheck
  pnpm build
  pnpm test
  pnpm verify:generated
  pnpm verify:effect-migration
  pnpm --filter @rexeus/typeweaver test:bundle:all
  pnpm publish:dry
  git diff --check
  ```

  Completion also requires all human-authorized remote CI jobs to be green and every audit finding
  above to be closed by code/test evidence or an explicit human-approved scope decision recorded in
  this file.

## Constraints

- Keep production on Effect 3.22; do not migrate to Effect 4 in this goal.
- Preserve documented generated output and public behavior unless a deliberate breaking correction
  has a Changeset, migration note, and consumer test.
- Preserve the broad Effect peer range only if the packed-consumer matrix proves it. Evidence wins
  over the desired range.
- Never replace a typed expected failure with a defect to make signatures green.
- Do not introduce unbounded `any`, blanket casts, disabled tests, lowered compiler strictness,
  ignored lints, or reduced quality gates.
- Do not use coverage percentage as a proxy for behavioral quality.
- Keep changes inside the Effect-migration surface and its verification infrastructure; unrelated
  cleanup is discovered work, not automatic scope.

Verified on every iteration by the narrowest relevant checks, and before DONE by the complete
command block in criterion 17.

## Boundaries

May change:

- Effect migration code and tests in `packages/gen`, `packages/cli`, `packages/test-utils`, and
  first-party plugin packages;
- documentation describing configuration, plugins, lifecycle, Effect version, and CLI/programmatic
  usage;
- root/package TypeScript, test, lint, and Effect diagnostic configuration;
- generation fixtures, consumer fixtures, scripts, and CI workflows needed to verify this goal;
- Changesets required by an intentional public contract correction.

Do not change without separate human approval:

- unrelated feature behavior or generated schemas;
- package names, repository ownership, release channels, or npm provenance;
- application/site work outside the migration;
- the base branch history.

## Irreversible actions

Human approval is required; never execute automatically:

- push, force-push, branch deletion, or merge;
- opening, updating, approving, or merging a pull request;
- publishing packages or creating a release/tag;
- deployment or external service mutation;
- destructive cleanup outside explicit test fixtures.

Local commits are allowed only when the human explicitly requests them.

## Iteration policy

1. Re-read this file at the start of every iteration.
2. Take the first incomplete, non-blocked criterion.
3. Record the current failing evidence before changing code.
4. Make the smallest cohesive change that advances that criterion.
5. Run the narrow verification first, then affected package gates.
6. Mark the criterion complete only when all listed checks are green and append exact evidence
   below.
7. Do not switch criteria mid-iteration. Queue discoveries instead.
8. Prefer encoding every repaired contract in a durable test or static check.

## Discovered work

New findings land here first with severity, evidence, relation to the Goal/Why, and a proposed
machine check. Finish the current criterion before considering promotion.

Promote a discovery into the ordered Done backlog only when:

1. it protects the stated migration safety/contract anchor;
2. it is reproducible;
3. completion can be checked mechanically; and
4. it fits the stated boundaries.

Otherwise leave it here for human triage.

<!-- Append discoveries below. Do not rewrite prior entries. -->

## Progress log

Append one entry per iteration:

```text
[iteration N | date]
criterion:
before:
change:
evidence:
next:
```

<!-- Append progress below. Do not rewrite prior entries. -->

```text
[iteration 1 | 2026-07-25]
criterion: 1. Output-lock ownership is race-safe.
before: Two new regression tests failed: an unpublished lock was reclaimed and metadata-write
        failure left the acquired directory behind.
change: Added atomic candidate-to-info metadata publication, UUID ownership handles, fail-closed
        unknown metadata, token-checked release, acquisition rollback, and token-derived stale-lock
        fences that prevent delayed reclaimers from moving a replacement lock.
evidence: lockfile suite 11/11; complete CLI suite 224/224; root lint green; CLI typecheck green;
          CLI build green; format check and git diff check green.
next: Criterion 2, reverse successful plugin finalization with failure/defect/interrupt cleanup.
```

```text
[iteration 2 | 2026-07-25]
criterion: 2. Plugin cleanup follows reverse successful initialization order.
before: Four lifecycle assertions failed: finalizers ran dependency-first, and Fiber interruption
        skipped plugin finalization entirely.
change: Attached cleanup with Effect.onExit so it is uninterruptible across success, typed failure,
        defect, and interruption; finalized the successful initialization stack in reverse order;
        captured each finalizer Exit so one defect cannot skip the remaining cleanup attempts, then
        replayed accumulated defects after every finalizer ran.
evidence: lifecycle suite 7/7 including dependency-chain, typed failure, defect, interruption, and
          finalizer-defect cases; complete CLI suite 227/227; root format and lint green; CLI
          typecheck and build green; git diff check green.
next: Criterion 3, parse imported configuration fields into a truthful typed boundary.
```

```text
[iteration 3 | 2026-07-25]
criterion: 3. Imported configuration is parsed instead of asserted.
before: Ten known-field regression cases were accepted as Partial<TypeweaverConfig>; malformed
        paths, booleans, plugin arrays, and plugin tuples crossed the import boundary without a
        typed failure.
change: Added an Effect 3.22 Schema decoder for every known config field, preserved supported
        unknown top-level keys, introduced InvalidConfigValueError with the complete ParseError,
        and added table plus fast-check coverage for invalid boundary values.
evidence: config loader suite 40/40 including 40 generated cases; complete CLI suite 239/239;
          root lint and format check green; CLI typecheck and build green; git diff check green.
next: Criterion 4, structurally decode imported plugins before registration.
```

```text
[iteration 4 | 2026-07-25]
criterion: 4. Imported plugins are structurally decoded before registration.
before: Sixteen new assertions failed: twelve invalid depends/hook shapes were registered as
        plugins, while four invalid-name cases lacked field-specific diagnostics.
change: Replaced the name-only type predicate and factory cast with a cast-free decoder that
        constructs Plugin only after validating a non-blank name, every dependency entry, and all
        lifecycle hooks; added detailed field/index diagnostics and record/factory tripwire tests.
evidence: plugin loader suite 48/48 with 20 invalid-shape matrix cases and a real .mjs boundary
          fixture; complete CLI suite 260/260; root lint and format check green; CLI typecheck and
          build green.
next: Criterion 5, make the documented plugin-construction contract executable and singular.
```

## Stop conditions

- **Done:** all 17 criteria are checked with recorded evidence, the final local command block is
  green, and human-authorized remote CI is green.
- **Iteration cap:** stop after 24 implementation iterations and report the remaining criteria,
  evidence, and recommended next sequence.
- **Budget:** use the runner-provided budget. Budget exhaustion is not completion; stop with
  progress, blockers, and the next smallest useful step.
- **No progress:** stop after two consecutive iterations that produce neither a code/evidence change
  nor a newly reproducible blocker.
- **Circuit breaker:** after three failures of the same tool or external resource, stop retrying it
  and report the exact command, errors, and an alternative verification path.
- **Blocked:** if no defensible in-boundary path remains, record attempted paths, evidence, the
  blocker, and the concrete human input or external change that would unlock progress.
- **Human checkpoint:** stop before every irreversible action listed above.
