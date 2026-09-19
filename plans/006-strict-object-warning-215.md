# Remove strict-object false schema warnings

## Outcome

Converting strict Zod objects preserves `additionalProperties: false` without reporting the internal
`never` catchall as unsupported, while all genuine lossy-schema warnings remain unchanged.

## Context and handoff

Issue #215 is localized to warning collection. Zod's JSON Schema converter already represents strict
objects correctly. `collectObjectWarnings` previously traversed every catchall and classified the
strict object's internal `never` schema as unsupported.

## Status

DONE (review-ready). Implemented on branch `fix/strict-object-never-warning` at head `d8440f9f`,
stacked on `docs/documentation-standard` (PR #214) and delivered as
[PR #218](https://github.com/rexeus/typeweaver/pull/218). All work packages are complete and every
required check is green at `d8440f9f`:

- `quality-check` — pass
- `windows-security` — pass
- `Socket Security: Project Report` — pass
- `Socket Security: Pull Request Alerts` — pass

The pull request remains open for human review and merge; this plan does not claim a human merge.

## Related plans

- **Roadmap:** [004](004-post-maturity-roadmap.md)
- **Previous milestone:** [005](005-docs-baseline-pr-214.md)
- **Next milestone:** [007](007-typed-http-boundaries-pr-213.md)
- **Dependencies:** stacked on PR #214 (`docs/documentation-standard`) per the approved roadmap
  delivery model; the PR implementing Issue #215 (`fix/strict-object-never-warning`) targets that
  branch.

## Scope

### In scope

- Skip warning traversal only for an object's internal `never` catchall.
- Cover root, nested, and strict response-header objects.
- Preserve warnings for `z.custom()`, transforms, and genuinely unsupported catchalls.
- Add the required patch Changeset and release note.

### Out of scope

- Treating standalone `z.never()` as globally supported.
- Changing emitted JSON Schema or stable warning-code mappings.
- Restructuring warning reporting from issue #188.

## Decisions

- **Contextual exception, not global support** — `never` is exact only as the strict-object catchall
  represented by `additionalProperties: false`; adding it to the global supported set would hide
  unrelated unsupported schemas.

## Plan

- [x] 1. **Add failing characterizations**
  - **Outcome:** tests reproduce root, nested, and response-header false warnings while protecting
    genuine warning cases.
  - **Evidence:** `zodToJsonSchema.test.ts` covers root, nested, and unsupported-property strict
    objects; `buildOpenApiDocument.responses.test.ts` covers the strict response-header container.
    Standalone `z.never()`, `z.custom()`, transforms, and genuine catchalls stay covered.
- [x] 2. **Implement the narrow traversal correction**
  - **Outcome:** warning collection omits only the representable internal catchall.
  - **Evidence:** converter suite 75/75 and OpenAPI suite 130/130 pass, with emitted JSON Schema and
    the `additionalProperties: false` representation unchanged.
- [x] 3. **Document and publish the correction**
  - **Outcome:** consumers can identify the warning reduction as an intentional patch.
  - **Evidence:** `.changeset/strict-object-never-warning.md` covers
    `@rexeus/typeweaver-zod-to-json-schema` and `@rexeus/typeweaver-openapi`; no migration is
    claimed.
- [x] 4. **Run delivery gates**
  - **Outcome:** the change is ready in a dedicated PR closing #215.
  - **Evidence:** package tests/typechecks, OpenAPI tests/typecheck, workspace typecheck/test, docs,
    format, lint, generated verification, and required CI checks pass.
  - **Status:** DONE (review-ready) — [PR #218](https://github.com/rexeus/typeweaver/pull/218)
    targets `docs/documentation-standard` (PR #214) at exact head `d8440f9f`. `quality-check`,
    `windows-security`, `Socket Security: Project Report`, and
    `Socket Security: Pull Request Alerts` all pass at that head. The PR remains open and unmerged;
    no human merge is claimed.

## Risks and open questions

- **Zod internal representation** — use the existing isolated schema-type helper and test behavior;
  do not spread new private Zod introspection.

## References

- [Issue #215](https://github.com/rexeus/typeweaver/issues/215) — behavior and acceptance criteria.
- [`collectZodWarnings.ts`](../packages/zod-to-json-schema/src/internal/collectZodWarnings.ts) —
  faulty object-catchall traversal.
- [`zodToJsonSchema.test.ts`](../packages/zod-to-json-schema/__test__/unit/zodToJsonSchema.test.ts)
  — existing warning and conversion contracts.
