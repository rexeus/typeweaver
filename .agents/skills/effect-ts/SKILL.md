---
name: effect-ts
description: Use this skill whenever working in a repository that uses Effect, even if the current task is in a new file or the user does not explicitly ask for Effect help. Apply it to any work that should follow the repository's Effect patterns, conventions, architecture, or supporting tooling. Also use it for questions about Effect patterns, services, layers, schemas, streams, runtimes, or typed error handling.
---

# Effect 4 Expert for TypeWeaver

Repository-specific guidance for programming against TypeWeaver's pinned Effect 4 release-candidate
baseline, covering error handling, dependency injection, composability, and testing patterns.

## Prerequisite

Before doing any other Effect-related work, check that `./.repos/effect` exists at the root of the
repository where the skill is being used.

If it does not exist, stop and prompt the user with the setup task documented in
`./references/setup.md`.

## Mandatory Version Contract

Before reading API guidance or changing Effect code:

1. Read `config/effect-baseline.json`.
2. Read `docs/adr/0008-effect-4-baseline.md` (or its successor).
3. Read `./references/typeweaver-effect-4.md`.
4. Verify `./.repos/effect` with `pnpm verify:effect-reference` when exact APIs or behavior matter.

This repository develops against the exact **`effect@4.0.0-rc.116`** release candidate and publishes
the intentionally exact peer contract **`4.0.0-rc.116`**. The upstream source authority is the
`effect@4.0.0-rc.116` tag at commit `d62dd0d65252e5d3635538f0e41adc7c08aa9beb`.

Effect 3 APIs must not be reintroduced. The pinned `effect@4.0.0-rc.116` source under
`./.repos/effect` is the API authority for every uncertain signature.

## Research Strategy

Effect has many ways to accomplish the same task. Proactively research best practices when working
with Effect patterns, especially for moderate to high complexity tasks.

Use the TypeWeaver v4 guide, existing repository patterns, and the pinned Effect 4.0.0-rc.116 source
as implementation authorities. The generic `./references/guide-*.md` and
`./references/features.md` files are archived conceptual material from earlier Effect 4 betas; they
are not active API guidance. Never copy an API name or snippet from them without first confirming
the exact rc.116 form in `./.repos/effect`.

### Research Sources

1. Version contract first: `config/effect-baseline.json`, the baseline ADR, and
   `./references/typeweaver-effect-4.md`.
2. Codebase patterns second. Examine similar TypeWeaver code and its ADRs before implementing.
3. Pinned Effect 4.0.0-rc.116 source third. For exact APIs, type signatures, complex type errors, or
   unclear behavior, examine `./.repos/effect/packages/effect/src/` and the matching tests.
4. Archived generic guides last, and only for conceptual background after confirming every API
   against the pinned source.

### When To Research

- Always research for services, layers, or complex dependency injection.
- Always research for error handling with multiple error types or complex error hierarchies.
- Always research for stream-based operations and reactive patterns.
- Always research for resource management with scoped effects and cleanup.
- Always research for concurrent or performance-critical code.
- Always research for unfamiliar testing patterns.
- Research when needed for complex refactors from promises or try/catch into Effect.
- Research when needed for new service dependencies or layer restructuring.
- Research when needed for custom error types or extensions of existing error hierarchies.
- Research when needed for integrations with external systems such as databases, APIs, or
  third-party services.

### Research Approach

- Focus on canonical, readable, and maintainable solutions rather than clever optimizations.
- Verify suggested approaches against existing codebase patterns when those patterns exist.
- When multiple approaches are possible, prefer the most idiomatic Effect solution supported by the
  codebase and the vendored source.

### Codebase Pattern Discovery

When working in a project that uses Effect, check for existing patterns before implementing new
code:

1. Search for Effect imports and existing module usage to understand current conventions.
2. Identify how services and layers are structured in the project.
3. Note how errors are defined and propagated.
4. Examine how Effect code is tested in the project.

If no Effect patterns exist in the codebase, proceed using canonical patterns from the vendored
Effect source and examples. Do not block on missing codebase patterns.

### Feature Discovery

When you need to discover available Effect modules, packages, or capabilities, search the pinned
Effect 4.0.0-rc.116 source and its package manifests.

- Use source exports to identify the right module or package.
- Search source tests for supported usage.
- Check existing TypeWeaver dependencies before adding a package.
- Do not use `./references/features.md` as an API inventory; it describes an earlier Effect 4 beta.

### Guide Discovery

For every Effect task, consult `./references/typeweaver-effect-4.md`. Then use the matching
TypeWeaver implementation and the pinned source module or test.

The generic `guide-*.md` files may help explain concepts, but their API-specific recommendations,
examples, imports, and source paths are inactive for this repository. A statement such as
"preferred", "default", or "use" inside an archived guide does not override this contract.

## Effect Principles

Apply these core principles when writing Effect code.

## Installation

This repository deliberately targets the exact `effect@4.0.0-rc.116` release candidate. Treat
`config/effect-baseline.json` as the version authority.

