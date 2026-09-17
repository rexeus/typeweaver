# Remove strict-object false schema warnings

## Outcome

Converting strict Zod objects preserves `additionalProperties: false` without reporting the internal
`never` catchall as unsupported, while all genuine lossy-schema warnings remain unchanged.

## Context and handoff

Issue #215 is localized to warning collection. Zod's JSON Schema converter already represents strict
objects correctly. `collectObjectWarnings` currently traverses every catchall and classifies the
strict object's internal `never` schema as unsupported.

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

- [ ] 1. **Add failing characterizations**
  - **Outcome:** tests reproduce root, nested, and response-header false warnings while protecting
    genuine warning cases.
  - **Evidence:** focused tests fail only for the absent strict-object exception.
- [ ] 2. **Implement the narrow traversal correction**
  - **Outcome:** warning collection omits only the representable internal catchall.
  - **Evidence:** focused converter and OpenAPI tests pass without JSON Schema snapshot changes.
- [ ] 3. **Document and publish the correction**
  - **Outcome:** consumers can identify the warning reduction as an intentional patch.
  - **Evidence:** a Changeset covers the affected fixed package group; no migration is claimed.
- [ ] 4. **Run delivery gates**
  - **Outcome:** the change is ready in a dedicated PR closing #215.
  - **Evidence:** package tests/typechecks, OpenAPI tests/typecheck, workspace typecheck/test, docs,
    format, lint, generated verification, and required CI checks pass.

## Risks and open questions

- **Zod internal representation** — use the existing isolated schema-type helper and test behavior;
  do not spread new private Zod introspection.

## References

- [Issue #215](https://github.com/rexeus/typeweaver/issues/215) — behavior and acceptance criteria.
- [`collectZodWarnings.ts`](../packages/zod-to-json-schema/src/internal/collectZodWarnings.ts) —
  faulty object-catchall traversal.
- [`zodToJsonSchema.test.ts`](../packages/zod-to-json-schema/__test__/unit/zodToJsonSchema.test.ts)
  — existing warning and conversion contracts.
