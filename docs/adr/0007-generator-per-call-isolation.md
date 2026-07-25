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

`Generator.generate` yields a **fresh** plugin registry instance at the top of every invocation via
`PluginRegistry.createInstance`. The `PluginRegistry` service exposes only that factory; each call
closes over its own `Ref<Map>` so two concurrent fibers cannot observe or overwrite one another's
registrations.

```ts
// packages/cli/src/services/Generator.ts
const generate = (params: GenerateParams) =>
  Effect.gen(function* () {
    // ...
    const registry = yield* PluginRegistry.createInstance();
    yield* pluginLoader.loadAll({ registry /* ... */ });
    // ... rest of the pipeline uses `registry` ...
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

The entire generation pipeline runs inside the `typeweaver.Generator.generate` span (`Effect.fn`) so
every call gets its own root span — concurrent calls trace independently.

The top-level service composes three internal workflow boundaries:

- preflight and output-lock ownership;
- plugin initialization, resource collection, generation, indexing, and finalization;
- optional formatting and completion reporting.

These workflows are internal functions rather than additional services. They receive the already
captured service instances they need, so the runtime Layer and public API stay unchanged.
`Generator.generate` remains the only operation that orders the complete pipeline. The workflow
functions do not introduce spans of their own; existing service and plugin spans therefore remain
direct children of `typeweaver.Generator.generate`.

## Consequences

### Positive

- The long-lived `ManagedRuntime` is preserved. Service construction (template directory resolution,
  plugin module loader setup) happens once at process start, not on every call.
- Concurrent `Generator.generate` calls produce independent outputs. The regression is locked in by
  `packages/cli/__test__/generator.concurrent.test.ts`, which fires two `generate` calls with
  different output directories at the same runtime instance and asserts no cross-contamination.
- `IndexFileGenerator` receives a slice of the per-call tracker, not a reference to a shared list.
  Index files reflect exactly the files this call produced.
- The pipeline is observable: `typeweaver.Generator.generate` spans show up in trace exports, with
  nested service-operation spans (`typeweaver.SpecLoader.load`, `typeweaver.SpecBundler.bundle`,
  `typeweaver.PluginLoader.loadAll`, `typeweaver.IndexFileGenerator.generate`) and per-plugin
  lifecycle spans (`typeweaver.plugin.{phase}` tagged with the plugin name) underneath.
- Successful plugin initialization and registration on the finalizer stack form one masked
  transition. Initialization remains interruptible; once success reaches the orchestrator boundary,
  a pending interruption cannot skip that plugin's finalizer.
- Spec bundles and generated files publish atomically. Rolldown writes to a scoped staging directory
  and must settle before the scope and output lock are released; file replacement and generated-file
  tracking commit before fallible temp cleanup.

### Negative

- The `PluginRegistry.createInstance` call is load-bearing and easy to forget when extending the
  pipeline. The disjoint-plugin-set test in `generator.concurrent.test.ts` and the comment above the
  call in `Generator.ts` document the intent; a future contributor who reverts the factory pattern
  to a shared `Ref` will see the concurrent test fail.
- Per-call state inside a long-lived service is a pattern that needs to be applied consistently. ADR
  0005 codifies the `succeed:` vs `effect:` rule; this ADR codifies the per-call-state rule.
  Services that hold per-call state must either build it inside the call (the `ContextBuilder`
  pattern) or expose a per-call factory the caller invokes once per invocation (the
  `PluginRegistry.createInstance` pattern).
- Rolldown does not expose a cancellation signal. Interruption therefore waits for an active build
  Promise to settle rather than releasing the scope and output lock while detached build work can
  still mutate staging output.

### Follow-up

Nested per-phase and per-plugin spans are emitted (see Positive above and
`packages/cli/__test__/services/Generator.spans.test.ts` for the asserted topology); wiring a trace
export backend remains the open follow-up.

## Reference Files

- `packages/cli/src/services/Generator.ts` — orchestrator that yields
  `PluginRegistry.createInstance` per call
- `packages/gen/src/services/ContextBuilder.ts` — per-call tracker construction
- `packages/gen/src/services/internal/pluginContextBuilder.ts` — context factory invoked by
  `ContextBuilder`
- `packages/cli/__test__/generator.concurrent.test.ts` — concurrent-isolation regression test
- `packages/cli/__test__/generator.recovery.test.ts` — deterministic failure, interruption, cleanup,
  and same-runtime retry matrix
- `packages/cli/__test__/services/internal/` — focused workflow contracts for preflight/locking,
  plugin lifecycle, and postprocessing
- `packages/cli/__test__/services/SpecBundler.lifecycle.test.ts` — staged bundle publication and
  cleanup contract
- `packages/gen/src/services/PluginRegistry.ts` — `createInstance` factory backing per-call
  instances
