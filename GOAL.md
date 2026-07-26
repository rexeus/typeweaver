# TypeWeaver Product Maturity Goal

## Goal

Turn TypeWeaver into a truthfully documented, end-to-end type-safe API-first platform whose
executable contract can produce validated OpenAPI profiles, a usable command-line client, and an
optional Effect-native handler surface without framework or Effect lock-in.

## Why

TypeWeaver already has a strong generation engine, an Effect-native plugin orchestrator, and
meaningful integration tests. The next product milestone is not another isolated generator. It is a
coherent public contract that users can understand, validate, extend, and project into multiple
developer surfaces without hidden type holes or undocumented assumptions.

When two implementation paths compete, prefer the one that makes the TypeWeaver contract more
truthful, portable, deterministic, and useful to API-first developers. Effect should improve
implementation safety and composability while remaining optional for TypeWeaver consumers.

## Starting point

- This goal was planned at commit `3c97d402` on 2026-07-26.
- The planning PR contains only this goal and the plans under `plans/`.
- Do not start implementation until the planning PR has been merged into `main`.
- At the start of execution, fetch `origin`, switch to `main`, and require a clean fast-forward to
  `origin/main`.
- Read this file and the current stage plan completely at the start of every iteration.
- TypeWeaver's active Effect baseline is Effect 3.22.0 with public peer range `>=3.22.0 <4`. Verify
  it with `pnpm verify:effect-reference` before relying on vendored Effect APIs.

## Delivery model

The implementation is delivered as three stacked pull requests. The loop may implement, commit,
push, create or update these pull requests, and repair their CI. It must never merge them.

| Stage | Plan                                         | Branch                               | Pull request base                    |
| ----- | -------------------------------------------- | ------------------------------------ | ------------------------------------ |
| 1     | `plans/001-product-truth-and-type-safety.md` | `feat/product-truth-and-type-safety` | `main`                               |
| 2     | `plans/002-contract-and-openapi-maturity.md` | `feat/contract-and-openapi-maturity` | `feat/product-truth-and-type-safety` |
| 3     | `plans/003-developer-surfaces.md`            | `feat/developer-surfaces`            | `feat/contract-and-openapi-maturity` |

After a stage is locally complete:

1. Run every stage gate and the full repository gate.
2. Commit all stage work as logical Conventional Commits.
3. Push the stage branch with a normal push.
4. Open a ready-for-review pull request against the base in the table.
5. Inspect all pull-request checks and repair failures until every required check is green.
6. Record the PR URL, head commit, checks, and evidence in this file.
7. Create the next stage branch from the completed current stage head. Do not wait for or perform a
   merge.

If a named branch or PR already exists, inspect it before changing anything. Reuse it only when it
represents this goal and has not diverged. Never force-push.

## Done criteria

Complete the criteria in order. A criterion is complete only when its verification is recorded in
the progress log with the relevant commit or artifact.

### Stage 1: Product truth and type safety

- [x] `VISION.md` defines the product promise, users, principles, non-goals, north-star workflow,
      and measurable success signals.
  - Verify: `pnpm docs:check` exits 0 and the required-section test introduced by Plan 001 passes.
- [x] Root, package, contributor, and architecture documentation matches the actual packages,
      Node/pnpm toolchain, tsdown, Oxlint/Oxfmt, CLI surface, Effect baseline, and implemented
      architecture.
  - Verify: repository truth checks introduced by Plan 001 pass; ADR 0001 and ADR 0002 no longer
    contain unresolved implemented decisions or invalid `defineSpec` examples.
- [x] Public documentation examples are executable or typechecked fixtures, not unchecked Markdown
      claims.
  - Verify: the new documentation-example command exits 0 and is called by `pnpm docs:check` and CI.
- [x] Unsupported Zod schemas never silently become generated `unknown` types.
  - Verify: `@rexeus/typeweaver-zod-to-ts` tests cover every intentionally unsupported schema kind
    and assert stable actionable failures.
- [x] Public HTTP body contracts and generated server/Hono declarations contain no implicit `any`.
  - Verify: public type-contract tests prove the body types are not `any`, and generated fixtures
    compile on Node, Deno, and Bun.
- [x] Stage 1 has a Changeset for every changed published contract, migration notes for breaking
      changes, a green full gate, and an open green PR targeting `main`.

