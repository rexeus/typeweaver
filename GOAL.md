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

The implementation started as three stacked pull requests. After Stages 1 and 2 were green, the
human owner merged PRs #209 and #211. On 2026-07-26, the owner explicitly accepted those merges and
authorized Stage 3 to integrate the current `main` and target `main`. The loop may implement,
commit, push, create or update the remaining Stage 3 pull request, and repair its CI. It must never
merge that PR.

| Stage | Plan                                         | Branch                               | Pull request base                                     |
| ----- | -------------------------------------------- | ------------------------------------ | ----------------------------------------------------- |
| 1     | `plans/001-product-truth-and-type-safety.md` | `feat/product-truth-and-type-safety` | `main` — human merged as PR #209                      |
| 2     | `plans/002-contract-and-openapi-maturity.md` | `feat/contract-and-openapi-maturity` | Stage 1 branch — human merged as PR #211              |
| 3     | `plans/003-developer-surfaces.md`            | `feat/developer-surfaces`            | `main` — explicitly authorized after the prior merges |

After a stage is locally complete:

1. Run every stage gate and the full repository gate.
2. Commit all stage work as logical Conventional Commits.
3. Push the stage branch with a normal push.
4. Open a ready-for-review pull request against the base in the table.
5. Inspect all pull-request checks and repair failures until every required check is green.
6. Record the PR URL, head commit, checks, and evidence in this file.
7. For the historical Stage 1 and 2 deliveries, continue from the completed stage head without
   performing a merge. For Stage 3, integrate current `main` with a normal merge as explicitly
   authorized by the owner.

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
      changes, a green full gate, and green PR #209 targeting `main`; the owner subsequently merged
      it.

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
- [x] Stage 2 has appropriate Changesets and migration notes, a green full gate, and green PR #211;
      the owner subsequently merged it.

### Stage 3: Developer surfaces

- [x] A third-party plugin can be scaffolded, tested, and generated through a documented public
      starter path without copying private test internals.
  - Verify: scaffold golden tests and a packed external plugin consumer pass.
- [x] The TypeWeaver CLI provides real `init`, `validate`, and `doctor` workflows with stable human
      and JSON diagnostics; `init` is no longer a stub.
  - Verify: process tests cover success, failure, no-write validation, JSON schema, and atomic
    bootstrap behavior on supported runtimes.
- [x] `@rexeus/typeweaver-command` generates a command-line API client with one command per
      operation, deterministic flags, body file/stdin support, structured output, documented exit
      codes, and contract-derived security.
  - Verify: generate a CLI from the test project, run it against a real local TypeWeaver test
    server, and assert success, validation, authentication, HTTP failure, network failure, and
    cancellation behavior.
- [x] `@rexeus/typeweaver-effect` provides Effect-returning handlers for the existing Fetch-native
      server with one managed runtime at the application boundary, typed failures, service
      requirements, interruption on request abort, and operation spans.
  - Verify: Effect diagnostics, type-contract tests, lifecycle tests, and packed consumer tests pass
    without a per-request runtime or per-handler `Effect.runPromise`.
- [x] All public guides describe the shipped behavior and every new public workflow has an
      executable example.
- [x] A final evidence report maps every claim in this goal to commands, artifacts, commits, and PR
      checks and records an independent review with no unresolved critical or high-confidence
      high-impact finding in scope.
- [x] Stage 3 has appropriate Changesets and migration notes, a green full gate, and an open green
      PR targeting `main`.

### Final delivery

- [x] PRs #209 and #211 are recorded as human-merged after green checks, while the Stage 3 PR
      targets `main`, is open and green, and remains unmerged.
- [x] Every required check on every PR is green at its recorded head commit.
- [x] `plans/README.md` and this file show all three stages as complete with evidence.
- [x] No criterion was waived merely because the implementation became difficult. Any intentionally
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
pnpm verify:architecture-contracts
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
- Never merge the remaining Stage 3 PR.
- Never publish packages or create a release.
- Never delete remote branches.
- The owner-approved Stage 3 base is `main`; do not change it again without human approval.
- Historical Stage 1 and 2 remote advancement from their human merges is expected. If the Stage 3
  remote branch is ahead or diverged, stop and report instead of force-pushing.

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

