# Repair typed HTTP boundaries in PR #213

## Outcome

PR #213 exposes raw transport, validated handler, and client scalar contracts that agree with actual
Server and Hono runtime behavior for every validation mode and supported object/record schema.

## Context and handoff

PR #213 (`codex/issue-206-typed-http-boundary`, head `8700698a`) is based on current `main` and
passed historical CI, but independent review found blocking soundness defects. Dynamic `boolean`
validation is typed as raw while runtime may pass validated output; operation-specific raw types
derive multiplicity and requiredness from validated output; and accepted array-valued records do not
normalize singleton transport values. Concrete `unknown` record values also bypass the client scalar
boundary. The PR's scalar serializer and broad migration structure are otherwise useful.

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

- [ ] 1. **Rebase the existing PR after prior milestones**
  - **Outcome:** PR #213 preserves the new documentation structure and current warning behavior.
  - **Evidence:** clean merge state without force-push or hand-edited generated fixtures.
- [ ] 2. **Characterize every reported unsound path**
  - **Outcome:** type and runtime tests fail for dynamic true/false, omitted explicit false options,
    repeated scalar transport, absent required fields before validation, singleton record arrays,
    and concrete unknown/any record outputs.
  - **Evidence:** focused Core, Types, Server, and Hono tests demonstrate each pre-fix mismatch.
- [ ] 3. **Correct validation-mode and raw boundary contracts**
  - **Outcome:** public and generated types match constructor defaults and adapter output.
  - **Evidence:** type contracts and runtime tests pass for default, literal true, literal false,
    and accepted dynamic behavior in both Server and Hono.
- [ ] 4. **Resolve record normalization and scalar admissibility**
  - **Outcome:** every accepted schema round-trips client → adapter → validator, and unsupported
    outputs fail at `defineOperation`.
  - **Evidence:** generated integration tests cover singleton/repeated values and negative type
    cases.
- [ ] 5. **Regenerate and reconcile the public contract**
  - **Outcome:** generated fixtures, READMEs, migration guide, and Changeset state only behavior
    that executable evidence proves.
  - **Evidence:** deterministic generation reproduces the committed tree exactly.
- [ ] 6. **Run the complete repository gate and update PR #213**
  - **Outcome:** no unresolved high-confidence contract finding remains.
  - **Evidence:** the full gate from `GOAL.md`, packed-consumer and generated verification, fresh
    quality-check, Windows, CodeQL, and Socket checks pass at the corrected head.

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