### Stage 2: Contract and OpenAPI maturity

- [x] The authoring and normalized models expose generator-neutral API metadata and a first-class
      security contract with documented inheritance and explicit public-operation semantics.
  - Verify: core/gen unit tests, type tests, generated fixtures, and the accepted contract ADR from
    Plan 002 all agree.
- [x] The plugin contract has a side-effect-free validation phase with stable, structured issues and
      no write-capable validation context.
  - Verify: compile-time context tests and PluginRegistry lifecycle tests pass; existing plugins
    remain source compatible unless a documented breaking change is intentional.
- [x] OpenAPI supports explicit `3.1.2` and `3.2.0` targets, defaults to the documented
      compatibility target, projects contract metadata/security, and reports representability loss
      with stable diagnostic codes.
  - Verify: both generated profiles pass the declared validator matrix; warning registry
    exhaustiveness tests pass.
- [x] OpenAPI's documented support matrix explicitly distinguishes supported, lossy, and
      out-of-scope features. It does not claim bidirectional Zod/OpenAPI/Effect Schema
      round-tripping.
  - Verify: `pnpm docs:check` and the OpenAPI package tests pass.
- [ ] Stage 2 has appropriate Changesets and migration notes, a green full gate, and an open green
      PR targeting the Stage 1 branch.

### Stage 3: Developer surfaces

- [ ] A third-party plugin can be scaffolded, tested, and generated through a documented public
      starter path without copying private test internals.
  - Verify: scaffold golden tests and a packed external plugin consumer pass.
- [ ] The TypeWeaver CLI provides real `init`, `validate`, and `doctor` workflows with stable human
      and JSON diagnostics; `init` is no longer a stub.
  - Verify: process tests cover success, failure, no-write validation, JSON schema, and atomic
    bootstrap behavior on supported runtimes.
- [ ] `@rexeus/typeweaver-command` generates a command-line API client with one command per
      operation, deterministic flags, body file/stdin support, structured output, documented exit
      codes, and contract-derived security.
  - Verify: generate a CLI from the test project, run it against a real local TypeWeaver test
    server, and assert success, validation, authentication, HTTP failure, network failure, and
    cancellation behavior.
- [ ] `@rexeus/typeweaver-effect` provides Effect-returning handlers for the existing Fetch-native
      server with one managed runtime at the application boundary, typed failures, service
      requirements, interruption on request abort, and operation spans.
  - Verify: Effect diagnostics, type-contract tests, lifecycle tests, and packed consumer tests pass
    without a per-request runtime or per-handler `Effect.runPromise`.
- [ ] All public guides describe the shipped behavior and every new public workflow has an
      executable example.
- [ ] A final evidence report maps every claim in this goal to commands, artifacts, commits, and PR
      checks and records an independent review with no unresolved critical or high-confidence
      high-impact finding in scope.
- [ ] Stage 3 has appropriate Changesets and migration notes, a green full gate, and an open green
      PR targeting the Stage 2 branch.

### Final stack

- [ ] All three PRs are open, use the exact stacked bases above, and are not merged.
- [ ] Every required check on every PR is green at its recorded head commit.
- [ ] `plans/README.md` and this file show all three stages as complete with evidence.
- [ ] No criterion was waived merely because the implementation became difficult. Any intentionally
      rejected feature is recorded as a product non-goal with evidence and reviewer-visible
      rationale.

## Full repository gate

Run the narrow checks required by the current work package first. Before completing each stage, run
all of the following from a clean checkout with Node 24 and pnpm 10.34.5:

```sh
pnpm install --frozen-lockfile
pnpm verify:effect-reference
pnpm build
pnpm install --frozen-lockfile
pnpm test:gen
pnpm --filter @rexeus/typeweaver test:bundle:all
pnpm typecheck
pnpm verify:effect-migration
pnpm docs:check
pnpm format:check
pnpm lint
pnpm test
pnpm publish:dry
git status --short
```

Expected result: every command exits 0 and the final status contains only the intentional
goal/progress updates that will be committed. Run the Windows security workflow through GitHub CI
for each PR.

## Constraints

- Breaking public API changes are allowed because the project is pre-1.0, but they must improve the
  durable contract, have type/runtime tests, include a Changeset, and document migration from the
  previous shape.
