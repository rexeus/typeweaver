# Add generated-output drift checking

## Status

**DONE (review-ready)** on `feat/generate-check-216`, stacked on PR #213 as
[PR #219](https://github.com/rexeus/typeweaver/pull/219). The complete implementation and CI repairs
are at exact head `04763a64`; the PR is open, mergeable, and unmerged. `quality-check`,
`windows-security`, `Socket Security: Project Report`, and `Socket Security: Pull Request Alerts`
all pass in [CI run 35300879454](https://github.com/rexeus/typeweaver/actions/runs/35300879454).

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

- [x] 1. **Accept the CLI contract with failing process tests**
  - **Outcome:** flags, exit codes, terminology, missing output, no-write behavior, and
    `clean:false` semantics are executable before implementation.
  - **Evidence:** The pre-fix run failed because `--check` and the checker/comparison modules did
    not exist; `generateCheck.process.test.ts` now covers config and explicit flags, match, all
    three drift groups, missing output, `clean:false`, and generation failure with no output
    mutation.
- [x] 2. **Extract scoped isolated generation**
  - **Outcome:** generation can run against an OS-temp target with both resolved output fields
    changed and project dependencies available, without touching configured output.
  - **Evidence:** `projectStaging.ts` is shared by `ProjectValidator` and `GeneratedOutputChecker`;
    `withStagedProject` tests prove stage removal on success, typed failure, defect, and
    interruption while linking the nearest `node_modules`.
- [x] 3. **Implement deterministic comparison and diagnostics**
  - **Outcome:** regular files are compared by sorted relative path and bytes; every drift category
    is reported through a typed CLI failure.
  - **Evidence:** `outputComparison.test.ts` covers matching, added, removed, changed, binary,
    missing committed output, deterministic sort, unreadable files, and symbolic-link rejection.
- [x] 4. **Integrate the CLI and concurrency behavior**
  - **Outcome:** config and explicit flags work; check detects or avoids torn reads during
    concurrent generation using the existing output-lock contract.
  - **Evidence:** Output locks are flat `.typeweaver-output-lock-<hash>` entries created `0700` with
    `0600` metadata directly under the platform system temp directory (POSIX root-owned sticky
    `/tmp`; Windows the drive-independent `\\?\GLOBALROOT\SystemRoot\Temp` namespace with inherited
    system-directory ACLs), so no user owns a shared parent and no artifact is written inside
    output. Identity realpath-resolves the nearest existing ancestor and case-folds the whole
    canonical path, so a missing mixed-case output and its later-created form share one lock (unit +
    process race tests). Normal generation creates output only after acquiring the lock. Staging
    lives directly under the trusted parent, and checks mirror the ancestor `node_modules` topology
    of the original `<configured output>/spec/spec.js` including fallback past a partial nearest
    directory (hoisted fixture test); validation restores its pre-PR cwd-nearest lookup. Staged
    generation is gated by an internal unforgeable authority and must descend from the created
    stage. Legacy `.typeweaver-lock` is classified with lstat/no-follow: a complete dead lock is
    excluded by check and removed by later clean, while live/malformed/symlinked/uncertain locks
    fail closed before clean and require manual removal; fence and other lookalike artifacts are
    ordinary drift and clean-removable. A two-process test plus
    alias/case/reserved/legacy/mixed-version tests cover the contract. `--verbose` keeps debug lock
    and lifecycle output.
- [x] 5. **Document and deliver**
  - **Outcome:** users have an executable package-script/CI example and release note.
  - **Evidence:** CLI README and getting-started document `generate --check` with an executable
    documentation workflow; `MIGRATION.md` documents the flat lock move, whole-path case folding,
    drive-independent Windows system temp, reserved namespace, remediation, and mixed-version
    constraint; a minor `@rexeus/typeweaver` Changeset is present; the Windows security gate runs
    the new staging, comparison, checker, and process suites. Cross-drive spec staging was repaired
    at `14710950`; its external-classification regression test was made filesystem-independent at
    `d0a6d01b`; and process lock contention now uses a deterministic held/release handshake at
    `04763a64`. The final Linux quality job covers frozen installation, build, generation,
    Node/Deno/Bun bundles, typechecking, architecture contracts (including workspace tests and
    packed consumers), docs, format, lint, and publish dry-run; it and the Windows security job pass
    at the exact PR head.

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
