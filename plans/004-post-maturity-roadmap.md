# Post-maturity delivery roadmap

## Outcome

Turn the current open pull requests and issues into a dependency-ordered sequence of truthful,
reviewable deliveries: establish the documentation baseline, remove false schema warnings, repair
the typed HTTP boundary contract, add generated-output drift checking, and define an honest Effect 4
compatibility path.

## Context and handoff

The product-maturity goal in [`GOAL.md`](../GOAL.md) is complete on `main` at `af7e0ddf`, the human
merge of Stage 3 PR #212, so PRs #209, #211, and #212 are all human-merged. PR #211's metadata,
security, plugin-validation, and OpenAPI contracts are stable dependencies. PRs #213 and #214 are
open; PR #218 implements Issue #215, stacked on PR #214, and PR #219 implements Issue #216, stacked
on PR #213. Issue #217 remains split between present-day workspace compatibility and a future
coordinated Effect 4 migration.

Independent review found that neither open PR should merge unchanged. PR #214 has bounded
documentation-verification defects (stale doctor guidance in two onboarding paths), an implicit
rather than reproduced link-discovery gap, and published `@effect/*` caret ranges that drifted off
the Effect 3.22.0 baseline in fresh packed consumers. PR #213 has public type/runtime contract
defects around dynamic validation, raw transport shapes, and record-array normalization. PR #213 has
been repaired on branch `codex/issue-206-typed-http-boundary`, targets the PR #218 branch, and is
review-ready at green head `53ff8f5c`. Issue #215 is implemented by open, review-ready PR #218 at
green head `41aee989`, stacked on PR #214, and awaits human review and merge. Issue #216 is
delivered as open, review-ready PR #219. Issue #217 phase A is implemented on
`feat/effect-4-compatibility-217` as open, review-ready PR #220 at green source head `6978bf65`;
phase B remains blocked until Effect 4 is stable.

## Related plans

- **Milestones:** [005](005-docs-baseline-pr-214.md), [006](006-strict-object-warning-215.md),
  [007](007-typed-http-boundaries-pr-213.md), [008](008-generate-check-216.md), and
  [009](009-effect-4-compatibility-217.md)
- **Dependencies:** execute milestones in numeric order, stacking each milestone on the previous
  milestone's branch when it is not yet human-merged; Effect 4 phase B remains conditional on a
  stable upstream release.

## Scope

### In scope

- Repair and revalidate existing PRs #214 and #213.
- Implement issues #215 and #216 as separate pull requests.
- Deliver the immediately truthful compatibility part of #217 and preserve an executable migration
  plan for stable Effect 4.
- Keep documentation, generated fixtures, Changesets, migration notes, and package contracts
  aligned.

### Out of scope

- Reopening the merged contracts from PR #211 without new contradictory evidence.
- Claiming one runtime identity can execute both Effect 3 and Effect 4 values.
- Publishing against an open-ended Effect 4 release-candidate range.
- Merging pull requests, publishing packages, or creating releases autonomously.

## Decisions

- **Documentation baseline first** — PR #214 rewrites the same package guides later milestones must
  update. Repairing it first avoids repeated documentation and accidental loss during rebases.
- **Correctness before new CLI capability** — PR #213 stabilizes the public HTTP boundary and a
  large generated fixture tree before #216 compares committed output against fresh generation.
- **One delivery per independently reviewable milestone** — update the existing PR for #214 and
  #213; create a separate PR implementing each of issues #215, #216, and #217 phase A. Milestones
  may stack: the PR implementing Issue #215 (`fix/strict-object-never-warning`) targets
  `docs/documentation-standard`, and later milestones may target the previous milestone's branch
  until a human merges it.
- **Two-stage Effect 4 strategy** — document and prove isolated CLI use in Effect 4 workspaces now;
  migrate the Effect-native plugin and adapter surfaces only after Effect 4 and its CLI/platform
  dependencies are stable.

## Plan

- [ ] 1. **Establish the documentation baseline**
  - **Outcome:** PR #214 contains the review corrections and has fresh required checks.
  - **Evidence:** [Plan 005](005-docs-baseline-pr-214.md) is complete and PR #214 is review-ready.
