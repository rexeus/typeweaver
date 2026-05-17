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
- `packages/cli/src/services/SpecBundler.ts` — bundle invocation via
  `FileSystem.makeTempDirectoryScoped` and `writeFileString`
- `packages/cli/src/services/SpecImporter.ts` — bundle module load
- `packages/cli/src/services/generatorDefaults.ts` — template directory resolution

Sync `node:fs` is permitted at a leaf where **any** of the following hold:

1. **The surrounding API is sync.** Plugin author helpers (`context.writeFile`,
   `context.renderTemplate`) and the sync `generate` body of `definePluginWithLibCopy` are
   contractually sync (ADR 0003). The `FileSystem` service is async-Effect and cannot satisfy that
   contract without flipping the plugin API.
2. **The caller runs before the Effect runtime exists.** The clean-target guard inspects the
   workspace _before_ the runtime is established, to refuse unsafe target directories regardless of
   whether the rest of the run ever started.
3. **The value is read once at startup and never mutated.** Reading an EJS template into memory once
   per generation run, or resolving a real path during bundler input wiring, satisfies this.

The `FileSystem` service is used everywhere else.

Current sync leaves, by category:

**Sync plugin-author surface (rule 1):**

- `packages/gen/src/services/internal/pluginContextBuilder.ts` — `writeFile` and `renderTemplate`
  (the helpers exposed on `GeneratorContext`). Called inside the plugin author's `Effect.try`.
- `packages/gen/src/plugins/copyPluginLibFiles.ts` — copy step of `definePluginWithLibCopy`.
- `packages/cli/src/generators/formatter.ts` — `fs.readdirSync` / `fs.readFileSync` /
  `fs.writeFileSync` in the format-pass body wrapped by the `Formatter` service.

**Runs before the runtime (rule 2):**

- `packages/cli/src/services/cleanTargetGuard.ts` — `assertSafeCleanTargetWith`, executed by the CLI
  entrypoint before any layer is provided.

**Read-once-at-startup (rule 3):**

- `packages/cli/src/services/IndexFileGenerator.ts` — `fs.readFileSync` of the `Index.ejs` template
  once per generation run.
- `packages/cli/src/services/SpecBundler.ts` — `fs.existsSync` / `fs.realpathSync.native` inside
  `createWrapperImportSpecifier`, resolving the user-supplied input path at bundler-wiring time. The
  bundler's mainline I/O (temp directory, wrapper write, bundle existence check) goes through the
  `FileSystem` service.

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
  lives on. The split is small and bounded by the three rules above, but it is still a cognitive
  cost.
- The seams add a thin layer of indirection at the leaves. The production binding is one screenful
  and never varies, but it has to be wired through.

### Migration Path

If the plugin author contract ever flips to Effect-yielding helpers (`context.writeFile` returning
`Effect<void, PlatformError>`), the rule-1 sync leaves can switch to the `FileSystem` service in a
single pass. The seams already align with the service's surface (`writeFileString`,
`readFileString`, `makeDirectory`); a flip is a refactor, not a redesign.

## Reference Files

- Orchestration sites: `packages/cli/src/services/generatorIO.ts`,
  `packages/cli/src/services/SpecLoader.ts`, `packages/cli/src/services/SpecBundler.ts`,
  `packages/cli/src/services/SpecImporter.ts`, `packages/cli/src/services/generatorDefaults.ts`
- Sync leaves: `packages/gen/src/services/internal/pluginContextBuilder.ts`,
  `packages/gen/src/plugins/copyPluginLibFiles.ts`, `packages/cli/src/generators/formatter.ts`,
  `packages/cli/src/services/cleanTargetGuard.ts`,
  `packages/cli/src/services/IndexFileGenerator.ts`, `packages/cli/src/services/SpecBundler.ts`
  (`createWrapperImportSpecifier` only)
- Injection seams: `packages/gen/src/helpers/pathSafety.ts` (`PathSafetyFs`),
  `packages/cli/src/services/cleanTargetGuard.ts` (`CleanTargetFs`)
- Test fake: `packages/test-utils/src/effect/InMemoryFileSystem.ts`