- Preserve deterministic generation, path-safety, transactional publication, per-call isolation,
  structured Effect errors, and the existing Node/Deno/Bun runtime contract.
- Effect remains pinned to 3.22.0 for development with peer range `>=3.22.0 <4`. Effect 4 APIs are
  forbidden.
- Do not introduce `any`, unsafe assertions, ignored TypeScript errors, skipped tests, muted lints,
  or validation bypasses to make a gate green.
- Do not install ESLint. Maintainability enforcement stays on Oxlint/Oxfmt and the existing
  SonarJS-compatible Oxlint configuration.
- Prefer `unknown` plus validation at external boundaries.
- Do not make Effect mandatory for core, client, Hono, or plain server users.
- Do not build a full OpenAPI importer, ORM, authentication provider, business logic generator,
  native Effect `HttpApi` backend, or lossless Zod/OpenAPI/Effect Schema round-trip in this goal.
- Do not claim performance characteristics without a reproducible benchmark.
- Keep generated outputs generated; change templates/generators and regenerate fixtures rather than
  hand-editing outputs.
- Do not close, edit, or create GitHub issues unless the user separately authorizes it. Plans may
  reference existing issues.

## Boundaries

The loop may change:

- `README.md`, `VISION.md`, `AGENTS.md`, package READMEs, `docs/`, and examples
- root build/test scripts and CI required to enforce this goal
- packages in `packages/*` required by the current stage
- workspace manifests, lockfile, Changesets, templates, and generated test fixtures required by
  intentional package changes
- this goal and `plans/` for progress and evidence updates

The loop must not:

- edit `.repos/effect`
- change the Effect baseline or migrate to Effect 4
- modify unrelated applications, repositories, credentials, production resources, release
  configuration, or published npm state
- perform broad dependency upgrades unrelated to an accepted work package
- rewrite Git history or force-push

## Git and PR policy

- Use Conventional Commits in English.
- Commit one logical work package at a time and include Changesets in the commit that establishes
  the corresponding public behavior.
- Normal pushes and PR creation/update are authorized.
- Never merge a PR.
- Never publish packages or create a release.
- Never delete remote branches.
- Never change PR bases away from the stack declared above without human approval.
- If a remote branch is ahead or diverged, stop and report instead of force-pushing.

## Iteration policy

1. Re-read this file, `plans/README.md`, and the current stage plan.
2. Select the first incomplete, unblocked work package in dependency order.
3. Record the baseline evidence or failing characterization before changing behavior.
4. Make the smallest coherent change that advances that work package.
5. Run its narrow verification command.
6. Update the plan status and append a progress-log entry containing what changed, what the check
   proved, and the next action.
7. Commit at a logical green boundary. Do not accumulate unrelated changes.
8. At a stage boundary, run the full gate, push, open/update the PR, and repair CI before branching
   for the next stage.

## Discovered work

New findings must first be added to the table below with evidence, impact, a proposed verification,
and a recommended stage. Finish the work package already in progress before switching.

Promote a finding into a stage only when it:

1. directly serves the Goal and Why,
2. is supported by repository evidence,
3. has a machine-checkable completion condition, and
4. does not violate the boundaries or explicit non-goals.

Otherwise leave it for human review. Discovery must deepen the agreed product milestone, not turn it
into general repository gardening.

| Finding                                                                                                               | Evidence                                                                                                                                                                 | Proposed verification                                                                    | Stage | Status |
| --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------- | ----- | ------ |
| Scoped-service documentation process tests inherit Vitest's 5-second timeout and fail under full-workspace contention | Baseline `pnpm test` timed out at `packages/cli/__test__/pluginAuthoring.serviceFixture.test.ts:93`; the same test passed sequentially in 2.228 seconds                  | Run the focused test, the root `pnpm test`, and the complete baseline gate under Node 24 | 1     | DONE   |
| Contributor guidance was ignored and therefore absent from clean checkouts                                            | `.gitignore` explicitly listed `AGENTS.md`; `git check-ignore -v AGENTS.md` resolved to `.gitignore:8`                                                                   | Track `AGENTS.md` and make `pnpm docs:check` verify its manifest-derived toolchain facts | 1     | DONE   |
| The public client example passed an unsupported request field                                                         | The new TypeScript fixture rejected `CreateTodoRequestCommand.body.status`; the generated request accepts `title`, `description`, `dueDate`, `tags`, and `priority` only | Typecheck the corrected example against regenerated integration output                   | 1     | DONE   |
| OpenAPI contract assertions exceeded the integration test function-size limit                                         | `pnpm lint` reported `max-lines-per-function` at `generatedOpenApiFixture.test.ts:46-47` after adding metadata/security fixture assertions                               | Extract a focused contract-projection assertion helper; rerun OpenAPI tests and lint     | 2     | DONE   |

