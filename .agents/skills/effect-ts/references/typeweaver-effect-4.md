# TypeWeaver Effect 4 Guide

This is the active API guide for Effect work in TypeWeaver.

## Version Authority

- development and test runtime: `effect@4.0.0-rc.116`
- published plugin peer contract: exact `4.0.0-rc.116`
- source reference: official `Effect-TS/effect` tag `effect@4.0.0-rc.116`
- exact source commit: `d62dd0d65252e5d3635538f0e41adc7c08aa9beb`

Read `config/effect-baseline.json` and `docs/adr/0008-effect-4-baseline.md` before changing the
baseline. Run `pnpm verify:effect-reference` before relying on the vendored source.

## Authority Order

1. Existing TypeWeaver code and accepted ADRs
2. The pinned Effect 4.0.0-rc.116 source and tests in `./.repos/effect`
3. Effect diagnostics (`@effect/tsgo`) and the TypeScript compiler

The generic `guide-*.md` files next to this guide are archived Effect 4 beta conceptual material.
Their API snippets are not implementation guidance for TypeWeaver; confirm every signature against
the pinned rc.116 source.

## Effect 3 → Effect 4.0.0-rc.116 mapping

| Effect 3 API                                   | Effect 4.0.0-rc.116 API                                                                       |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `Effect.Service<Self>()("Name", {...})`        | `Context.Service<Self, Shape>()("Name")` plus explicit `make`, `Default`, and static accessors |
| `yield* Service`                               | `yield* Service` (class-style keys remain yieldable)                                          |
| `Layer.scoped(Tag, effect)`                    | `Layer.effect(Tag, effect)`                                                                   |
| `Context.GenericTag<T>("id")`                  | `Context.Service<T>("id")`                                                                    |
| `Either`, `Either.left/right`                  | `Result`, `Result.fail/succeed`                                                               |
| `Effect.either`                                | `Effect.result`                                                                               |
| `Effect.zipRight`                              | `Effect.andThen`                                                                              |
| `Effect.catchAll`                              | `Effect.catch`                                                                                |
| `Effect.tapErrorCause`                         | `Effect.tapCause`                                                                             |
| `Cause.failureOption`                          | `Cause.findErrorOption`                                                                       |
| `Cause.failures` / `Cause.defects`             | `cause.reasons.filter(Cause.isFailReason)` / `.filter(Cause.isDieReason)`                     |
| `Cause.isInterrupted` / `isInterruptedOnly`    | `Cause.hasInterrupts` / `Cause.hasInterruptsOnly`                                             |
| `Cause.hasDies` / `cause.reasons`              | `Cause.hasDies` / `cause.reasons` (native)                                                    |
| `Cause.originalError`                          | identity: errors are carried directly on flattened reasons                                    |
| `FiberRef`                                     | `Context.Reference` with `fiberCached`, or a per-fiber cell keyed by `Fiber.getCurrent`       |
| `Scope.CloseableScope`                         | `Scope.Closeable`                                                                             |
| `Logger.replace(a, b)`                         | `Logger.layer([b])`                                                                           |
| `Logger.minimumLogLevel(level)`                | `Layer.succeed(References.MinimumLogLevel, level)`                                            |
| `Logger.withMinimumLogLevel(level)`            | `Effect.provideService(References.MinimumLogLevel, level)`                                    |
| `LogLevel.Debug` (and peers)                   | string literal `"Debug"`                                                                      |
| `Effect.fork` / `Fiber.interruptFork`          | `Effect.forkChild` / `Effect.forkChild(Fiber.interrupt(fiber))`                               |
| `@effect/cli` `Command` / `Options`            | `effect/unstable/cli` `Command` / `Flag`                                                      |
| `@effect/platform` `FileSystem`, `Path`        | `effect` `FileSystem`, `Path`                                                                 |
| `@effect/platform/Error`                       | `effect/PlatformError` (`PlatformError.reason._tag` carries `SystemErrorTag`)                 |
| `Schema` v3 constructors                       | `Schema.Record(key, value)`, `Schema.Tuple([...])`, `Schema.Union([...])`, `optionalKey`      |
| `Schema.decodeUnknown` → `ParseResult`         | `Schema.decodeUnknownEffect` → `SchemaError`                                                  |
| `NodeRuntime.runMain` `disablePrettyLogger`    | removed; use `disableErrorReporting` and logger layers                                        |

