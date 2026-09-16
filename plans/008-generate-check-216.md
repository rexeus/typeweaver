# Add generated-output drift checking

## Outcome

`typeweaver generate --check` performs fresh isolated generation, compares relative paths and bytes
with the configured output, reports deterministic added/removed/changed groups, and never mutates
the configured output tree.

## Context and handoff

Issue #216 is a public CLI counterpart to the private `scripts/verify-generated.mjs` algorithm. The
current `Generator` assumes its output is writable and runs preflight, locking, generation, index
creation, and formatting there. `ProjectValidator` already demonstrates OS-temp scoped staging and
project `node_modules` linking. Issue #186 proposes related dry-run staging but does not compare
committed output.

## Related plans

- **Roadmap:** [004](004-post-maturity-roadmap.md)
- **Previous milestone:** [007](007-typed-http-boundaries-pr-213.md)
- **Next milestone:** [009](009-effect-4-compatibility-217.md)

## Scope

### In scope

- CLI-only `generate --check` for config and explicit-option workflows.
- Scoped OS-temp generation with project dependency resolution.
- Byte-level regular-file comparison and deterministic drift diagnostics.
- Cleanup on success, failure, comparison error, and graceful interruption.
- Executable CI/package-script documentation, tests, and a CLI Changeset.

### Out of scope

- Applying generated changes, a general directory-diff command, or repeated determinism runs.
- JSON diagnostics unless separately designed as a stable report schema.
- Guarantees after `SIGKILL` or machine failure.
- Bundling unrelated #186 namespace/formatter work into this PR.

## Decisions

- **`--check` is CLI-only** — putting it in `TypeweaverConfig` would make ordinary generation mode a
  project property and leak check policy into plugin configuration.
- **Fresh generation is authoritative** — `added` means present only in fresh output, `removed`
  means present only in committed output, and `changed` means equal path with unequal bytes.
- **`clean:false` still compares the complete resulting contract** — stage a copy of the existing
  output before generation when preservation semantics matter, so check mirrors normal generation
  without mutating source. Characterize this before implementation.
- **Regular files are the portable comparison contract** — reject unsupported filesystem entry types
  with a typed actionable error; do not silently follow arbitrary symlinks.
- **Reuse one isolated-generation abstraction with future `--dry-run`** — share staging and
  dependency linking, while keeping check-specific comparison/reporting separate.

## Plan

- [ ] 1. **Accept the CLI contract with failing process tests**
  - **Outcome:** flags, exit codes, terminology, missing output, no-write behavior, and
    `clean:false` semantics are executable before implementation.
  - **Evidence:** process/service tests fail for the absent mode and encode no JSON promise.
- [ ] 2. **Extract scoped isolated generation**
  - **Outcome:** generation can run against an OS-temp target with both resolved output fields
    changed and project dependencies available, without touching configured output.
  - **Evidence:** tests observe staging outside the project and cleanup after success, typed
    failure, and interruption.
- [ ] 3. **Implement deterministic comparison and diagnostics**
  - **Outcome:** regular files are compared by sorted relative path and bytes; every drift category
    is reported through a typed CLI failure.
  - **Evidence:** unit tests cover matching, added, removed, changed, binary, missing, unreadable,
    and unsupported-entry cases.
- [ ] 4. **Integrate the CLI and concurrency behavior**
  - **Outcome:** config and explicit flags work; check detects or avoids torn reads during
    concurrent generation using the existing output-lock contract.
  - **Evidence:** process and lifecycle tests pass without configured-output writes.
- [ ] 5. **Document and deliver**
  - **Outcome:** users have an executable package-script/CI example and release note.
  - **Evidence:** docs checks, CLI tests/typecheck, generated verification, full repository gate,
    and required PR checks pass in a dedicated PR closing #216.

## Risks and open questions

- **Lock semantics for read-only checks** — characterize the existing lock path before deciding
  whether check acquires it or detects an active writer; never promise a coherent snapshot without a
  synchronization mechanism.
- **Overlap with #186** — share only the staging primitive now; implement dry-run UI and unrelated
  namespace/formatter changes separately.

## References

- [Issue #216](https://github.com/rexeus/typeweaver/issues/216) — accepted behavior.
- [Issue #186](https://github.com/rexeus/typeweaver/issues/186) — related but distinct dry-run
  scope.
- [`scripts/verify-generated.mjs`](../scripts/verify-generated.mjs) — private comparison precedent.
- [`ProjectValidator.ts`](../packages/cli/src/services/ProjectValidator.ts) — scoped staging
  precedent.