- [x] 2. **Remove strict-object false warnings**
  - **Outcome:** strict-object `never` catchalls no longer emit `unsupported-schema`, while genuine
    unsupported schemas still do.
  - **Evidence:** [Plan 006](006-strict-object-warning-215.md) is DONE (review-ready) in
    [PR #218](https://github.com/rexeus/typeweaver/pull/218), which targets
    `docs/documentation-standard` (PR #214). At exact head `41aee989`, `quality-check`,
    `windows-security`, `Socket Security: Project Report`, and
    `Socket Security: Pull Request Alerts` all pass. Evidence:
    [CI run 35239621218](https://github.com/rexeus/typeweaver/actions/runs/35239621218). The PR
    remains open and unmerged; the other milestone states are tracked below.
- [x] 3. **Make typed HTTP boundaries truthful**
  - **Outcome:** PR #213's raw, validated, dynamic-mode, and record contracts agree at type and
    runtime boundaries.
  - **Evidence:** [Plan 007](007-typed-http-boundaries-pr-213.md) is DONE (review-ready) in
    [PR #213](https://github.com/rexeus/typeweaver/pull/213), stacked on the PR #218 branch. At
    exact head `53ff8f5c`, all current required quality, Windows security, and Socket checks pass.
    Evidence: [CI run 35274415172](https://github.com/rexeus/typeweaver/actions/runs/35274415172).
    The PR is open, mergeable, and unmerged.
- [x] 4. **Add generated-output drift checking**
  - **Outcome:** `typeweaver generate --check` detects added, removed, and changed output without
    mutating the configured directory.
  - **Evidence:** [Plan 008](008-generate-check-216.md) is DONE (review-ready) in
    [PR #219](https://github.com/rexeus/typeweaver/pull/219), targeting
    `codex/issue-206-typed-http-boundary`. At exact head `04763a64`, `quality-check`,
    `windows-security`, `Socket Security: Project Report`, and
    `Socket Security: Pull Request Alerts` pass. Evidence:
    [CI run 35300879454](https://github.com/rexeus/typeweaver/actions/runs/35300879454). The PR is
    open, mergeable, and unmerged.
- [x] 5. **Deliver the honest Effect 4 compatibility path**
  - **Outcome:** present-day independent surfaces and CLI isolation are documented and executable;
    Effect-native migration remains gated on stable Effect 4.
  - **Evidence:** [Plan 009](009-effect-4-compatibility-217.md) phase A is DONE (review-ready) in
    [PR #220](https://github.com/rexeus/typeweaver/pull/220), stacked on PR #219. At exact source
    head `6978bf65`, `quality-check`, `windows-security`, `Socket Security: Project Report`, and
    `Socket Security: Pull Request Alerts` pass in
    [CI run 35300881218](https://github.com/rexeus/typeweaver/actions/runs/35300881218). The PR is
    open and unmerged. Phase B remains BLOCKED on a stable, aligned Effect 4 release.

## Final validation

- Each milestone runs its narrow checks, then the repository gate required by its public impact.
- Existing PRs receive fresh CI at their corrected head; new PRs remain one coherent contract each.
- Generated outputs are changed only through their owning generators.
- Every public behavior change includes the required Changeset and migration or release note.

## Risks and open questions

- **Human merge ordering** — the owner approved stacked delivery: the PR implementing Issue #215
  (`fix/strict-object-never-warning`) targets `docs/documentation-standard`, and later milestones
  may target the previous milestone's branch. A stacked branch still does not substitute for human
  approval; no plan authorizes merging.
- **Effect 4 timing** — phase B must be replanned if stable Effect 4 materially differs from rc.115
  or its CLI remains unstable.
- **Release PR #205** — package-version publication is outside this roadmap and must not be mixed
  into feature branches.

## References

- [`GOAL.md`](../GOAL.md) — completed product contract and full repository gate.
- [PR #211](https://github.com/rexeus/typeweaver/pull/211) — merged generator-neutral contract
  baseline.
- [PR #213](https://github.com/rexeus/typeweaver/pull/213) — current typed HTTP boundary
  implementation.
- [PR #214](https://github.com/rexeus/typeweaver/pull/214) — current documentation overhaul.
- [Issues #215–#217](https://github.com/rexeus/typeweaver/issues) — accepted problem statements.