| Finding                                                                                                               | Evidence                                                                                                                                                                                                               | Proposed verification                                                                                                                       | Stage | Status |
| --------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ----- | ------ |
| Scoped-service documentation process tests inherit Vitest's 5-second timeout and fail under full-workspace contention | Baseline `pnpm test` timed out at `packages/cli/__test__/pluginAuthoring.serviceFixture.test.ts:93`; the same test passed sequentially in 2.228 seconds                                                                | Run the focused test, the root `pnpm test`, and the complete baseline gate under Node 24                                                    | 1     | DONE   |
| Contributor guidance was ignored and therefore absent from clean checkouts                                            | `.gitignore` explicitly listed `AGENTS.md`; `git check-ignore -v AGENTS.md` resolved to `.gitignore:8`                                                                                                                 | Track `AGENTS.md` and make `pnpm docs:check` verify its manifest-derived toolchain facts                                                    | 1     | DONE   |
| The public client example passed an unsupported request field                                                         | The new TypeScript fixture rejected `CreateTodoRequestCommand.body.status`; the generated request accepts `title`, `description`, `dueDate`, `tags`, and `priority` only                                               | Typecheck the corrected example against regenerated integration output                                                                      | 1     | DONE   |
| Malformed documentation-example groups crashed the verifier                                                           | Omitting `documents` and `fixtures` raised a `TypeError` in `validateGroupFiles` instead of returning contract failures                                                                                                | Assert explicit failures for missing group arrays and run `pnpm docs:check`                                                                 | 1     | DONE   |
| Zod-to-TypeScript docs used nonexistent namespace exports                                                             | `MIGRATION.md` and the package README called `TsTypeNode.fromZod`, while the package exports `fromZod` and `print`                                                                                                     | Typecheck both documents through a public-package documentation fixture                                                                     | 1     | DONE   |
| OpenAPI contract assertions exceeded the integration test function-size limit                                         | `pnpm lint` reported `max-lines-per-function` at `generatedOpenApiFixture.test.ts:46-47` after adding metadata/security fixture assertions                                                                             | Extract a focused contract-projection assertion helper; rerun OpenAPI tests and lint                                                        | 2     | DONE   |
| CLI PluginRegistry test double omitted the validation phase                                                           | Full Stage 2 `pnpm typecheck` failed at `packages/cli/__test__/pluginLoader.test.ts:104,128` because the mock lacked required `validate`                                                                               | Add a write-free no-op validator to the test double; rerun CLI and workspace typechecks                                                     | 2     | DONE   |
| CLI generator integration still asserted OpenAPI 3.1.1                                                                | Focused CLI test run failed at `generator.generate.test.ts:500`; generated output correctly declared the new 3.1.2 default                                                                                             | Update the integration assertion and rerun the CLI suite                                                                                    | 2     | DONE   |
| SpecLoader module fixtures omitted newly required API metadata                                                        | Focused CLI test run failed four SpecLoader cases in `validateMetadata` because their synthetic specs contained only resources                                                                                         | Add deterministic title/version metadata to each fixture; rerun SpecLoader and CLI tests                                                    | 2     | DONE   |
| SpecLoader structural guard accepted metadata-less specs and allowed a runtime defect                                 | The same four failures reached `validateMetadata` as `TypeError` instead of the typed invalid-entrypoint boundary because `isSpecDefinition` checked only resources                                                    | Require title/version metadata in the guard and add a negative structural test                                                              | 2     | DONE   |
| Standalone SpecImporter happy-path fixture omitted newly required API metadata                                        | The complete Stage 2 gate failed in `SpecImporter.test.ts:76`; its generated module exported resources but no metadata and the hardened guard returned `InvalidSpecEntrypointError`                                    | Add deterministic title/version metadata and assert it survives import; rerun the focused test and full gate                                | 2     | DONE   |
| CLI configuration process cases inherited Vitest's 5-second timeout under full-workspace contention                   | The complete Stage 2 `pnpm test` timed out the missing-input case at `cli.process.test.ts:298` in 5.006 seconds; the same case passed sequentially during `verify:effect-migration` in 3.642 seconds                   | Apply the established 15-second process-test budget to the table; rerun the focused suite and full gate                                     | 2     | DONE   |
| The CLI package README still describes the OpenAPI plugin as producing 3.1.1 documents                                | `packages/cli/README.md` names OpenAPI 3.1.1 even though Stage 2 made 3.1.2 the default compatibility profile and added an explicit 3.2.0 target                                                                       | Update the package README support claim and make repository truth checks reject the stale profile                                           | 3     | DONE   |
| A generated executable command entry was eligible for barrels and ran during library import                           | The initial command process suite printed usage while importing the generated project because `command/index.ts` re-exported the generated `cli.ts` entrypoint                                                         | Generate the entrypoint as `.mts`, assert barrels exclude it, import the compiled root without process mutation, and run process tests      | 3     | DONE   |
| Generated network failures could expose credential-bearing request URLs                                               | The composed client includes its complete request URL in `NetworkError.message`; the command runtime returned that message verbatim, including any contract-derived query API key                                      | Return a stable sanitized network message and assert a credential-bearing URL never reaches JSON or human output                            | 3     | DONE   |
| Main's documentation-manifest hardening dropped Stage 3 runtime fixtures during merge                                 | The merged `validateGroup` normalized only `documents` and `fixtures`; the negative runtime-fixture assertion failed because `runtimeFixtures` disappeared before file validation                                      | Preserve and validate optional runtime fixtures; run the checker self-test and complete `pnpm docs:check`                                   | 3     | DONE   |
| Scoped plugin runtime state was shared across concurrent generation fibers                                            | `defineScopedPlugin` retained one mutable `state.current` closure on the module-cached plugin instance; the new concurrent test failed with `initialized more than once without finalization`                          | Run two public test-kit lifecycles concurrently against one plugin instance and prove two acquisitions, isolated services, and releases     | 3     | DONE   |
| Init cleanup could delete the only backup after rollback itself failed                                                | `executePlan` used `makeTempDirectoryScoped`; the characterization received a plain filesystem error and the scoped cleanup removed the unrestored `README.md` backup                                                  | Inject publication and restore failures, then assert the original survives at a reported recovery path and ordinary failures still clean up | 3     | DONE   |
| The first Windows CI attempt exited before Turbo started a package build                                              | Job `89822979009` installed dependencies, entered the 14-package Turbo build, emitted no child-task or source error, and exited 1 after about three seconds; the same head's local gate and Linux build were green     | Rerun the failed job once at the unchanged head and require build, rebuilt symlinks, and Windows security contracts to pass                 | 3     | DONE   |
| Comma-separated plugin flags retain empty plugin names                                                                | Copilot review comment `3653076020` identified `parsePluginList("clients,,server,")` returning empty strings that later become misleading module-resolution attempts                                                   | Add a focused parser characterization and require only trimmed non-empty plugin names                                                       | 3     | DONE   |
| Validation stages temporary output inside the project tree                                                            | Copilot review comment `3653089514` identified `makeTempDirectoryScoped({ directory: currentWorkingDirectory })`; cleanup handles normal scope exit but interruption can leave `.typeweaver-validate-*` in the project | Characterize the temporary-directory parent and require OS-temporary staging plus the existing no-write process suite                       | 3     | DONE   |
| The Effect guide overstates generated HEAD-operation coverage                                                         | Copilot review comment `3653076033` notes that the guide promises error mappers for every operation while both server and Effect generators intentionally omit explicit HEAD handlers                                  | Tighten the guide to the server handler surface and make the executable Effect documentation contract reject the stale claim                | 3     | DONE   |
| Init and plugin-scaffold process tests inherit Vitest's 5-second timeout under full-workspace contention              | The post-review full gate timed out `init.process.test.ts:162` at 5.008 seconds and `pluginScaffold.process.test.ts:56` at 5.000 seconds; both cases passed sequentially in earlier focused and documentation runs     | Apply the established 15-second process-test budget, rerun both focused files, and require the complete Stage 3 gate to pass                | 3     | DONE   |
| Timeout formatting pushed the init publication test over the maintainability line limit                               | The complete gate reached architecture contracts, where the authored-repository lint check reported `init.process.test.ts:162` at 102 lines against the 100-line function limit                                        | Extract the starter-source assertions into a focused helper, then rerun the process tests, lint, architecture contracts, and complete gate  | 3     | DONE   |
| Mixed-case request headers fail to override generated client defaults case-insensitively                              | Review comment `3653157280` and the new client characterization produced `authorization: Bearer default, Bearer request` when a request-level lowercase header should replace the default uppercase credential         | Require a single request credential after a mixed-case override; rerun the Clients suite, generation, typecheck, and packed consumer matrix | 3     | DONE   |
| Generated command Basic authentication rejects credentials outside the Latin-1 range                                  | Review comment `3653157293` and the new command characterization returned `InvalidCharacterError` for `用户:密码` instead of the UTF-8 Base64 value `55So5oi3OuWvhueggQ==`                                             | Require the UTF-8 Basic value; rerun the Command suite, generation, typecheck, and packed consumer matrix                                   | 3     | DONE   |
| Validation warning-threshold process test inherits Vitest's 5-second timeout under full-workspace contention          | The post-review authentication gate timed out `validate.process.test.ts:306` at 5.006 seconds; the same case passed sequentially in the documentation workflow in 2.189 seconds                                        | Apply the established 15-second process-test budget, rerun the focused file, and require the complete Stage 3 gate to pass                  | 3     | DONE   |

