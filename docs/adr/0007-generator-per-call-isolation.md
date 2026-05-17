# ADR 0007: Generator Orchestrator — Per-Call Isolation in a Long-Lived Service

## Status

Accepted

## Context

The pre-Effect generator was instantiated per call:

```ts
// V1
const generator = new Generator();
await generator.generate({ inputFile, outputDir });
```

Each `new Generator()` brought fresh internal state: an empty plugin registry, an empty
generated-files tracker, a clean template cache. Concurrent calls were isolated by construction.

The Effect migration moved `Generator` into a `ManagedRuntime` as an `Effect.Service`. The runtime
is constructed once, at process start, and lives for the lifetime of the CLI. Without care, two
consequences would have followed:

1. The plugin registry would accumulate registrations across calls — Task #1's first attempt at the
   migration shipped exactly this regression.
2. The generated-files tracker would leak file paths from one generation into the next, breaking the
   `getGeneratedFiles()` contract that `IndexFileGenerator` depends on.

Task #8.5 surfaced both problems as a Singleton-Builder race: the singleton `GeneratedFiles` service
(Ref-backed) was being read and written by concurrent `generate(...)` calls, producing interleaved
output. The fix needed to preserve the long-lived runtime (for performance and composition) while
restoring per-call isolation.

## Decision

`Generator.generate` clears the plugin registry at the top of every invocation:

```ts
// packages/cli/src/services/Generator.ts
const generate = (params: GenerateParams) =>
  Effect.gen(function* () {
    // ...
    yield* registry.clear;
    // ... rest of the pipeline ...
  });
```

`ContextBuilder.buildGeneratorContext` builds a **fresh** per-call generated-files tracker inside
the call, captured in a closure on the returned context. The singleton `GeneratedFiles` service was
deleted.

```ts
// packages/gen/src/services/ContextBuilder.ts
const buildGeneratorContext = (params: BuildGeneratorContextParams) =>
  Effect.sync(() => {
    const generatedFiles: string[] = [];
    const context: GeneratorContext = {
      // ...
      addGeneratedFile: path => {
        generatedFiles.push(path);
      },
      getGeneratedFiles: () => generatedFiles.slice(),
    };
    return { context, getGeneratedFiles: () => generatedFiles.slice() };
  });
```

The entire generation pipeline runs inside `Effect.withSpan("typeweaver.generate", { ... })` so
every call gets its own root span — concurrent calls trace independently.

## Consequences

### Positive

- The long-lived `ManagedRuntime` is preserved. Service construction (template directory resolution,
  plugin module loader setup) happens once at process start, not on every call.
- Concurrent `Generator.generate` calls produce independent outputs. The regression is locked in by
  `packages/cli/__test__/generator.concurrent.test.ts`, which fires two `generate` calls with
  different output directories at the same runtime instance and asserts no cross-contamination.
- `IndexFileGenerator` receives a slice of the per-call tracker, not a reference to a shared list.
  Index files reflect exactly the files this call produced.
- The pipeline is observable: `typeweaver.generate` spans show up in trace exports, and nested
  per-phase spans (bundle, normalize, generate per plugin) are a follow-up that drops in cleanly
  under the root span.

### Negative

- The `registry.clear` call is load-bearing and easy to remove without understanding why. The test
  in `generator.concurrent.test.ts` and the comment above the call in `Generator.ts` document the
  intent; a future contributor who deletes the clear will see the concurrent test fail.
- Per-call state inside a long-lived service is a pattern that needs to be applied consistently. ADR
  0005 codifies the `succeed:` vs `effect:` rule; this ADR codifies the per-call-state rule.
  Services that hold per-call state must either build it inside the call (the `ContextBuilder`
  pattern) or clear it explicitly at the call boundary (the `PluginRegistry` pattern).

### Follow-up

Nested per-phase spans (`typeweaver.generate.bundle`, `typeweaver.generate.normalize`,
`typeweaver.generate.plugin.{name}`) are scaffolded but not yet emitted. The root span is in place;
the nested layer drops in when the trace export pipeline is wired to a backend.

## Reference Files

- `packages/cli/src/services/Generator.ts` — orchestrator with `registry.clear`
- `packages/gen/src/services/ContextBuilder.ts` — per-call tracker construction
- `packages/gen/src/services/internal/pluginContextBuilder.ts` — context factory invoked by
  `ContextBuilder`
- `packages/cli/__test__/generator.concurrent.test.ts` — concurrent-isolation regression test
- `packages/gen/src/services/PluginRegistry.ts` — `clear` semantics