- use `effect@4.0.0-rc.116` for development and test dependencies
- use the intentional exact public peer contract `4.0.0-rc.116` for TypeWeaver plugin packages
- keep all `@effect/*` packages on aligned `4.0.0-rc.116` versions
- install only the packages needed for the user's runtime and actual task

### Version Rules

- do not install a different Effect 4 release candidate, a stable Effect 3, or an unpinned range
- `effect` development dependencies must resolve to exactly `4.0.0-rc.116`
- published Effect peer dependencies must use the exact `4.0.0-rc.116` pin
- if you install any `@effect/*` package, make sure all `@effect/*` packages use matching
  `4.0.0-rc.116` versions
- do not mix unrelated `@effect/*` versions in the same project

### Package Selection

Choose packages based on the runtime and the work being done.

- core library and most unstable modules: `effect@4.0.0-rc.116`
- Node.js platform layers and `runMain`: `@effect/platform-node-shared@4.0.0-rc.116`; do not add
  `@effect/platform-node`, which re-exports the same modules but requires a `redis` peer
- Vitest integration needs: `@effect/vitest@4.0.0-rc.116`
- CLI programs: the `effect/unstable/cli` module inside `effect`

Install additional `@effect/*` packages only when the user task actually needs them.

### Practical Rule

- start with the version contract in `config/effect-baseline.json`
- add `@effect/*` packages as needed by runtime and features
- keep the full installed Effect package set version-aligned

### Error Handling

- Use Effect's typed error system instead of throwing exceptions.
- Define descriptive error types with proper error propagation.
- Follow the established TypeWeaver pattern: `Data.TaggedError` plus a meaningful `message` getter.
- Use `Effect.fail`, `Effect.catch`, `Effect.catchTag`, `Effect.catchReason`, and
  `Effect.tapCause` for error control flow.
- In Effect 4 `Cause` is a flat list of `reasons`: narrow with `Cause.isFailReason`,
  `Cause.isDieReason`, and `Cause.isInterruptReason`, and inspect with `Cause.findErrorOption`,
  `Cause.hasDies`, and `Cause.hasInterrupts`.

### Dependency Injection

- Implement dependency injection using services and layers.
- Define services with `Context.Service<Self, Shape>()("Id")` (class style) or
  `Context.Service<Shape>("Id")` (function style).
- Define each service's `make` effect, `Default` layer, and any static accessors explicitly. Effect 4
  no longer generates `Default`, `DefaultWithoutDependencies`, or `accessors` from a service
  declaration.
- Use `Layer.effect` / `Layer.succeed` and compose layers with `Layer.merge` / `Layer.mergeAll` and
  `Layer.provide`.
- Use `Effect.provide` to inject dependencies at the edge, avoid providing locally.
- Keep services encapsulated; avoid exporting trivial accessor wrappers that only forward to one
  service method.

### Composability

- Leverage Effect composability for complex operations.
- Use appropriate constructors such as `Effect.succeed`, `Effect.fail`, `Effect.try`,
  `Effect.tryPromise`, `Effect.promise`, and `Effect.sync`.
- Apply proper resource management with scoped effects.
- Chain operations with `Effect.flatMap`, `Effect.map`, `Effect.andThen`, and `Effect.tap`.
- Use `Effect.result` for the success/failure channel and `Result` for pure result values; `Either`
  no longer exists.

### Business Logic Functions

- Prefer `Effect.fn` for reusable business-logic functions that return `Effect`.
- Prefer `Effect.fn` over raw `Effect.gen` definitions even when the function takes no arguments.
- If you do not want an explicit named span, use `Effect.fn` without a span name.
- Do not use `Effect.fnUntraced` as the default.
- Use `Effect.fnUntraced` only for edge cases with a concrete low-level reason, such as measured
  hot-path overhead.

### TypeScript Preferences

- Never use `any`.
- Never use `as` casts.
- Never use unsafe type assertions or escape hatches.
- Never use `namespace`.
- Prefer correct typing, schema-driven decoding, narrowing, and proper generic constraints instead
  of forcing types.
- If a value comes from an external boundary, validate or decode it instead of asserting its type.
- If a type is hard to express, simplify the design or introduce a properly typed helper instead of
  using unsafe TypeScript.
- For layers, do not hide them inside `namespace` blocks. Prefer either `static` members on the
  service class or plain exported layer constants.

### Code Quality

- Write type-safe code that leverages Effect's type system.
- Use `Effect.gen` for readable sequential code.
- Implement proper testing patterns using Effect testing utilities.
- Prefer existing Effect primitives before introducing custom helpers.
- Follow existing TypeWeaver schema conventions and confirm exact constructors in the pinned Effect
  4.0.0-rc.116 `Schema.ts` before introducing a new schema abstraction.

### Explaining Solutions

When providing solutions, explain the Effect concepts being used and why they fit the specific use
case. If you encounter patterns not covered in local references, prefer consistency with the
codebase when possible and otherwise rely on the vendored Effect source.

## References

- Active Effect 4 guidance: `./references/typeweaver-effect-4.md`
- `./references/setup.md`
- Version contract and v3-to-v4 mapping: `docs/adr/0008-effect-4-baseline.md`
- Archived conceptual material only: `./references/features.md` and
  `./references/guide-*.md`