## Stop conditions

- **Done:** every criterion is checked with recorded evidence, human-merged PRs #209 and #211 are
  recorded at green heads, and the Stage 3 PR against `main` is open, green, and unmerged.
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
- **Remote divergence:** stop if the Stage 3 branch has diverged and a normal push is impossible.

## Irreversible actions

Human approval is required. Never execute autonomously:

- merging any pull request
- publishing packages or creating a release
- force-pushing or rewriting published history
- deleting remote branches, tags, packages, or GitHub content
- deploying infrastructure or writing to production services
- changing repository secrets, credentials, permissions, or branch protection

## Stage evidence

| Stage | Status             | Branch                               | Head                                       | PR                                                    | Required checks                                       | Evidence report                                                                                                                             |
| ----- | ------------------ | ------------------------------------ | ------------------------------------------ | ----------------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | DONE, HUMAN MERGED | `feat/product-truth-and-type-safety` | `b8861460b501ef19948fa732fc8901c704f6230e` | [#209](https://github.com/rexeus/typeweaver/pull/209) | quality-check, windows-security, CodeQL, Socket: PASS | Iterations 1–9; [CI run](https://github.com/rexeus/typeweaver/actions/runs/30209088039)                                                     |
| 2     | DONE, HUMAN MERGED | `feat/contract-and-openapi-maturity` | `dfdc3354b24ce627794440703567f15204ab63ef` | [#211](https://github.com/rexeus/typeweaver/pull/211) | quality-check, windows-security, Socket: PASS         | Iterations 10–20; [CI run](https://github.com/rexeus/typeweaver/actions/runs/30209719892)                                                   |
| 3     | DONE               | `feat/developer-surfaces`            | `ac680374daf5aed02e830ec839391c68dab9381c` | [#212](https://github.com/rexeus/typeweaver/pull/212) | quality-check, windows-security, CodeQL, Socket: PASS | [Final evidence review](docs/reviews/product-maturity-evidence.md); [CI run](https://github.com/rexeus/typeweaver/actions/runs/30214886101) |

Status values: `TODO`, `IN PROGRESS`, `DONE`, `DONE, HUMAN MERGED`, or `BLOCKED: <reason>`.

## Progress log

Append one line after every iteration. Never rewrite earlier entries.

| Iteration | Stage    | Change                                                                                | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Next action                                                                                                  |
| --------- | -------- | ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| 0         | Planning | Goal and three-stage roadmap created at `3c97d402`                                    | Planning artifacts only; implementation has not started                                                                                                                                                                                                                                                                                                                                                                                                                           | Merge the planning PR, then start Stage 1 from updated `main`                                                |
| 1         | Stage 1  | Started baseline recovery for process-backed scoped-service documentation tests       | Full baseline reached `pnpm test`; the scoped-service typecheck exceeded Vitest's default 5-second timeout under workspace contention after passing sequentially in 2.228 seconds                                                                                                                                                                                                                                                                                                 | Apply the existing 15-second CLI process-test budget and rerun focused and full baseline gates               |
| 2         | Stage 1  | Applied the established 15-second budget to both scoped-service process tests         | Focused suite passed 3/3 tests; the previously failing root `pnpm test` passed all 23 Turbo tasks                                                                                                                                                                                                                                                                                                                                                                                 | Commit the baseline repair and reproduce the complete baseline gate from the clean stage branch              |
| 3         | Stage 1  | Reproduced the complete Node 24 baseline after commit `917ef13e`                      | Every full-gate command through `pnpm publish:dry` exited 0; final `git status --short` was empty                                                                                                                                                                                                                                                                                                                                                                                 | Start Plan 001 Work Package 1 with repository-truth characterization                                         |
| 4         | Stage 1  | Completed Plan 001 Work Package 1 at `62856a3d`                                       | `pnpm docs:check`, `pnpm format:check`, and `pnpm lint` exited 0; stale-tool and unresolved-ADR searches returned no matches; issues #198 and #200 were re-read and remain open                                                                                                                                                                                                                                                                                                   | Start Work Package 2 by inventorying and characterizing every public documentation example                   |
| 5         | Stage 1  | Completed Plan 001 Work Package 2 at `31ad8594`                                       | `pnpm docs:check` verified nine declared example groups plus an invalid-fixture self-test; `pnpm typecheck` passed 23/23 tasks; CI now calls `docs:check`                                                                                                                                                                                                                                                                                                                         | Start Work Package 3 by re-reading issue #193 and characterizing every unsupported Zod shape                 |
| 6         | Stage 1  | Completed Plan 001 Work Package 3 at `6c78fba8`                                       | Characterization failed in all six silent-fallback cases before the fix; afterward 121/121 package tests, package typecheck/build, and `pnpm verify:generated` passed with 225 fixtures unchanged                                                                                                                                                                                                                                                                                 | Start Work Package 4 by characterizing every public HTTP body type and supported runtime body                |
| 7         | Stage 1  | Completed Plan 001 Work Package 4 at `450408d5`                                       | `IsAny` characterization failed 4 Core, 3 Server, and 5 Hono contracts before the fix; afterward 150 Core, 833 Server, and 112 Hono tests passed, 225 fixtures reproduced, and Node/Deno/Bun bundle gates passed                                                                                                                                                                                                                                                                  | Reconcile Stage 1 evidence and live issues, then run the complete stage gate                                 |
| 8         | Stage 1  | Reconciled live issues and completed the local Stage 1 gate at `54dd46e`              | Issues #193, #198, and #200 remain open but are implemented on this branch; #199 is superseded by the pinned Effect 3.22 reference tooling; every full-gate command exited 0 under Node 24 and the final status was empty                                                                                                                                                                                                                                                         | Commit the local gate evidence, push normally, and open the ready Stage 1 PR against `main`                  |
| 9         | Stage 1  | Delivered Stage 1 as open ready PR #209 at exact head `4be4d317`                      | The PR targets `main`, remains unmerged, and quality-check, windows-security, CodeQL, and both Socket checks passed at the recorded head                                                                                                                                                                                                                                                                                                                                          | Start Plan 002 Work Package 1 from the exact Stage 1 head                                                    |
| 10        | Stage 2  | Accepted the generator-neutral metadata and security contract in ADR 0009             | Core type characterization failed on the absent public fields/types and Gen runtime characterization failed on absent normalized metadata/security before behavior changed; Core 150/150, Gen 303/303, and docs checks pass after the ADR                                                                                                                                                                                                                                         | Implement the accepted authoring and normalized contract with the characterized inheritance tests            |
| 11        | Stage 2  | Completed Plan 002 Work Package 2 at `a83c79b4`                                       | Core 151/151 and Gen 318/318 tests, 14/14 generated-project tasks, 225-file generated-fixture verification, 23/23 workspace typecheck tasks, docs, lint, format, Effect diagnostics, and Changeset status pass                                                                                                                                                                                                                                                                    | Add the side-effect-free plugin validation phase with stable structured issues                               |
| 12        | Stage 2  | Completed Plan 002 Work Package 3 at `f4fd035b`                                       | Gen 325/325 tests and package typecheck pass; the negative tsc fixture rejects `writeFile`; registry coverage proves dependency order, issue order, typed failure, spans, isolation, optional hooks, and sequential `TW-SPEC-*` codes                                                                                                                                                                                                                                             | Add explicit, independently validated OpenAPI 3.1.2 and 3.2.0 target profiles                                |
| 13        | Stage 2  | Completed Plan 002 Work Package 4 at `567724ef`                                       | OpenAPI 126/126 tests and package typecheck pass; both profiles validate against the version-aware official-schema validator, the 3.1.2 generated fixture also passes Spectral, 225 fixtures reproduce, and docs, lint, format, Effect diagnostics, and Changeset status pass                                                                                                                                                                                                     | Publish the honest OpenAPI support matrix and executable profile documentation                               |
| 14        | Stage 2  | Completed Plan 002 Work Package 5 at `f91399f1`                                       | Documentation characterization failed on stale 3.1.1, missing boundary tables, and absent non-goals before the change; afterward docs checks, all 129 OpenAPI tests, lint, and format pass, including the extracted fixture assertion helper                                                                                                                                                                                                                                      | Run the complete Stage 2 local gate, then deliver the stacked PR                                             |
| 15        | Stage 2  | Characterized a stale standalone SpecImporter happy-path fixture during the full gate | `pnpm verify:effect-migration` reached the workspace suite and failed only `SpecImporter.test.ts`; the fixture's metadata-less export was correctly rejected by the hardened `isSpecDefinition` boundary as `InvalidSpecEntrypointError`                                                                                                                                                                                                                                          | Update the fixture and its assertion, run focused verification, then restart the complete gate               |
| 16        | Stage 2  | Updated the standalone SpecImporter fixture to the required metadata contract         | The focused `SpecImporter.test.ts` now passes 1/1 and asserts that deterministic title/version metadata survives the real import seam                                                                                                                                                                                                                                                                                                                                             | Commit the focused fixture repair, then restart the complete Stage 2 gate                                    |
| 17        | Stage 2  | Characterized a CLI process-test timeout under full-workspace contention              | The full gate passed Effect migration, docs, format, and lint, then `pnpm test` failed only the missing-input process case at Vitest's 5-second default; the same case had passed sequentially in 3.642 seconds                                                                                                                                                                                                                                                                   | Apply the established 15-second process-test budget, verify narrowly, and restart the full gate              |
| 18        | Stage 2  | Applied the established process-test budget to CLI configuration diagnostics          | The focused CLI process file passed 13/13, including both table cases; root `pnpm test` then passed all 23 Turbo tasks under workspace contention, with the previously failing missing-input case completing in 3.753 seconds                                                                                                                                                                                                                                                     | Commit the focused timeout repair, then restart the complete Stage 2 gate                                    |
| 19        | Stage 2  | Completed the full local Stage 2 gate at `978a7d95`                                   | Under Node 24.16.0 and pnpm 10.34.5, every required command from frozen install through Effect migration, docs, format, lint, tests, and `publish:dry` exited 0; the final `git status --short` was empty                                                                                                                                                                                                                                                                         | Commit local gate evidence, verify the remote branch, then push and open the stacked Stage 2 PR              |
| 20        | Stage 2  | Delivered Stage 2 as open ready PR #211 at exact head `7d80366c`                      | The PR targets `feat/product-truth-and-type-safety`, remains unmerged, has clean merge status, and quality-check, windows-security, and both Socket checks passed at the recorded head                                                                                                                                                                                                                                                                                            | Start Plan 003 Work Package 1 from the exact Stage 2 head                                                    |
| 21        | Stage 3  | Added the public plugin lifecycle test kit and scoped-Layer ownership helper          | Characterization first failed six cases on absent `createPluginTestKit` and `defineScopedPlugin`; afterward Gen passed 333/333 tests and typecheck/build, ten CLI authoring/recovery cases passed, and docs, format, lint, Changeset status, and Effect diagnostics passed                                                                                                                                                                                                        | Commit the green public authoring surface, then characterize the non-interactive plugin scaffold             |
| 22        | Stage 3  | Completed the documented non-interactive plugin scaffold and packed external consumer | The absent-command characterization failed both scaffold cases; final CLI passed 367 tests, Gen passed 333, and the packed fake-registry consumer installed one Effect 3.22 identity, typechecked, passed 3/3 starter tests, built, and generated; docs, format, lint, Changeset status, and Effect diagnostics passed                                                                                                                                                            | Commit Work Package 1, then characterize the `init`, `validate`, and `doctor` workflows                      |
| 23        | Stage 3  | Added the side-effect-free `validate` workflow and stable report schema               | All three initial cases failed because `validate` was absent; afterward CLI passed 371 tests plus 23/23 sequential process cases, Gen passed 334, and JSON-schema validity, stable spec/plugin codes, thresholds, human stderr, and a byte-identical tree passed with type, docs, format, lint, Changeset, and Effect gates                                                                                                                                                       | Commit the green validation boundary, then characterize the read-only `doctor` checks                        |
| 24        | Stage 3  | Added the read-only `doctor` workflow and stable report schema                        | Characterization failed 3/3 because doctor was absent; afterward CLI passed 376 tests (2 existing skips) and process 28/28. Five doctor cases prove human/JSON schemas, exit/skip semantics, plugin and output checks, deep no-write validation; type/contracts, docs, format, lint, Changeset, and Effect diagnostics pass                                                                                                                                                       | Commit the green doctor boundary, then characterize the atomic `init` bootstrap                              |
| 25        | Stage 3  | Completed the atomic `init`, `validate`, and `doctor` CLI work package                | Five init characterizations failed on the placeholder; afterward CLI passed 382 tests (2 existing skips), `test:process` exited 0, init passed 5/5, and injected publication failure passed 1/1 with full restoration and no staging leak. Type/contracts, docs, format, lint, Changeset, and Effect diagnostics pass                                                                                                                                                             | Commit the complete CLI workflow, then characterize the generated command-client package                     |
| 26        | Stage 3  | Added the shared client transport boundary required by the generated command package  | Characterization first failed on absent default header/query and signal props plus a private header-default helper; afterward Clients passed 183/183 tests, package typecheck/build and 14/14 generation tasks passed, 225 fixtures reproduced, and docs, format, lint, Changeset, and Effect reference checks pass                                                                                                                                                               | Commit the client transport slice, then characterize the command generator package                           |
| 27        | Stage 3  | Completed the generated Node.js command-client work package                           | The absent-package characterization failed before implementation; afterward Command passed 17/17 tests against the real Hono TypeWeaver server, including body modes, query/path, AND security, sanitized network URLs, validation, HTTP, network, and SIGINT 130. CLI generation, 251-fixture reproduction, package typechecks/build, packed external compilation/execution, docs, format, lint, Changeset, and Effect-reference checks pass                                     | Commit the command-client package, then research the pinned Effect 3.22 runtime boundary                     |
| 28        | Stage 3  | Exposed Fetch request cancellation at the existing server boundary                    | Characterization first failed 1/1 because `ServerContext` had no signal; afterward the focused app suite passed 101/101, the full Server suite passed 834/834 across Node/Deno/Bun, 251 generated fixtures reproduced, and server typecheck, docs, format, lint, Changeset, and the exact Effect 3.22 reference check passed                                                                                                                                                      | Commit the server seam, then implement the optional managed Effect adapter and generated types               |
| 29        | Stage 3  | Completed the optional managed Effect handler adapter                                 | The absent-package characterization failed before implementation; afterward Effect passed 9/9 runtime, generated-type, Fetch-server, lifecycle, typed-error, defect, interruption, span, and static-boundary tests. Server passed 834/834; 255 fixtures reproduced; the packed external consumer compiled and ran with one Effect 3.22 identity; workspace typecheck, strict Effect diagnostics, docs example, build, format, lint, Changeset, and pinned-reference checks passed | Commit Work Package 4, then complete cross-surface public guidance and executable workflow coverage          |
| 30        | Stage 3  | Completed cross-surface guides and executable public workflow coverage                | Characterization found seven missing catalog, workflow-registration, and selection-guide contracts before the change; afterward `pnpm docs:check` verified 17 documentation groups and executed 17/17 built-CLI process tests for plugin scaffolding, `init`, `validate`, and `doctor`, while the explicit surface matrix documents plain Fetch, Hono, generated CLI, and optional Effect choices plus the native `HttpApi` non-goal                                              | Commit Work Package 5, then perform the independent final evidence review                                    |
| 31        | Stage 3  | Accepted the owner-authorized post-merge delivery model                               | The owner confirmed that PRs #209 and #211 were intentionally merged and explicitly authorized Stage 3 to use `main`; live GitHub evidence records green merged heads `b8861460` and `dfdc3354`, and the durable delivery contract now requires the Stage 3 PR to target current `main` while remaining unmerged                                                                                                                                                                  | Commit the contract adjustment, then integrate current `origin/main` without rewriting history               |
| 32        | Stage 3  | Integrated current `main` after the authorized Stage 1 and 2 merges                   | The normal merge preserved Stage 3 history while importing the human-reviewed documentation-manifest guards, Zod documentation fix, pnpm launcher, release-version policy, and architecture-contract gate from green merged heads; conflicts retained both discovery histories and all Stage 3 progress without a rebase or force-push                                                                                                                                            | Verify the integrated baseline, then perform the independent final evidence review                           |
| 33        | Stage 3  | Isolated scoped-plugin Layers across concurrent generation fibers                     | The characterization failed with `initialized more than once without finalization` when two public test-kit lifecycles shared one plugin instance; a plugin-local FiberRef now preserves two acquisitions, distinct service IDs, and two releases, while the focused 6/6 tests, Gen typecheck, and exact Effect 3.22 reference verification pass                                                                                                                                  | Complete the remaining final review dimensions and prepare the evidence report                               |
| 34        | Stage 3  | Preserved init backups when rollback itself fails                                     | The injected publication-plus-restore characterization returned `ProjectInitFileSystemError` and deleted the only backup before the fix; afterward 2/2 rollback tests prove ordinary cleanup plus a typed recovery failure whose reported path retains the original file; the sequential full CLI suite passes 383 tests with 2 existing skips, and CLI typecheck, docs, Effect diagnostics, format, and lint pass                                                                | Finish the remaining review dimensions, then create the final evidence report                                |
| 35        | Stage 3  | Created the cross-stage evidence report and completed the fresh source review         | `docs/reviews/product-maturity-evidence.md` maps every goal criterion to implementing commits/files, narrow checks, full-gate records, generated or packed artifacts, and PR evidence; correctness, security, public API, Effect, tests, maintainability, plugin DX, OpenAPI, and documentation were reviewed with both high-impact findings resolved, while docs verified 18 groups plus 17/17 runtime workflows and format/lint pass                                            | Run the complete clean Stage 3 gate, then deliver the ready PR against `main`                                |
| 36        | Stage 3  | Completed the clean local Stage 3 gate at `42a1d157`                                  | Under Node 24.16.0 and pnpm 10.34.5, both frozen installs, Effect reference, build, generation, Node/Deno/Bun bundles, 27/27 typecheck tasks, architecture contracts, 255 regenerated fixtures, packed consumers, docs, format, lint, all workspace tests, and publish dry run passed; final `git status --short` was empty                                                                                                                                                       | Commit the local gate evidence, verify the remote branch, then push and open the ready PR                    |
| 37        | Stage 3  | Delivered ready PR #212 against `main` at exact reviewed head `e2041464`              | The PR is open, mergeable, and unmerged. quality-check, Windows security, three CodeQL results, and both Socket checks passed. The first Windows attempt exited before Turbo started a package task without a source error; the single failed-job rerun passed the full build and Windows security contracts at the unchanged head in [run 30213270173](https://github.com/rexeus/typeweaver/actions/runs/30213270173)                                                            | Commit the durable completion record, push normally, and require the same checks on that docs-only successor |
| 38        | Stage 3  | Audited the completed Copilot review at final-record head `a1c6479b`                  | All seven required checks and the Copilot workflow passed. One resource-name comment is disproven by the normalized contract, which accepts only camelCase/PascalCase names; three actionable parser, temp-staging, and guide-truth findings entered the discovery gate before implementation                                                                                                                                                                                     | Characterize and repair the three actionable review findings, then rerun narrow and remote gates             |
| 39        | Stage 3  | Repaired all actionable Copilot review findings                                       | Characterizations first failed on empty plugin entries, a project-visible validation directory, and the stale Effect guide claim. The final parser passes 8/8; validation passes 5/5 while staging in OS temp and preserving dependency resolution through the nearest `node_modules`; docs execute 18/18 workflows, CLI typecheck, strict Effect diagnostics, format, lint, and Changeset status pass                                                                            | Commit the review repair, rerun the complete Stage 3 gate, then update PR evidence                           |
| 40        | Stage 3  | Reached the post-review full gate's workspace test boundary                           | Every gate through lint passed at `ba58b56a`; root `pnpm test` then passed all product assertions but timed out the init publication and plugin-scaffold happy paths at Vitest's 5-second default under full-workspace contention, after both had passed sequentially in earlier focused and documentation runs                                                                                                                                                                   | Apply the established 15-second process-test budget and rerun the focused tests                              |
| 41        | Stage 3  | Stabilized CLI process tests under full-workspace load                                | The init publication and plugin-scaffold happy paths now use the repository's established 15-second process-test budget; both focused files pass 8/8 in 8.57 seconds, and the snapshot updater removed only the obsolete entry produced by the earlier timeout                                                                                                                                                                                                                    | Commit the green test boundary, then rerun the complete Stage 3 gate from scratch                            |
| 42        | Stage 3  | Reached the post-timeout gate's maintainability boundary                              | Frozen installs, exact Effect pin, build, 255-fixture generation, Node/Deno/Bun bundles, 27/27 typechecks, and all architecture checks through 18 documentation groups and 18/18 runtime workflows passed; the maintainability self-test then found the formatted init happy-path test at 102 lines against the 100-line limit                                                                                                                                                    | Extract the starter-source assertions and rerun narrow maintainability checks                                |
| 43        | Stage 3  | Restored the init test's maintainability boundary                                     | Starter-operation assertions now live in a focused helper; both process files pass 8/8, standalone lint exits zero, and the full architecture-contract suite passes documentation, maintainability, Effect diagnostics, public contracts, all package tests, 255-fixture freshness, and packed consumers without changing the authored worktree                                                                                                                                   | Commit the green maintainability repair, then rerun the complete Stage 3 gate from scratch                   |
| 44        | Stage 3  | Completed the repaired clean local Stage 3 gate at `07663af4`                         | Under Node 24.16.0 and pnpm 10.34.5, both frozen installs, exact Effect reference, build, generation, Node/Deno/Bun bundles, 27/27 typechecks, architecture contracts, 255 fresh fixtures, packed consumers, 18 documentation groups and workflows, format, lint, all workspace tests, and publish dry run passed; CLI passed 385 tests with 2 existing skips under workspace load, and final status was empty                                                                    | Commit the gate record, push normally, and require all PR checks on the repaired exact head                  |
| 45        | Stage 3  | Completed Stage 3 delivery and the final independent review at `ac680374`             | Ready PR #212 targets `main`, remains open and unmerged, and all seven quality-check, Windows security, CodeQL, and Socket checks passed at the exact recorded source head in [CI run 30214886101](https://github.com/rexeus/typeweaver/actions/runs/30214886101); the final report records every criterion and all review findings, with no unresolved in-scope critical or high-confidence high-impact finding                                                                  | Commit the completion record, push normally, and require the same checks on the docs-only successor          |
| 46        | Stage 3  | Reached the authentication-review gate's workspace test boundary                      | Every required command through lint passed at `73fb710b`; root `pnpm test` then passed all product assertions except the warning-threshold validation process case, which timed out at Vitest's 5-second default under full-workspace contention after passing sequentially in 2.189 seconds                                                                                                                                                                                      | Apply the established 15-second process-test budget and rerun the focused test                               |
| 47        | Stage 3  | Stabilized validation warning-threshold coverage under full-workspace load            | The focused validation process file passes 5/5 with the warning-threshold case completing in 2.086 seconds under the repository's established 15-second budget; standalone lint and format verification also pass                                                                                                                                                                                                                                                                 | Commit the focused timeout repair, then restart the complete Stage 3 gate from scratch                       |