## Stop conditions

- **Done:** every criterion is checked with recorded evidence, all three stacked PRs are open and
  green, and none has been merged.
- **Iteration cap:** stop after 90 total implementation iterations or 30 in any single stage. Report
  completed criteria, remaining criteria, evidence, and the next best action. Do not declare
  completion.
- **Budget:** when the runner's token or cost budget is reached, stop with a truthful handoff.
  Budget exhaustion is not completion.
- **No progress:** stop after three consecutive iterations that produce no change in a criterion's
  machine-checkable evidence.
- **Circuit breaker:** retry the same failing tool, command, CI job, or external operation at most
  three times without a materially different hypothesis.
- **Blocked:** after exhausting safe in-scope paths, report attempted paths, exact evidence, the
  blocker, and the smallest input or authority that would unlock progress.
- **Drift:** stop if the implementation requires a native Effect `HttpApi` backend, an OpenAPI
  importer, an Effect 4 migration, or another explicit non-goal.
- **Remote divergence:** stop if a stage branch has diverged and a normal push is impossible.

## Irreversible actions

Human approval is required. Never execute autonomously:

- merging any pull request
- publishing packages or creating a release
- force-pushing or rewriting published history
- deleting remote branches, tags, packages, or GitHub content
- deploying infrastructure or writing to production services
- changing repository secrets, credentials, permissions, or branch protection

## Stage evidence

