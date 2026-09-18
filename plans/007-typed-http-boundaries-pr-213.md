# Repair typed HTTP boundaries in PR #213

**Status:** DONE (review-ready) — repaired and delivered at exact head `53ff8f5c`. PR #213 is open,
mergeable, and unmerged; all current required quality, Windows security, and Socket checks pass in
[CI run 35274415172](https://github.com/rexeus/typeweaver/actions/runs/35274415172).

**Stack:** PR [#213](https://github.com/rexeus/typeweaver/pull/213) on branch
`codex/issue-206-typed-http-boundary` targets `fix/strict-object-never-warning` (PR
[#218](https://github.com/rexeus/typeweaver/pull/218)) at head `41aee989`, which targets
`docs/documentation-standard` (PR [#214](https://github.com/rexeus/typeweaver/pull/214)). The
preceding milestone was integrated into this branch by merge commit `ab509e78`
(`chore(stack): integrate preceding milestones`), not by rebase.

## Outcome

PR #213 exposes raw transport, validated handler, and client scalar contracts that agree with actual
Server and Hono runtime behavior for every validation mode and supported object/record schema.

## Context and handoff

PR #213 (`codex/issue-206-typed-http-boundary`, originally head `8700698a`) passed historical CI,
but independent review found blocking soundness defects. Dynamic `boolean` validation was typed as
raw while runtime may pass validated output; operation-specific raw types derived multiplicity and
requiredness from validated output; and accepted array-valued records did not normalize singleton
transport values. Concrete `unknown`/`any` record values also bypassed the client scalar boundary.
The PR's scalar serializer and broad migration structure are otherwise useful. The preceding
`fix/strict-object-never-warning` milestone (PR #218, head `41aee989`) was integrated by merge
commit `ab509e78` so PR #213 stacks on PR #218. No force-push or history rewrite was used.

## Related plans

- **Roadmap:** [004](004-post-maturity-roadmap.md)
- **Previous milestone:** [006](006-strict-object-warning-215.md)
- **Next milestone:** [008](008-generate-check-216.md)

## Scope

### In scope

- Make Server and Hono validation-mode types match runtime outcomes and constructor defaults.
- Derive operation-specific raw types from transport guarantees and pre-validation absence.
- Either support array-valued records end to end or reject them at authoring time with a precise
  type contract; choose based on the smallest coherent public contract.
- Reject concrete `unknown`, `any`, object, and nested-array outputs from client scalar positions.
- Regenerate all outputs and update Changeset/migration claims.

### Out of scope

- Effect 4 support.
- Response-header widening or comma-based duplicate-scalar inference.
- Unrelated client or server API redesign.

## Decisions

- **Dynamic mode must expose `Validated | Raw` or be prohibited** — fail-closed `Raw` is not
  truthful when runtime `true` delivers transformed values. Prefer the union unless evidence shows
  it makes handlers unusable; otherwise reject dynamic configuration explicitly.
- **Raw types describe adapters, not schemas' outputs** — query/header values are pre-validation
  strings or repeated strings and may be absent; validated requiredness cannot leak backward.
- **Behavior before convenience for records** — if value-schema-aware normalization cannot be made
  correct without fragile Zod introspection, reject array-valued records and document the boundary.

## Plan

- [x] 1. **Integrate the existing PR after prior milestones**
  - **Outcome:** PR #213 preserves the new documentation structure and current warning behavior.
  - **Evidence:** branch stacked on `fix/strict-object-never-warning` (PR #218, head `41aee989`)
    through merge commit `ab509e78`; `git merge-base` equals the PR #218 head; no force-push and no
    hand-edited generated fixtures.
- [x] 2. **Characterize every reported unsound path**
  - **Outcome:** type and runtime tests fail for dynamic true/false, omitted explicit false options,
    repeated scalar transport, absent required fields before validation, singleton record arrays,
    and concrete unknown/any record outputs.
  - **Evidence:** before the fix, `HttpRequestBoundary.contract.tst.ts` rejected two unused
    `@ts-expect-error` directives for concrete `unknown`/`any` record values and five
    `IRawHttpRequestFor` assignability errors for repeated scalar query, comma-delimited array
    header, and absent required query/header values.
- [x] 3. **Correct validation-mode and raw boundary contracts**
  - **Outcome:** public and generated types match constructor defaults and adapter output.
  - **Evidence:** `RequestValidationMode.contract.tst.ts` and runtime dynamic-mode tests pass for
    default, literal true, literal false, and dynamic `boolean` in both Server and Hono; raw
    contracts derive query/header absence and `string | readonly string[]` from adapters.
- [x] 4. **Resolve record normalization and scalar admissibility**
  - **Outcome:** every accepted schema round-trips client → adapter → validator, and unsupported
    outputs fail at `defineOperation`.
  - **Evidence:** `GetMetricSamples` generated validator tests cover singleton and repeated
    array-valued records plus comma-delimited header records; `defineOperation` type contracts
    reject concrete unknown/any/object/nested-array record values while keeping the base
    `RequestDefinition` and unresolved `z.ZodType` usable.
- [x] 5. **Regenerate and reconcile the public contract**
  - **Outcome:** generated fixtures, READMEs, migration guide, and Changeset state only behavior
    that executable evidence proves.
  - **Evidence:** `pnpm verify:generated` reproduces 283 committed fixture files exactly; READMEs,
    migration guide, and Changeset describe the corrected contract.
- [x] 6. **Run the complete repository gate and update PR #213**
  - **Outcome:** no unresolved high-confidence contract finding remains.
  - **Evidence:** local focused and repository gates, packed-consumer and generated verification,
    and the current required `quality-check`, `windows-security`, `Socket Security: Project Report`,
    and `Socket Security: Pull Request Alerts` pass at corrected head `53ff8f5c`. The independent
    final review found no unresolved material issue.

## Risks and open questions

- **Dynamic union ergonomics** — test representative handler code before finalizing the public
  shape.
- **PR size** — generated files dominate the diff; keep authored fixes in reviewable logical commits
  and make fixture regeneration mechanically identifiable.

## References

- [Issue #206](https://github.com/rexeus/typeweaver/issues/206) — normative typed-boundary contract.
- [PR #213](https://github.com/rexeus/typeweaver/pull/213) — existing implementation and review
  threads.
- [`HttpRequest.ts`](../packages/core/src/HttpRequest.ts) — raw/validated request contract.
- [`Validator.ts`](../packages/types/src/lib/Validator.ts) — multiplicity normalization.
