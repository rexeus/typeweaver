# TypeWeaver Effect 3.22 Guide

This is the active API guide for Effect work in TypeWeaver.

## Version Authority

- development and test runtime: `effect@3.22.0`
- published plugin peer range: `>=3.21.2 <4`
- source reference: official `Effect-TS/effect` tag `effect@3.22.0`
- exact source commit: `e670e0f6befb959b84208d5f77631276521020ae`

Read `config/effect-baseline.json` and `docs/adr/0008-effect-v3-baseline.md` before changing the
baseline. Run `pnpm verify:effect-reference` before relying on the vendored source.

## Authority Order

1. Existing TypeWeaver code and accepted ADRs
2. The pinned Effect 3.22 source and tests in `./.repos/effect`
3. Effect 3.22 diagnostics and the TypeScript compiler

The generic `guide-*.md` files next to this guide are archived Effect 4-oriented conceptual
material. Their API snippets are not implementation guidance for TypeWeaver.

## Established Patterns

### Typed errors

Use `Data.TaggedError` for expected failures and expose a meaningful `message`. Fail or yield these
errors through the typed error channel. Do not throw them.

Representative code:

- `packages/gen/src/plugins/errors/PluginExecutionError.ts`
- `packages/cli/src/services/errors/FormatterError.ts`
- `packages/cli/src/errors/OutputLockError.ts`

Do not use Effect 4's `Schema.TaggedErrorClass`.

### Services and layers

Use `Effect.Service<Self>()("Name", { effect | succeed, accessors? })` for TypeWeaver services.
Acquire a required service with `yield* Service` inside `Effect.gen`. Compose and provide layers at
the application or subsystem boundary.

Representative code:

- `packages/gen/src/services/PluginRegistry.ts`
- `packages/cli/src/services/Formatter.ts`
- `packages/cli/src/services/Generator.ts`
- `docs/adr/0005-effect-service-shapes.md`

Do not use Effect 4's `Context.Service` or `Effect.service`.

### Resource lifetimes

Use `Effect.acquireRelease`, `Effect.scoped`, and `Layer.scoped` when an acquisition has a matching
release action. Keep runtime ownership at a real process or subsystem boundary; do not create a
runtime per generated artifact or individual service call.

Representative code:

- `packages/gen/src/runtime.ts`
- `packages/cli/src/services/SpecBundler.ts`
- `docs/adr/0007-plugin-runtime-isolation.md`

### Cause inspection

Use Effect 3 cause accessors such as `Cause.failures`, `Cause.defects`, and `Cause.isInterrupted`.
Confirm the exact accessor and return type in `./.repos/effect/packages/effect/src/Cause.ts`.

Do not use Effect 4's `Cause.hasDies` or `cause.reasons`.

### Observability

Use named `Effect.fn` operations or `Effect.withSpan` around reusable business operations. Preserve
the existing span name when refactoring between those forms. Use structured Effect logging and
annotations rather than direct console output in library code.

Representative code:

- `packages/gen/src/services/PluginRegistry.ts`
- `packages/cli/src/services/Formatter.ts`
- `docs/adr/0006-cli-error-and-log-formatting.md`

### Testing

Prefer observable behavior over implementation structure. Use `@effect/vitest` where it improves
layer and scope handling, and use `Effect.runPromise` only at deliberate test boundaries. Assert
tagged errors structurally (`instanceof`, `_tag`, and fields), not by reference identity across
traced boundaries.

Representative code:

- `packages/gen/__test__/services/PluginRegistry.test.ts`
- `packages/cli/__test__/services/SpecBundler.lifecycle.test.ts`
- `docs/adr/0008-effect-v3-baseline.md`

## Verification

After Effect changes, run the narrow package tests and then the repository gates appropriate to the
change:

```sh
pnpm effect:diagnostics
pnpm typecheck
pnpm lint
pnpm test
```

The diagnostics command includes a negative sentinel and treats Effect warnings as failures.