| Stage | Status      | Branch                               | Head                                       | PR                                                    | Required checks                                       | Evidence report                                                                         |
| ----- | ----------- | ------------------------------------ | ------------------------------------------ | ----------------------------------------------------- | ----------------------------------------------------- | --------------------------------------------------------------------------------------- |
| 1     | DONE        | `feat/product-truth-and-type-safety` | `4be4d3171ba76e8aedadfd6d5eade1a384c6865e` | [#209](https://github.com/rexeus/typeweaver/pull/209) | quality-check, windows-security, CodeQL, Socket: PASS | Iterations 1–8; [CI run](https://github.com/rexeus/typeweaver/actions/runs/30200908126) |
| 2     | IN PROGRESS | `feat/contract-and-openapi-maturity` |                                            |                                                       |                                                       |                                                                                         |
| 3     | TODO        | `feat/developer-surfaces`            |                                            |                                                       |                                                       |                                                                                         |

Status values: `TODO`, `IN PROGRESS`, `DONE`, or `BLOCKED: <reason>`.

## Progress log

Append one line after every iteration. Never rewrite earlier entries.

| Iteration | Stage    | Change                                                                          | Evidence                                                                                                                                                                                                                                                                      | Next action                                                                                       |
| --------- | -------- | ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| 0         | Planning | Goal and three-stage roadmap created at `3c97d402`                              | Planning artifacts only; implementation has not started                                                                                                                                                                                                                       | Merge the planning PR, then start Stage 1 from updated `main`                                     |
| 1         | Stage 1  | Started baseline recovery for process-backed scoped-service documentation tests | Full baseline reached `pnpm test`; the scoped-service typecheck exceeded Vitest's default 5-second timeout under workspace contention after passing sequentially in 2.228 seconds                                                                                             | Apply the existing 15-second CLI process-test budget and rerun focused and full baseline gates    |
| 2         | Stage 1  | Applied the established 15-second budget to both scoped-service process tests   | Focused suite passed 3/3 tests; the previously failing root `pnpm test` passed all 23 Turbo tasks                                                                                                                                                                             | Commit the baseline repair and reproduce the complete baseline gate from the clean stage branch   |
| 3         | Stage 1  | Reproduced the complete Node 24 baseline after commit `917ef13e`                | Every full-gate command through `pnpm publish:dry` exited 0; final `git status --short` was empty                                                                                                                                                                             | Start Plan 001 Work Package 1 with repository-truth characterization                              |
| 4         | Stage 1  | Completed Plan 001 Work Package 1 at `62856a3d`                                 | `pnpm docs:check`, `pnpm format:check`, and `pnpm lint` exited 0; stale-tool and unresolved-ADR searches returned no matches; issues #198 and #200 were re-read and remain open                                                                                               | Start Work Package 2 by inventorying and characterizing every public documentation example        |
| 5         | Stage 1  | Completed Plan 001 Work Package 2 at `31ad8594`                                 | `pnpm docs:check` verified nine declared example groups plus an invalid-fixture self-test; `pnpm typecheck` passed 23/23 tasks; CI now calls `docs:check`                                                                                                                     | Start Work Package 3 by re-reading issue #193 and characterizing every unsupported Zod shape      |
| 6         | Stage 1  | Completed Plan 001 Work Package 3 at `6c78fba8`                                 | Characterization failed in all six silent-fallback cases before the fix; afterward 121/121 package tests, package typecheck/build, and `pnpm verify:generated` passed with 225 fixtures unchanged                                                                             | Start Work Package 4 by characterizing every public HTTP body type and supported runtime body     |
| 7         | Stage 1  | Completed Plan 001 Work Package 4 at `450408d5`                                 | `IsAny` characterization failed 4 Core, 3 Server, and 5 Hono contracts before the fix; afterward 150 Core, 833 Server, and 112 Hono tests passed, 225 fixtures reproduced, and Node/Deno/Bun bundle gates passed                                                              | Reconcile Stage 1 evidence and live issues, then run the complete stage gate                      |
| 8         | Stage 1  | Reconciled live issues and completed the local Stage 1 gate at `54dd46e`        | Issues #193, #198, and #200 remain open but are implemented on this branch; #199 is superseded by the pinned Effect 3.22 reference tooling; every full-gate command exited 0 under Node 24 and the final status was empty                                                     | Commit the local gate evidence, push normally, and open the ready Stage 1 PR against `main`       |
| 9         | Stage 1  | Delivered Stage 1 as open ready PR #209 at exact head `4be4d317`                | The PR targets `main`, remains unmerged, and quality-check, windows-security, CodeQL, and both Socket checks passed at the recorded head                                                                                                                                      | Start Plan 002 Work Package 1 from the exact Stage 1 head                                         |
| 10        | Stage 2  | Accepted the generator-neutral metadata and security contract in ADR 0009       | Core type characterization failed on the absent public fields/types and Gen runtime characterization failed on absent normalized metadata/security before behavior changed; Core 150/150, Gen 303/303, and docs checks pass after the ADR                                     | Implement the accepted authoring and normalized contract with the characterized inheritance tests |
| 11        | Stage 2  | Completed Plan 002 Work Package 2 at `a83c79b4`                                 | Core 151/151 and Gen 318/318 tests, 14/14 generated-project tasks, 225-file generated-fixture verification, 23/23 workspace typecheck tasks, docs, lint, format, Effect diagnostics, and Changeset status pass                                                                | Add the side-effect-free plugin validation phase with stable structured issues                    |
| 12        | Stage 2  | Completed Plan 002 Work Package 3 at `f4fd035b`                                 | Gen 325/325 tests and package typecheck pass; the negative tsc fixture rejects `writeFile`; registry coverage proves dependency order, issue order, typed failure, spans, isolation, optional hooks, and sequential `TW-SPEC-*` codes                                         | Add explicit, independently validated OpenAPI 3.1.2 and 3.2.0 target profiles                     |
| 13        | Stage 2  | Completed Plan 002 Work Package 4 at `567724ef`                                 | OpenAPI 126/126 tests and package typecheck pass; both profiles validate against the version-aware official-schema validator, the 3.1.2 generated fixture also passes Spectral, 225 fixtures reproduce, and docs, lint, format, Effect diagnostics, and Changeset status pass | Publish the honest OpenAPI support matrix and executable profile documentation                    |
| 14        | Stage 2  | Completed Plan 002 Work Package 5 at `f91399f1`                                 | Documentation characterization failed on stale 3.1.1, missing boundary tables, and absent non-goals before the change; afterward docs checks, all 129 OpenAPI tests, lint, and format pass, including the extracted fixture assertion helper                                  | Run the complete Stage 2 local gate, then deliver the stacked PR                                  |
