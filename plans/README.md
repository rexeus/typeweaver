# TypeWeaver Product Maturity Plans

These plans were created on 2026-07-26 at commit `3c97d402`. They implement the contract in
[`GOAL.md`](../GOAL.md) as three stacked pull requests.

The planning branch contains no product implementation. After this planning PR is merged, execute
the plans in order. Every executor must read `GOAL.md`, this index, and the current plan completely
before changing files.

## Execution order and status

| Plan                                        | Stage | Title                                                       | Priority | Effort | Depends on             | Status |
| ------------------------------------------- | ----- | ----------------------------------------------------------- | -------- | ------ | ---------------------- | ------ |
| [001](001-product-truth-and-type-safety.md) | 1     | Establish product truth and close type-safety gaps          | P1       | L      | Planning PR merged     | DONE   |
| [002](002-contract-and-openapi-maturity.md) | 2     | Mature the core contract and OpenAPI projection             | P1       | L      | 001 PR open and green  | DONE   |
| [003](003-developer-surfaces.md)            | 3     | Deliver plugin, CLI, generated-command, and Effect surfaces | P1       | XL     | 002 human-merged green | DONE   |

Status values: `TODO`, `IN PROGRESS`, `DONE`, `BLOCKED: <reason>`, or `REJECTED: <reason>`.

## Dependency graph

```text
planning PR -> 001 product truth and type safety
                    |
                    v
              002 contract and OpenAPI maturity
                    |
                    v
              003 developer surfaces and final review
```

The ordering is product-driven:

- Documentation examples and public type boundaries become trustworthy before new public contracts
  are added.
- Security, metadata, diagnostics, and OpenAPI profiles exist before the generated CLI consumes
  them.
- Plugin scaffolding, the generated command client, and the Effect handler adapter build on the
  final normalized contract rather than inventing parallel metadata.

## Pull request delivery

| Plan | Branch                               | Base                                                 | Merge policy            |
| ---- | ------------------------------------ | ---------------------------------------------------- | ----------------------- |
| 001  | `feat/product-truth-and-type-safety` | `main`                                               | Human merged as PR #209 |
| 002  | `feat/contract-and-openapi-maturity` | Stage 1 branch                                       | Human merged as PR #211 |
| 003  | `feat/developer-surfaces`            | `main` after explicitly authorized merge integration | Open and unmerged       |

The owner confirmed the Stage 1 and 2 merges and authorized Stage 3 to integrate current `main` and
target `main`. The loop is authorized to commit, push, open or update the remaining Stage 3 PR, and
repair CI. It is never authorized to merge that PR, release, publish, force-push, or delete remote
state.

## Shared verification contract

Each plan defines narrow checks. Each stage also ends with the complete gate listed in `GOAL.md`,
including:

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
```

GitHub's Windows security job must also pass. A local green run is necessary but not sufficient for
stage completion.

## Shared implementation conventions

- Node 24, pnpm 10.34.5, TypeScript strict mode, tsdown, Oxlint, and Oxfmt.
- No ESLint installation or configuration.
- Effect 3.22.0 only; public peer range `>=3.22.0 <4`.
- Expected failures use established typed errors. Effect code follows the service/layer patterns in
  ADR 0003 through ADR 0008.
- External input starts as `unknown` and is decoded or narrowed.
- No `any`, unsafe assertions, ignored diagnostics, skipped tests, or hand-edited generated outputs.
- Public behavior changes require Changesets and migration notes.
- Generated fixtures must be regenerated through the owning generator.
- Conventional Commits in English, one logical work package per commit.

## Existing issues covered

The plans incorporate the intent of existing issues without authorizing issue mutation:

- Documentation and architecture truth: #198, #200
- Unsupported Zod types: #193
- Plugin validation and stable diagnostics: #177, #179, #188
- Core security model and OpenAPI validation: #169, #170
- CLI foundation: #178, #180, #181, #182, #183, #186

Before implementing a covered issue, re-read its live state. If the issue is already resolved,
record the evidence and skip duplicate work. Do not close or edit issues without separate user
authorization.

## Considered and deliberately deferred

- **Full OpenAPI import or round-trip:** conflicts with the TypeScript/Zod-first contract and cannot
  preserve arbitrary Zod semantics.
- **Native Effect `HttpApi` generation:** would introduce Effect Schema as a second schema authority
  before TypeWeaver has a schema-dialect abstraction.
- **Koa and Express generators:** add breadth before the core product contract and plugin authoring
  path are mature.
- **ORM, auth-provider, or business-logic generation:** outside TypeWeaver's API-contract and
  projection mission.
- **Unsubstantiated performance work:** only promote after a reproducible benchmark demonstrates a
  meaningful bottleneck.
- **Effect 4 migration:** explicitly outside the accepted Effect baseline.

## Plan maintenance

Each stage branch must update its row and `GOAL.md` with:

- current status
- implemented work packages
- verification commands and results
- commit hashes
- PR URL and exact base branch
- CI check results
- blockers or intentionally rejected discoveries

If source drift invalidates a plan excerpt or assumption, stop that work package, record the
mismatch, and update the plan in a dedicated planning commit before continuing.
