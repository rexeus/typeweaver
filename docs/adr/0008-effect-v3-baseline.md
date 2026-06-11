# ADR 0008: Effect v3 Baseline and v4-Oriented Skill Guidance

## Status

Accepted

## Context

The repository runs on **Effect 3.21.x (stable)** across all packages, with the `@effect/*`
ecosystem pinned to matching versions (`@effect/cli`, `@effect/platform`, `@effect/platform-node`,
`@effect/vitest`).

Two development aids in this repository target **Effect v4 (beta)** instead:

- the `effect-ts` skill under `.agents/skills/effect-ts/` (lock-managed via `skills-lock.json` from
  the upstream `effect-ts/skills` repository), whose guides document v4-only APIs, and
- the vendored Effect source under `.repos/effect` (v4.0.0-beta), which the skill uses as its
  research reference.

Following the skill's guidance literally produces code that does not compile against the installed
v3: `Schema.TaggedErrorClass`, `Context.Service`, `Effect.service`, `Cause.hasDies`, and the
"install `effect@beta`" rule all belong to v4.

## Decision

1. **Effect 3.21.x stable is the production baseline.** A v4 migration is deferred until v4 is GA
   and the ecosystem packages this repo depends on (`@effect/cli`, `@effect/platform-node`,
   `@effect/vitest`) have aligned releases. The migration is tracked as a deliberate future item,
   not an incidental upgrade.
2. **The skill stays as-is** (it is lock-managed and useful for concepts, idioms, and
   anti-patterns), but its API guidance must be read through the mapping below. Per the skill's own
   "Codebase Pattern Discovery" rule, existing codebase patterns take precedence over guide
   snippets.

### v4 guide → v3 reality in this repo

| Skill / v4 guide says                        | Use in this repo (v3.21)                                                                         |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `effect@beta`, align `@effect/*` on beta     | `effect ^3.21.x`, all `@effect/*` pinned to the versions in the workspace `package.json` files   |
| `Schema.TaggedErrorClass` for errors         | `Data.TaggedError` with a `message` getter (house style; see the 20+ errors in `*/src/errors/`)  |
| `Context.Service<Self, Shape>()("Name")`     | `Effect.Service<Self>()("Name", { succeed: ... \| effect: ... })` — allocation rules in ADR 0005 |
| `Effect.service(Tag)`                        | `yield* Tag` inside `Effect.gen`, or the generated `accessors: true` statics                     |
| `Layer.effect` replaces `Layer.scoped`       | v3 still has both; services compose via `Effect.Service`'s `dependencies:` (ADR 0005)            |
| `Cause.hasDies`, `cause.reasons`             | v3 `Cause.dies`/`Cause.failures`/`Cause.defects` (`Chunk`-returning; see `formatErrorForCli`)    |
| `Schema.decodeUnknownEffect` → `SchemaError` | v3 `Schema.decodeUnknown` → `ParseResult.ParseError`                                             |
| `Layer.mock` for partial test doubles        | `Layer.succeed(Tag, stub)` (see `SpecLoader.inMemoryFs.test.ts`)                                 |

Everything conceptual in the skill applies unchanged to v3 and is followed here: typed errors over
throws, services + layers with provisioning at the edge, `Effect.fn` for named reusable operations,
`acquireRelease`/scoped resources, `run*` only at runtime boundaries, `@effect/vitest` for tests.

### Behavioral note: traced boundaries and failure identity

In v3, failures crossing a traced boundary (`Effect.fn` span, `Effect.withSpan`) are re-wrapped for
trace attribution. Reference identity (`===`) on a failure or its `cause` does not survive the
crossing; `Cause.originalError` unwraps the instance. Tests must assert failures structurally
(`instanceof`, `_tag`, fields) rather than by reference — see
`packages/cli/__test__/services/SpecLoader.inMemoryFs.test.ts`.

## Consequences

- Contributors (and AI agents) using the skill must consult the mapping table before reaching for a
  guide API; compile errors of the form "`TaggedErrorClass` does not exist" indicate v4 guidance
  applied verbatim.
- When the v4 migration happens, the candidates to revisit are mechanical: `Data.TaggedError` →
  schema-backed errors where contracts cross boundaries, `Effect.Service` → `Context.Service`,
  `ManagedRuntime` API changes, and the `Cause` accessor renames.

## Reference Files

- Skill: `.agents/skills/effect-ts/SKILL.md` (+ `references/`), `skills-lock.json`
- Vendored v4 source: `.repos/effect`
- Version pins: `packages/*/package.json`
- House patterns: ADR 0003 (plugin API), ADR 0004 (FileSystem split), ADR 0005 (service shapes), ADR
  0006 (logging), ADR 0007 (per-call isolation)
