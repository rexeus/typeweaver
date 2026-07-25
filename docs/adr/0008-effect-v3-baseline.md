# ADR 0008: Effect 3.22 Baseline and Version-Correct Guidance

## Status

Accepted

## Context

The repository develops and tests against **Effect 3.22.0**. Published TypeWeaver packages expose
the intentionally broader peer range **`>=3.21.2 <4`**, so compatible Effect 3 consumers are not
forced onto the development minor.

The upstream `effect-ts` skill under `.agents/skills/effect-ts/` was originally written for Effect 4
beta. Its API guides still contain v4-oriented examples, and its former setup instructions cloned
the unpinned `effect-smol` default branch. That left `.repos/effect` on Effect 4 beta while the
production code compiled against Effect 3.22.

Following those v4 examples literally produces code that does not compile against the installed v3:
`Schema.TaggedErrorClass`, `Context.Service`, `Effect.service`, and `Cause.hasDies` are examples of
APIs whose shape differs.

## Decision

1. **Effect 3.22.0 is the development and source-reference baseline.** A v4 migration is outside
   this change and must be deliberate.
2. **The published peer contract remains `>=3.21.2 <4`.** The lower bound is compatibility policy,
   not the version used for development or source review.
3. **`config/effect-baseline.json` is the machine-readable version authority.** It records the
   runtime version, peer range, language-service version, official source repository, tag, and exact
   commit.
4. **The local source reference is reproducible.** `pnpm prepare` checks out the official
   `effect@3.22.0` tag at commit `e670e0f6befb959b84208d5f77631276521020ae` and refuses to overwrite
   a dirty checkout. `pnpm verify:effect-reference` checks version, origin, and commit.
5. **The repo-local skill routes through an active Effect 3.22 guide.** The remaining generic
   v4-oriented guides are explicitly archived conceptual material; their API snippets are not
   implementation guidance. Existing TypeWeaver patterns and the pinned Effect 3.22 source take
   precedence.
6. **Effect diagnostics run without patching TypeScript.** `@effect/language-service` is pinned and
   invoked through its direct diagnostics CLI for every Effect-dependent package. CI treats errors
   and warnings as failures, and a negative fixture proves the diagnostic path is active.

### v4 guide → Effect 3.22 reality in this repo

| v4-oriented guide says                       | Use in this repository                                                              |
| -------------------------------------------- | ----------------------------------------------------------------------------------- |
| Install the Effect 4 beta                    | Develop with Effect 3.22.0; publish peers as `>=3.21.2 <4`                          |
| `Schema.TaggedErrorClass` for errors         | `Data.TaggedError` with a `message` getter (the established TypeWeaver error style) |
| `Context.Service<Self, Shape>()("Name")`     | `Effect.Service<Self>()("Name", { succeed: ... \| effect: ... })` — see ADR 0005    |
| `Effect.service(Tag)`                        | `yield* Tag` inside `Effect.gen`, or generated statics with `accessors: true`       |
| `Layer.effect` replaces `Layer.scoped`       | Effect 3 has both; use the constructor that represents the actual resource lifetime |
| `Cause.hasDies`, `cause.reasons`             | Effect 3 `Cause.dies` / `Cause.failures` / `Cause.defects`                          |
| `Schema.decodeUnknownEffect` → `SchemaError` | Effect 3 `Schema.decodeUnknown` → `ParseResult.ParseError`                          |
| `Layer.mock` for partial test doubles        | `Layer.succeed(Tag, stub)`                                                          |

The conceptual guidance applies unchanged: typed errors over throws, services and layers with
provisioning at the edge, named reusable operations, scoped resources, runtime execution only at
real boundaries, and Effect-aware tests.

### Behavioral note: traced boundaries and failure identity

In Effect 3, failures crossing a traced boundary are re-wrapped for trace attribution. Reference
identity (`===`) on a failure or its `cause` does not survive the crossing; `Cause.originalError`
unwraps the instance. Tests assert failures structurally (`instanceof`, `_tag`, and fields) rather
than by reference.

## Consequences

- Agents and contributors get source and diagnostics that match the production major and minor.
- A missing, stale, Effect 4, wrong-origin, or wrong-commit reference fails closed.
- Updating the runtime, public peer policy, source pin, language service, or repo-local skill
  requires an intentional change to the baseline contract and its verification evidence.
- When an Effect 4 migration is approved, revisit the mapping table, service/error shapes,
  `ManagedRuntime` boundaries, Cause accessors, peer contract, and reference pin together.

## Reference Files

- Version contract: `config/effect-baseline.json`
- Setup and guard: `scripts/prepare-effect.sh`, `scripts/verify-effect-reference.mjs`
- Diagnostics: `scripts/run-effect-diagnostics.mjs`, root `tsconfig.json`
- Skill: `.agents/skills/effect-ts/SKILL.md` and `.agents/skills/effect-ts/references/`
- House patterns: ADR 0003 (plugin API), ADR 0004 (FileSystem split), ADR 0005 (service shapes), ADR
  0006 (logging), ADR 0007 (per-call isolation)