## Established Patterns

### Typed errors

Use `Data.TaggedError` for expected failures and expose a meaningful `message`. Fail or yield these
errors through the typed error channel. Do not throw them from Effect programs. Synchronous
construction boundaries such as plugin factories may throw `PluginConfigError` before an Effect
exists; the loader decodes that boundary into its typed failure channel.

Representative code:

- `packages/gen/src/plugins/errors/PluginExecutionError.ts`
- `packages/cli/src/services/errors/FormatterError.ts`
- `packages/cli/src/errors/OutputLockError.ts`

### Services and layers

Declare a class-style service with `Context.Service<Self, Shape>()("Name")`, then define its `make`
effect, its `Default` layer (`Layer.effect` or `Layer.succeed`), and any static accessors explicitly.
Acquire a required service with `yield* Service` inside `Effect.gen`, or with `Service.use`. Compose
and provide layers at the application or subsystem boundary.

Representative code:

- `packages/gen/src/services/PluginRegistry.ts`
- `packages/gen/src/services/ContextBuilder.ts`
- `packages/cli/src/services/Formatter.ts`
- `docs/adr/0005-effect-service-patterns.md`

### Resource lifetimes

Use `Effect.acquireRelease`, `Effect.scoped`, and `Layer.effect` when an acquisition has a matching
release action. Keep runtime ownership at a real process or subsystem boundary; do not create a
runtime per generated artifact or individual service call.

Representative code:

- `packages/gen/src/runtime/MainLayer.ts`
- `packages/cli/src/services/SpecBundler.ts`
- `docs/adr/0007-generator-per-call-isolation.md`

### Cause inspection

Use Effect 4 cause accessors over the flattened `reasons` array: `Cause.findErrorOption`,
`Cause.hasDies`, `Cause.hasInterrupts`, and `Cause.isFailReason` / `Cause.isDieReason` /
`Cause.isInterruptReason`. Confirm the exact accessor and return type in
`./.repos/effect/packages/effect/src/Cause.ts`.

### Observability

Use named `Effect.fn` operations or `Effect.withSpan` around reusable business operations. Preserve
the existing span name when refactoring between those forms. Use structured Effect logging and
annotations rather than direct console output in library code. Configure loggers with
`Logger.layer([...])` and log thresholds with `References.MinimumLogLevel`.

Representative code:

- `packages/gen/src/services/PluginRegistry.ts`
- `packages/cli/src/services/Formatter.ts`
- `docs/adr/0006-cli-error-and-log-formatting.md`

### Testing

Prefer observable behavior over implementation structure. Use `@effect/vitest` where it improves
layer and scope handling, and use `Effect.runPromise` only at deliberate test boundaries. Assert
tagged errors structurally (`instanceof`, `_tag`, and fields) rather than by reference identity.

Representative code:

- `packages/gen/__test__/services/PluginRegistry.test.ts`
- `packages/cli/__test__/services/SpecBundler.lifecycle.test.ts`
- `docs/adr/0008-effect-4-baseline.md`

## Verification

After Effect changes, run the narrow package tests and then the repository gates appropriate to the
change:

```sh
pnpm effect:diagnostics
pnpm typecheck
pnpm lint
pnpm test
```

The diagnostics command runs `effect-tsgo diagnostics --strict` from `@effect/tsgo` and treats
errors and unlisted warnings as failures. A small central policy permits only named boundary/style
rules at their approved path categories; correctness rules and unknown future names remain blocking
everywhere, including those boundaries.
