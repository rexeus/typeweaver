# ADR 0004: FileSystem Service Adoption Strategy

## Status

Accepted

## Context

The Effect migration introduced `@effect/platform/FileSystem` as the runtime's canonical filesystem
abstraction. Adopting it everywhere — at every leaf `fs.writeFileSync` call inside plugin code —
would have forced plugin authors to write Effect-yielding code in their `writeFile`/`renderTemplate`
calls. That breaks the V2 plugin contract (ADR 0003), which keeps `Plugin.generate` at `R = never`
and the `GeneratorContext` helpers sync.

A complete sync-everywhere fallback was equally unattractive: tests would either need on-disk
fixtures (slow, order-sensitive) or a parallel mock layer disconnected from the production
filesystem path.

The choice was a split: adopt the service at orchestration sites where Effect already flows; keep
the leaves sync behind narrow dependency-injection seams so tests can substitute fakes without
changing the plugin author surface.

## Decision

Five orchestration sites use the `FileSystem` service tag:

- `packages/cli/src/services/generatorIO.ts` — `assertSafeCleanTargetEffect` callers,
  `removeOutputDir`, `ensureOutputDirectories`
- `packages/cli/src/services/SpecLoader.ts` — bundle output write
- `packages/cli/src/services/SpecBundler.ts` — bundle invocation
- `packages/cli/src/services/SpecImporter.ts` — bundle module load
- `packages/cli/src/services/generatorDefaults.ts` — template directory resolution

Three leaf sites stay sync on `node:fs`, behind injectable seams:

- `packages/gen/src/services/internal/pluginContextBuilder.ts` — `writeFile` and `renderTemplate`
  (the helpers exposed on `GeneratorContext`). Sync because plugin authors call them inside
  `Effect.try`.
- `packages/gen/src/plugins/copyPluginLibFiles.ts` — invoked from the sync `generate` body of
  `definePluginWithLibCopy` plugins.
- `packages/cli/src/services/cleanTargetGuard.ts` — the `assertSafeCleanTargetWith` core algorithm,
  which inspects the workspace before `FileSystem` has had a chance to mediate.

Each sync leaf accepts an injectable filesystem shape: `PathSafetyFs`, `CleanTargetFs`,
`PathSafetyShape`, `TemplateRendererShape`. Production code passes the real `node:fs`-backed
implementation; tests pass an in-memory double.

## Consequences

### Positive

- Orchestration tests run against `InMemoryFileSystem` (from
  `packages/test-utils/src/effect/InMemoryFileSystem.ts`) without touching disk —
  ordering-independent, parallel-safe, byte-stable.
- The V2 plugin author API stays sync end-to-end. Plugin code reads as procedural emitters wrapped
  in a single `Effect.try` boundary, not as a cascade of `yield*` calls.
- The split is documented at the seams. A future contributor reading `PathSafetyFs`,
  `CleanTargetFs`, or `TemplateRendererShape` sees the injection point and the production binding
  side-by-side.
- A `services/internal/` folder (in both `packages/gen/src/services/` and
  `packages/cli/src/services/`) holds code consumed by services in the same package — not part of
  the public service surface — keeping shared service plumbing out of consumer imports.
- The errors directories split by layer: `services/errors/` holds domain errors raised from inside a
  service (e.g. `SpecBundleError`, `IndexFileGenerationError`); `generators/errors/` holds errors
  raised from the generation pipeline orchestration layer (`PluginLoadError`,
  `UnsafeCleanTargetError`).

### Negative

- Two filesystem abstractions coexist. A contributor must know which side of the line a given call
  lives on. The split is small (3 leaves) and named explicitly, but it is still a cognitive cost.
- The seams add a thin layer of indirection at the leaves. The production binding is one screenful
  and never varies, but it has to be wired through.

### Migration Path

If the plugin author contract ever flips to Effect-yielding helpers (`context.writeFile` returning
`Effect<void, PlatformError>`), the three sync leaves can switch to the `FileSystem` service in a
single pass. The seams already align with the service's surface (`writeFileString`,
`readFileString`, `makeDirectory`); a flip is a refactor, not a redesign.

## Reference Files

- Orchestration sites: `packages/cli/src/services/generatorIO.ts`,
  `packages/cli/src/services/SpecLoader.ts`, `packages/cli/src/services/SpecBundler.ts`,
  `packages/cli/src/services/SpecImporter.ts`, `packages/cli/src/services/generatorDefaults.ts`
- Sync leaves: `packages/gen/src/services/internal/pluginContextBuilder.ts`,
  `packages/gen/src/plugins/copyPluginLibFiles.ts`, `packages/cli/src/services/cleanTargetGuard.ts`
- Injection seams: `packages/gen/src/helpers/pathSafety.ts` (`PathSafetyFs`),
  `packages/cli/src/services/cleanTargetGuard.ts` (`CleanTargetFs`)
- Test fake: `packages/test-utils/src/effect/InMemoryFileSystem.ts`
