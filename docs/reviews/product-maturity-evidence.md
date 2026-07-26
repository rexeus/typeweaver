# TypeWeaver Product Maturity Evidence Review

## Review status

This report covers the complete three-stage product-maturity stack. The implementation review was
performed after the owner-authorized merge of current `main` at `d8b46cd1`, with all promoted review
fixes included. The post-review complete local Stage 3 gate passed at
`b539a81a654202ab3d557ce4da0f1d188d52de45`. Ready PR #212 targets `main`, remains open and unmerged,
and all required checks passed at that exact delivered source head.

Stages 1 and 2 were green before the human owner merged them. Their current delivery records are:

| Stage | Pull request                                                                  | Reviewed head                              | Merge commit                               | Required checks                                                                                                                         |
| ----- | ----------------------------------------------------------------------------- | ------------------------------------------ | ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | [#209](https://github.com/rexeus/typeweaver/pull/209), `main`, human merged   | `b8861460b501ef19948fa732fc8901c704f6230e` | `81aab076d1ef5f21c084e29427ae299563725014` | [Quality Check](https://github.com/rexeus/typeweaver/actions/runs/30209088039), Windows security, CodeQL, and both Socket checks passed |
| 2     | [#211](https://github.com/rexeus/typeweaver/pull/211), `main`, human merged   | `dfdc3354b24ce627794440703567f15204ab63ef` | `7ca4f26cd03f72e49a472749d6ae14ce9fca21a1` | [Quality Check](https://github.com/rexeus/typeweaver/actions/runs/30209719892), Windows security, and both Socket checks passed         |
| 3     | [#212](https://github.com/rexeus/typeweaver/pull/212), `main`, open and ready | `b539a81a654202ab3d557ce4da0f1d188d52de45` | Must remain unmerged                       | [Quality Check](https://github.com/rexeus/typeweaver/actions/runs/30218172873), Windows security, CodeQL, and both Socket checks passed |

## Full-gate registry

- **G1 — Stage 1:** every command in the `GOAL.md` full repository gate passed under Node 24. The
  clean local result is recorded by `4be4d317`; PR #209 was subsequently green at `b8861460`.
- **G2 — Stage 2:** every command in the full repository gate passed under Node 24.16.0 and pnpm
  10.34.5 with an empty final status. The local result is recorded by `7d80366c`; PR #211 was
  subsequently green at `dfdc3354`.
- **G3 — Stage 3:** every command in the full repository gate passed under Node 24.16.0 and pnpm
  10.34.5 at `b539a81a654202ab3d557ce4da0f1d188d52de45`. Both frozen installs, the pinned Effect
  reference, build, generation, Node/Deno/Bun bundles, 27/27 typecheck tasks, architecture
  contracts, 255 regenerated fixtures, packed consumers, 18 documentation groups and runtime
  workflows, format, lint, all workspace tests, and publish dry run passed; Gen passed 336/336,
  Command passed 19/19, and the final `git status --short` was empty. Ready PR
  [#212](https://github.com/rexeus/typeweaver/pull/212) targets `main`, remains open and unmerged,
  and all quality-check, Windows security, CodeQL, and Socket checks passed at exact delivered
  source head `b539a81a654202ab3d557ce4da0f1d188d52de45` in
  [CI run 30218172873](https://github.com/rexeus/typeweaver/actions/runs/30218172873) and the linked
  check runs.

## Goal criterion evidence

### Stage 1 — product truth and type safety

| Goal criterion                                                                      | Implementation commit and files                                                                              | Narrow verification                                                                                               | Generated or packed evidence                                                       | Full gate and PR                   |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ---------------------------------- |
| Product promise, users, principles, non-goals, workflow, and success signals        | `62856a3d`; `VISION.md`, `scripts/check-vision-contract.mjs`                                                 | `pnpm docs:check`, vision contract checker                                                                        | Executable root quickstart under `packages/cli/examples/documentation/`            | G1; PR #209 checks passed          |
| Repository, contributor, package, toolchain, and architecture truth                 | `62856a3d`; `AGENTS.md`, root/package READMEs, ADRs 0001–0002, `scripts/check-repository-truth.mjs`          | Repository-truth, docs, format, and lint checks                                                                   | Manifest-derived documentation checks                                              | G1; PR #209 checks passed          |
| Public examples are executable or typechecked                                       | `31ad8594`; `config/documentation-examples.json`, documentation fixtures and verifier scripts                | `pnpm docs:check` exercised declared fixtures plus invalid-manifest self-tests; workspace typecheck passed        | Typechecked fixtures in `packages/cli/examples/documentation/`                     | G1; PR #209 checks passed          |
| Unsupported Zod schemas fail actionably instead of becoming `unknown`               | `6c78fba8`; `UnsupportedZodTypeError.ts`, `tsTypeGenerator.ts`, package tests, Changeset and migration guide | 121 package tests characterized six formerly silent fallback shapes; package typecheck/build passed               | The 225-file generated fixture set reproduced without drift                        | G1; PR #209 checks passed          |
| Public HTTP bodies and generated server/Hono declarations contain no implicit `any` | `450408d5`; `HttpBody.ts`, Core/Server/Hono type contracts and adapters, Changeset and migration guide       | `IsAny` characterization covered 4 Core, 3 Server, and 5 Hono contracts; package suites and type contracts passed | Regenerated server/Hono fixtures compiled through Node, Deno, and Bun bundle gates | G1; PR #209 checks passed          |
| Stage 1 public-contract delivery                                                    | `6c78fba8`, `450408d5`, and `4be4d317`; Changesets and `MIGRATION.md`                                        | Changeset status, publish dry run, and the complete local gate                                                    | Publish dry-run package set                                                        | G1; PR #209 green and human merged |

### Stage 2 — contract and OpenAPI maturity

| Goal criterion                                        | Implementation commit and files                                                                                                   | Narrow verification                                                                                                                            | Generated or packed evidence                                                              | Full gate and PR                   |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ---------------------------------- |
| Generator-neutral metadata and first-class security   | `dc6251ac` and `a83c79b4`; ADR 0009, Core authoring types, normalized Gen contract, security tests, Changeset and migration guide | Core 151/151 and Gen 318/318 tests plus public type contracts and workspace typecheck                                                          | Generated metadata/security examples and regenerated test-project output                  | G2; PR #211 checks passed          |
| Side-effect-free plugin validation with stable issues | `f4fd035b`; `Plugin.ts`, validation contexts, issue registry, `PluginRegistry.ts`, compile-negative fixture                       | Gen 325/325 tests; negative `tsc` fixture rejects `writeFile`; ordering, isolation, spans, typed failures, and stable issue codes are asserted | Public plugin documentation fixture                                                       | G2; PR #211 checks passed          |
| Validated OpenAPI 3.1.2 and 3.2.0 profiles            | `567724ef`; OpenAPI model/generator, official-schema validation tests, warning registry, Changeset and migration guide            | 126/126 OpenAPI tests, package typecheck, official version-aware validators, and Spectral for the 3.1.2 fixture                                | `packages/test-utils/src/test-project/output/openapi/openapi.json` and both test profiles | G2; PR #211 checks passed          |
| Honest supported/lossy/out-of-scope OpenAPI matrix    | `f91399f1`; OpenAPI README and documentation contract test                                                                        | 129/129 OpenAPI tests and `pnpm docs:check`                                                                                                    | Executable OpenAPI options fixture                                                        | G2; PR #211 checks passed          |
| Stage 2 public-contract delivery                      | `a83c79b4`, `f4fd035b`, `567724ef`, `f91399f1`, and `7d80366c`; Changesets and `MIGRATION.md`                                     | Changeset status, publish dry run, and complete local gate                                                                                     | Regenerated profile fixtures and publish dry-run package set                              | G2; PR #211 green and human merged |

### Stage 3 — developer surfaces

| Goal criterion                                  | Implementation commit and files                                                                                                                                                                                                                                         | Narrow verification                                                                                                                                                                                                                                                                           | Generated or packed evidence                                                                                                                          | Full gate and PR                        |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| Public third-party plugin starter path          | `4ccbed16`, `d14b80eb`, and concurrency repair `6b0ad927`; public test kit, `defineScopedPlugin`, scaffold templates, docs, Changesets and migration guide                                                                                                              | Gen lifecycle/type tests, CLI scaffold golden process tests, Effect diagnostics, and concurrent two-fiber acquisition/release regression                                                                                                                                                      | `scripts/test-packed-consumers.mjs` installs, tests, builds, and generates from the scaffold in an external workspace                                 | G3; PR #212 checks passed at `b539a81a` |
| Real `init`, `validate`, and `doctor` workflows | `545331b5`, `a8afbb05`, `4c58b17f`, rollback repair `2637dd1d`, review repair `ba58b56a`, test hardening through `3791257d`, and warning-path repair `b539a81a`; CLI services, public report schemas, process/rollback tests, templates, Changesets and migration guide | CLI process coverage proves JSON/human reports, exit codes, no-write validation outside the project tree, atomic publication, ordinary rollback, recoverable rollback failure, stable execution under workspace load, and actionable normalized warning pointers; CLI typecheck passes        | Complete Todo starter templates under `packages/cli/src/templates/project-init/`                                                                      | G3; PR #212 checks passed at `b539a81a` |
| Generated command-line API client               | `0f0ad742`, `887c4b2a`, authentication repair `73fb710b`, and command-name repair `b539a81a`; shared client transport, command generator/runtime/model, public docs, Changesets and migration guide                                                                     | Clients pass 184/184 tests and Command passes 19/19, including mixed-case default-header override, UTF-8 Basic credentials, and a valid generated `version` operation; real-server success, body modes, security, sanitized failures, validation, cancellation, and SIGINT 130 remain covered | Generated commands under `packages/test-utils/src/test-project/output/command/`; packed external consumer compiles and runs                           | G3; PR #212 checks passed at `b539a81a` |
| Optional Effect-returning server handlers       | `fc4cee60`, `8acb009c`, and guide repair `ba58b56a`; request signal, Effect runtime/generator, type/runtime/server-integration tests, public docs, Changesets and migration guide                                                                                       | 9/9 Effect tests cover one managed runtime, generated types, typed failure mapping, defect sanitization, abort interruption, spans, shutdown, and static runtime-boundary rules; Server 834/834 and strict Effect diagnostics passed                                                          | Generated handlers under `packages/test-utils/src/test-project/output/*/Effect*ApiHandler.ts`; packed external consumer uses one Effect 3.22 identity | G3; PR #212 checks passed at `b539a81a` |
| Shipped guides and executable workflows         | `4dfc5e40`, truth repair `ba58b56a`, authentication docs `73fb710b`, and final review docs `b539a81a`; root selection matrix, plugin/CLI/package guides, documentation manifest and runtime-fixture verifier                                                            | `pnpm docs:check` typechecked 18 documentation groups and executed 18/18 built-CLI workflow cases                                                                                                                                                                                             | Executable plugin scaffold, init, validate, doctor, command, and Effect examples                                                                      | G3; PR #212 checks passed at `b539a81a` |
| Final evidence report and independent review    | This report; fixes `6b0ad927`, `2637dd1d`, `ba58b56a`, `006e5321`, `07663af4`, `73fb710b`, and `b539a81a`                                                                                                                                                               | Review dimensions and findings are recorded below; the repaired G3 gate and every PR check passed at the recorded source head                                                                                                                                                                 | All generated and packed evidence above                                                                                                               | G3; PR #212 checks passed at `b539a81a` |
| Stage 3 public-contract delivery                | Stage 3 feature/fix commits and their colocated Changesets plus `MIGRATION.md`                                                                                                                                                                                          | Changeset status and publish dry run passed in G3                                                                                                                                                                                                                                             | Generated fixture set, packed consumers, and publish dry-run package set                                                                              | G3; PR #212 open, green, and unmerged   |

## Independent review

### Scope and method

The fresh review pass considered the complete Stage 3 diff from merged `main` (`7ca4f26c`) through
`b539a81a`, including the normal integration merge `d8b46cd1`, the first completed Copilot review at
`a1c6479b`, the authentication-header review, and the final warning-location and command-name
review. It reviewed correctness, security, public TypeScript API design, Effect 3 practices, tests,
maintainability, plugin DX, OpenAPI boundaries, documentation, package manifests, Changesets,
migration guidance, generated fixtures, and packed-consumer isolation.

Static review also checked the added TypeScript lines for new `any`, unsafe casts, ignored
TypeScript diagnostics, test skips/todos, and authored lint suppressions. None were added. The only
matching added suppression is the existing generated-barrel `/* eslint-disable */` header emitted
for a newly generated index file; it is generated output rather than an authored bypass.
`git diff --check origin/main...HEAD` passes.

### Review dimensions

| Dimension                        | Evidence reviewed                                                                                                                                                                                                            | Result                                                                                                                                                                            |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Correctness and failure recovery | Plugin lifecycle, project initialization transaction, command transport, server request boundary, Effect runtime, generated outputs, and process tests                                                                       | Two high-impact concurrency/recovery defects were found, characterized, fixed, and re-verified; no unresolved critical or high-confidence high-impact finding remains             |
| Security                         | Contract-derived credential mapping, case-insensitive header override, UTF-8 Basic encoding, stdout/stderr behavior, network-error sanitization, path safety, atomic publication, package manifests, and commit secret scans | Credentials are not combined, persisted, or echoed; non-Latin credentials encode deterministically; credential-bearing URLs are sanitized; gitleaks passed the review-fix commits |
| Public TypeScript API            | Core/Gen contracts, plugin kit, report schemas, case-insensitive client defaults, command runtime types, server signal, Effect handler/runtime types, peer dependencies                                                      | Public boundaries remain strict and Effect stays optional outside the adapter                                                                                                     |
| Effect 3 practices               | Pinned Effect 3.22 source/reference, managed runtime boundary, Layer/Scope lifecycle, FiberRef isolation, typed failures, interruption and diagnostics                                                                       | One runtime per adapter, no generated per-handler runtime, deterministic release, and no Effect 4 API use                                                                         |
| Tests                            | Characterization-first commits, type contracts, unit/integration/process tests, generated fixtures, bundle gates, docs runtime fixtures, packed consumers                                                                    | No new skipped/todo tests; narrow suites and the complete G3 aggregate proof are green                                                                                            |
| Maintainability                  | Package ownership, generator-versus-output boundaries, architecture contracts, deterministic naming, lint/format, error taxonomy                                                                                             | New packages are projections/adapters rather than duplicate contracts; no unresolved high-impact maintainability issue                                                            |
| Plugin DX                        | Public-only test kit, scaffold templates, golden process tests, external packed install/build/generate, concurrent Layer isolation                                                                                           | Third-party starter path does not copy private CLI internals or workspace-only dependencies                                                                                       |
| OpenAPI                          | Stage 2 target profiles, warning registry, support matrix, generated fixture; Stage 3 command projection consumes normalized security instead of OpenAPI                                                                     | No Stage 3 contract fork or unsupported round-trip claim                                                                                                                          |
| Documentation                    | Root/package guides, migration notes, Changesets, selection matrix, executable examples and runtime workflows                                                                                                                | Public claims are connected to executable or typechecked evidence                                                                                                                 |

### Findings

1. **Resolved — scoped plugin runtime state was shared across concurrent fibers.** The initial
   closure stored one mutable runtime. The failing characterization reproduced an
   `initialized more than once without finalization` error. Commit `6b0ad927` moved the state to a
   plugin-local `FiberRef`; 6/6 focused cases now prove two acquisitions, distinct services, and two
   releases.
2. **Resolved — failed init rollback could delete the only backup.** A publication failure followed
   by a restore failure was reported as a plain filesystem error, after which scoped cleanup removed
   the backup. Commit `2637dd1d` preserves the staging backup and returns a typed recovery path. The
   focused 2/2 rollback tests and the full sequential CLI suite pass.
3. **Resolved — comma-separated plugin flags retained empty plugin names.** Copilot comment
   `3653076020` identified the misleading empty module-resolution path. Commit `ba58b56a` filters
   empty entries; the focused parser suite passes 8/8.
4. **Resolved — validation staged temporary output inside the project tree.** Copilot comment
   `3653089514` identified the interruption residue risk. Commit `ba58b56a` uses OS-temporary
   staging while preserving dependency resolution through the nearest `node_modules`; the focused
   validation suite passes 5/5 and executable docs pass 18/18 workflows.
5. **Resolved — the Effect guide overstated HEAD-operation mapper coverage.** Copilot comment
   `3653076033` identified the mismatch with the server handler surface. Commit `ba58b56a` narrows
   the claim, and the executable documentation contract rejects the stale wording.
6. **Disproven — command client resource names require a broader PascalCase transform.** Copilot
   comment `3653076009` proposed kebab/snake resource keys, but the normalized public contract
   accepts only camelCase or PascalCase resource names. The current first-character capitalization
   matches that accepted input domain, so no in-scope defect exists.
7. **Resolved — request headers did not override defaults case-insensitively.** Review comment
   `3653157280` identified that a lowercase request `authorization` combined with the default
   uppercase credential. The failing characterization observed `Bearer default, Bearer request`.
   Commit `73fb710b` filters defaults using case-insensitive HTTP names; the Clients suite passes
   184/184 and the regression proves one request credential.
8. **Resolved — generated Basic authentication rejected non-Latin credentials.** Review comment
   `3653157293` identified the Latin-1-only `btoa` boundary. The failing characterization reproduced
   `InvalidCharacterError` for `用户:密码`. Commit `73fb710b` encodes credentials as UTF-8 through
   Node `Buffer`; the Command suite passes 19/19 and asserts `Basic 55So5oi3OuWvhueggQ==`.
9. **Resolved — normalized body warnings lost their actionable locations.** Review comment
   `3653272183` identified the hard-coded `/resources` issue path. The failing characterization
   expected `/resources/0/operations/0/request/body` but received `/resources`. Commit `b539a81a`
   maps request, inline-response, and canonical-response locations to valid normalized-contract JSON
   Pointers while preserving the conservative fallback; Gen passes 336/336 and CLI validation passes
   5/5.
10. **Resolved — the command generator rejected the non-conflicting `version` operation.** Review
    comment `3653272194` identified `version` in the reserved-name set although the generated
    runtime has no matching command or switch. The failing characterization returned
    `TW-PLUGIN-COMMAND-001`. Commit `b539a81a` reserves only the actual `help` command and proves a
    generated `VersionCommand`; Command passes 19/19.
11. **Disproven — client default headers throw when per-request headers are absent.** Review comment
    `3653285817` claims spreading an absent `headers` value throws. Under the required Node 24
    baseline, `{ ...undefined }` evaluates to `{}` without error, so the existing
    `{ ...applicableDefaults, ...headers }` expression preserves defaults as intended.
12. **Disproven — generated command header merging throws when the optional request header is
    absent.** Review comment `3653285822` makes the same claim for `{ ...context.request.header }`.
    Direct Node 24 characterization returned `{"stable":true}` for `{ stable: true, ...undefined }`;
    programmatic callers may omit the optional header without a runtime exception.

All actionable review discoveries met the `GOAL.md` promotion gate, were characterized before
repair, and are closed by the evidence above. At delivered source head `b539a81a` there is no
unresolved in-scope critical or high-confidence high-impact finding. PR #212 is open, green, and
unmerged at the recorded reviewed head.
