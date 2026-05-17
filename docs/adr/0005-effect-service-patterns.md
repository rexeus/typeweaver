# ADR 0005: Effect.Service Patterns (succeed vs effect)

## Status

Accepted

## Context

The Effect migration introduced thirteen `Effect.Service` classes split across
`@rexeus/typeweaver-gen` (four: `TemplateRenderer`, `PathSafety`, `ContextBuilder`,
`PluginRegistry`) and `@rexeus/typeweaver` (nine: `SpecImporter`, `SpecBundler`, `ConfigLoader`,
`PluginModuleLoader`, `IndexFileGenerator`, `Generator`, `SpecLoader`, `PluginLoader`, `Formatter`).
Each service is constructed by one of two shapes that the `Effect.Service` builder exposes:

- `succeed: { ... }` — a plain record of methods, no dependencies, no closure state
- `effect: Effect.gen(function* () { ... })` — a generator that may yield other services or hold
  `Ref`-backed state, returning a record of methods

Without an explicit rule, contributors picked between the two shapes by feel. Two services with
identical dependency profiles ended up on different sides of the split, and the inconsistency made
it hard to scan a service definition and know whether it had internal state or hidden dependencies.

## Decision

A service uses `succeed:` when **both** of the following hold:

1. The service body does not `yield* OtherService` — it depends on nothing from the runtime.
2. The service holds no closure state (no `Ref`, no `Map`, no captured mutable binding).

Otherwise the service uses `effect:`. Dependencies appear in the `dependencies:` field alongside the
service body.

### Current allocation

`succeed:` — stateless, dependency-free:

- `ConfigLoader` (`packages/cli/src/services/ConfigLoader.ts`)
- `Formatter` (`packages/cli/src/services/Formatter.ts`)
- `PluginModuleLoader` (`packages/cli/src/services/PluginModuleLoader.ts`)
- `PathSafety` (`packages/gen/src/services/PathSafety.ts`)
- `TemplateRenderer` (`packages/gen/src/services/TemplateRenderer.ts`)

`effect:` — yields other services or holds state:

- `Generator` (`packages/cli/src/services/Generator.ts`) — composes six dependencies
- `SpecLoader` (`packages/cli/src/services/SpecLoader.ts`) — yields `SpecBundler`, `SpecImporter`
- `SpecBundler`, `SpecImporter` — yield `FileSystem`
- `PluginLoader` (`packages/cli/src/services/PluginLoader.ts`) — yields `PluginRegistry`,
  `PluginModuleLoader`
- `IndexFileGenerator` (`packages/cli/src/services/IndexFileGenerator.ts`) — yields `PathSafety`
- `PluginRegistry` (`packages/gen/src/services/PluginRegistry.ts`) — holds a
  `Ref<readonly PluginRegistration[]>`
- `ContextBuilder` (`packages/gen/src/services/ContextBuilder.ts`) — yields `PathSafety`,
  `TemplateRenderer`, `PluginRegistry`

## Consequences

### Positive

- A contributor reading a `succeed:` service knows at a glance: no internal dependencies, no state.
  The body is the contract.
- A contributor reading an `effect:` service knows to inspect the `dependencies:` list and the
  `Effect.gen` body for service yields and `Ref` allocations.
- `Layer.mergeAll` composition stays clean. Services declare their dependencies in one place; the
  runtime resolves them.

### Negative

- Promoting a service from `succeed:` to `effect:` (because it gained a dependency) is a real
  refactor — the body changes shape from a record literal to a generator. The benefit is the
  discipline it imposes: a contributor cannot quietly add a `yield*` to a `succeed:` service.

### Trade-off

The rule says nothing about which services _should_ hold state or have dependencies. It just
guarantees the construction shape reflects the answer. Architectural decisions about state ownership
and dependency graphs live in the other ADRs (e.g., ADR 0007 on per-call isolation in `Generator`).

## Reference Files

- CLI services: `packages/cli/src/services/*.ts`
- Gen services: `packages/gen/src/services/*.ts`
- Runtime composition: `packages/cli/src/effectRuntime.ts`, `packages/gen/src/services/index.ts`
