# Repair the documentation baseline in PR #214

## Outcome

PR #214 gives users correct TypeWeaver commands, keeps Markdown link discovery explicit, contained,
and covered, registers each rewritten public guide with a representative executable or typechecked
example plus exact fixture mappings for declared snippets, remediates the published Effect
dependency family, and returns to review with fresh evidence.

## Context and handoff

PR #214 (`docs/documentation-standard`, head `ec0bbc3`) is mergeable against `main` (the
human-merged product-maturity delivery at `af7e0ddf`) and its historical checks passed. Independent
review found bounded documentation-verification defects: the getting-started guide and the
project-init README template use pnpm's builtin `doctor` instead of the TypeWeaver script. A further
finding is precision rather than a reproduced defect: the checker leaned on Git's implicit `*.md`
pathspec, which is already recursive, without making its intent or its root/nested/tracked/untracked
coverage explicit. The published CLI also declared caret `@effect/*` ranges that now resolve to
patches requiring a newer Effect peer than the 3.22.0 baseline.

## Related plans

- **Roadmap:** [004](004-post-maturity-roadmap.md)
- **Next milestone:** [006](006-strict-object-warning-215.md)
- **Dependencies:** none; this milestone establishes the documentation structure used later.

## Scope

### In scope

- Change the scaffold guidance and the project-init template to invoke the TypeWeaver doctor script
  unambiguously, and add repository-truth coverage that rejects the stale form.
- Make Markdown discovery intent explicit and pin root, nested, tracked, and untracked coverage with
  an isolated-repository self-test.
- Restore Effect 3.22.0 resolution in fresh packed consumers by pinning the published `@effect/*`
  dependency versions and verifying the transitive `@effect/platform-node-shared` identity at
  runtime.
- Remove packaged-consumer-only peer overrides that a real consumer cannot inherit, keeping only
  manifest-level fixes.
- Register each rewritten public guide that contains code with a representative executable or
  typechecked documentation fixture, pin every declared documentation snippet to its fixture
  exactly, correct stale examples rather than claiming unchecked prose is TypeScript, and reject
  Markdown links that resolve outside the repository root.
- Correct the OpenAPI metadata claim to the fields the authoring contract defines and the document
  assembler projects, with a repository-truth guard.
- Include the post-maturity roadmap and milestone plan files (004–009) in PR #214, as explicitly
  authorized, and describe them in the pull request.
- Revalidate PR #214 and resolve justified review threads.

### Out of scope

- Product runtime or public type changes beyond the pinned dependency versions.
- Unrelated prose expansion.
- Upgrading the Effect baseline beyond 3.22.0.
- Merging PR #214.

## Decisions

- **Use `pnpm run doctor` in documentation and the project-init template** — `pnpm doctor` is a pnpm
  builtin; the explicit `run` form invokes the generated package script, and repository-truth checks
  keep both onboarding paths aligned.
- **Make the Markdown pathspec intent explicit and cover it** — ordinary `*.md` is already recursive
  under Git default pathspec semantics, so the improvement is an explicit top-scoped glob
  (`:(top,glob)**/*.md`) plus an isolated OS-temp repository self-test for root, nested, tracked,
  and non-ignored untracked Markdown.
- **Pin the published Effect family to the baseline** — exact `@effect/*` versions (including the
  transitive `@effect/platform-node-shared`) keep Effect 3.22.0 peer-coherent in fresh consumers
  instead of resolving newer patches that require a newer Effect release. The packed-consumer gate
  resolves `@effect/platform-node-shared` from the installed `@effect/platform-node` anchor and
  asserts one real identity, and the Effect version contract rejects published-family caret drift
  from the accepted versions in `config/effect-baseline.json`.
- **Remove harness-only peer overrides** — the packed-consumer WASI overrides masked resolution that
  a real consumer cannot inherit; the packed gate passes without them, so they are deleted rather
  than reproduced in the harness.

## Plan

- [ ] 1. **Rebase or integrate current remote main safely**
  - **Outcome:** the existing PR branch is current without history rewriting.
  - **Evidence:** GitHub reports a clean merge and the branch contains only intended PR work.
- [ ] 2. **Correct the doctor command**
  - **Outcome:** every onboarding path and the project-init template invoke TypeWeaver's doctor
    command.
  - **Evidence:** repository-truth checks reject the stale `pnpm doctor` form in both files.
- [ ] 3. **Make link discovery explicit and covered**
  - **Outcome:** the checker states recursive tracked/untracked discovery intent, and a self-test
    proves root, nested, tracked, and non-ignored untracked Markdown are all checked.
  - **Evidence:** the self-test runs against an isolated OS-temp Git repository, cleans it up, then
    runs the real repository checker.
- [ ] 4. **Remediate the published Effect dependency family**
  - **Outcome:** the published `@rexeus/typeweaver` and `@rexeus/typeweaver-gen` manifests pin the
    baseline-compatible `@effect/*` versions, including the transitive
    `@effect/platform-node-shared` identity, and the lockfile, accepted-version guard, and Changeset
    ship in the same change.
  - **Evidence:** `pnpm install --frozen-lockfile`, `pnpm verify:effect-version`,
    `pnpm verify:packed-consumers`, and `pnpm publish:dry` exit 0, and the Changeset names the
    public dependency change. This work package is required before revalidation: the documentation
    milestone cannot complete while the published dependency change is absent from the PR.
- [ ] 5. **Revalidate and update PR #214**
  - **Outcome:** the existing PR is ready for human review with the plan files described in it, at
    the head produced by the dependency remediation.
  - **Evidence:** this final work package reruns the required set at the resulting head —
    `pnpm install --frozen-lockfile`, `pnpm verify:effect-reference`, `pnpm verify:effect-version`,
    `pnpm verify:packed-consumers`, `pnpm docs:check`, `pnpm format:check`, `pnpm lint`,
    `pnpm verify:architecture-contracts`, `pnpm publish:dry`, and `git diff --check` — and all
    required GitHub checks pass at that head.

## Risks and open questions

- **WASI peer overrides** — removed from the packed-consumer harness. The optional WASI bindings are
  not selected on the verified platforms, the packed gate passes without the overrides, and a real
  consumer could not inherit them. A platform that actually falls back to `wasm32-wasi` is not
  covered by a repository gate and would need a manifest-level pin if it ever fails.
- **Effect family drift** — future `@effect/*` releases can reintroduce peer drift; the exact pins,
  the accepted versions in `config/effect-baseline.json`, and the packed-consumer identity assertion
  are the guard, and a baseline upgrade remains a separate decision.

## References

- [PR #214](https://github.com/rexeus/typeweaver/pull/214) — branch and review context.
- [`scripts/check-markdown-links.mjs`](../scripts/check-markdown-links.mjs) — discovery
  implementation.
- [`docs/getting-started.md`](../docs/getting-started.md) — onboarding contract on the PR branch.
