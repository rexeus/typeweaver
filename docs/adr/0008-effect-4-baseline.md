# ADR 0008: Native Effect 4.0.0-rc.116 Baseline

## Status

Accepted

[ADR 0010](./0010-effect-4-workspace-compatibility.md) is retained as a historical record and is
superseded by this native baseline.

## Context

The repository develops, tests, and publishes its Effect-bearing boundaries against the exact
**`effect@4.0.0-rc.116`** release candidate. The public peer contract is the exact
**`4.0.0-rc.116`** pin. Effect 3 and Effect 4 values are not interchangeable, so a range would hide
duplicate runtime identities and an unsupported ABI.

The upstream Effect guides and the repository implementation must agree with the pinned RC. The
local skill therefore routes all Effect work through the pinned source checkout and marks older
generic guides as archived conceptual material.

## Decision

1. **Effect 4.0.0-rc.116 is the development, test, and public peer baseline.** All Effect-bearing
   TypeWeaver boundaries share this exact runtime identity.
2. **`config/effect-baseline.json` is the machine-readable version authority.** It records the
   runtime version, exact peer pin, `@effect/tsgo` version, official source repository, tag, and
   commit.
3. **The local source reference is reproducible.** `pnpm prepare` checks out the official
   `effect@4.0.0-rc.116` tag at commit `d62dd0d65252e5d3635538f0e41adc7c08aa9beb` and refuses to
   overwrite a dirty checkout. `pnpm verify:effect-reference` checks version, origin, and commit.
4. **Effect diagnostics run without patching TypeScript or Oxlint.** The standalone `@effect/tsgo`
   diagnostics CLI is pinned and invoked with the Recommended severity map for every Effect-bearing
   TypeScript project. Its file list is the independent scope authority: diagnostics from every
   authored file remain visible, including files without a direct Effect import; only explicit
   generated output directories are excluded. Recommended errors always fail. Warnings fail by
   default as well: the only nonblocking warnings are exact named rules at exact path categories in
   `scripts/lib/effect-diagnostics.mjs` (process/test boundary style rules and the architectural
   `nodeBuiltinImport` rule). Correctness rules such as `floatingEffect`,
   `missingStarInYieldEffectGen`, and unused directives remain blocking even at those paths; unknown
   future warning names fail closed. The retained inline exception allowlist is currently empty, and
   stale directives fail closed. Run `pnpm effect:diagnostics` locally.
5. **Additional Effect packages are an exact, minimal allowlist.** `acceptedEffectDependencies` in
   `config/effect-baseline.json` names every `@effect/*` dependency or devDependency a workspace
   package may declare, each pinned to `4.0.0-rc.116`; `@effect/tsgo` is pinned separately. The CLI
   takes its Node platform layers (`NodeFileSystem`, `NodePath`, `NodeStdio`, `NodeTerminal`,
   `NodeChildProcessSpawner`) and `NodeRuntime.runMain` from `@effect/platform-node-shared`. It does
   not depend on `@effect/platform-node`, which re-exports the same modules but declares a required
   `redis` peer and would install a Redis client that the CLI never uses. The packed-consumer gate
   fails if a fresh install contains `@effect/platform-node` or `redis`.

### Effect 3 → native Effect 4.0.0-rc.116

| Effect 3 API                         | Native RC.116 API                                                                       |
| ------------------------------------ | --------------------------------------------------------------------------------------- |
| Effect service builders              | `Context.Service<Self, Shape>()("Name")` plus explicit `make`, `Default`, and accessors |
| `Either` / `Effect.either`           | `Result` / `Effect.result`                                                              |
| `Layer.scoped`                       | `Layer.effect` where the service lifetime is effect-owned                               |
| `Cause.failures` and `Cause.defects` | flattened `Cause` reasons with `Cause.isFailReason` / `Cause.isDieReason`               |
| `Schema.decodeUnknown`               | `Schema.decodeUnknownEffect` with `SchemaError`                                         |
| `@effect/cli`                        | `effect/unstable/cli` native `Command` and `Flag`                                       |

The CLI programmatic API, `@rexeus/typeweaver-gen` lifecycle, first-party generator packages
(`command`, `hono`, and `openapi` included), and `@rexeus/typeweaver-effect` adapter share this
exact Effect identity. This package contract is separate from generated artifacts: core authoring,
plain generated client and Fetch-native server output, generated Hono output, generated command
runtime output, and OpenAPI JSON remain Effect-optional because they do not import Effect. The
generator packages themselves are Effect-native and require the exact peer.

## Consequences

- Agents and contributors get source and diagnostics that match the native public runtime.
- A missing, stale, wrong-origin, or wrong-commit reference fails closed.
- Updating the runtime, peer pin, source pin, tsgo version, or repo-local skill requires an
  intentional change to this baseline and its verification evidence.
- Migration users must update service, result, cause, schema, and CLI APIs together; there is no
  compatibility shim between Effect 3 and this native RC.

## Reference Files

- Version authority: `config/effect-baseline.json`
- Setup and guard: `scripts/prepare-effect-reference.mjs`, `scripts/verify-effect-reference.mjs`
- Diagnostics: `scripts/run-effect-diagnostics.mjs`, `scripts/lib/effect-diagnostics.mjs`,
  `config/effect-diagnostics-allowlist.json`
- Skill: `.agents/skills/effect-ts/SKILL.md` and `.agents/skills/effect-ts/references/`
- Native contract: `scripts/lib/effect-version-contract.mjs`,
  `scripts/lib/effect-native-contract.mjs`
