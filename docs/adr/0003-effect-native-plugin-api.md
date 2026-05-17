# ADR 0003: Effect-native Plugin API (V2)

## Status

Accepted

## Context

The original plugin system (V1) shipped with the move to the functional spec API (ADR 0001) and
required plugin authors to extend a `BasePlugin` class. Each plugin implemented imperative lifecycle
methods that returned `Promise<void> | void`:

```ts
// V1
export class TypesPlugin extends BasePlugin {
  public override async generate(context: GeneratorContext): Promise<void> {
    generateRequests(context);
    generateRequestValidators(context);
    generateResponses(context);
    generateResponseValidators(context);
  }
}
```

This design had three structural problems:

1. **Error channels were opaque.** A thrown exception inside `generate` carried no typed information
   about which plugin or phase failed. The orchestrator wrapped every plugin call in a `try/catch`
   and tagged failures by inspecting the surrounding context, not the error itself.
2. **Composition required inheritance.** Higher-order plugins (e.g. one that copies a `lib/`
   directory before running emitters) had to subclass `BasePlugin`. Cross-cutting concerns like span
   tracing and structured logging leaked into every subclass.
3. **Plugin authors paid a platform tax.** Class-based lifecycle methods could not directly request
   services from the runtime; an ad-hoc adapter (`legacyAdapter`) bridged the gap and silently hid
   the seams behind imperative `async`/`await` plumbing.

The Effect migration (Tasks #1–#9) replaced the imperative interior of the generator with
`Effect.Service` classes and structured concurrency. The plugin contract was the last imperative
layer left.

## Decision

V2 plugins are **records** returned by the `definePlugin(...)` helper. Lifecycle stages are
`Effect`s whose error channel is narrowed to `PluginExecutionError`:

```ts
// packages/gen/src/plugins/Plugin.ts
export type Plugin = {
  readonly name: string;
  readonly depends?: readonly string[];
  readonly initialize?: (ctx: PluginContext) => Effect.Effect<void, PluginExecutionError>;
  readonly collectResources?: (
    spec: NormalizedSpec
  ) => Effect.Effect<NormalizedSpec, PluginExecutionError>;
  readonly generate?: (ctx: GeneratorContext) => Effect.Effect<void, PluginExecutionError>;
  readonly finalize?: (ctx: PluginContext) => Effect.Effect<void, PluginExecutionError>;
};

export const definePlugin = (plugin: Plugin): Plugin => plugin;
```

`Plugin.generate` keeps `R = never` on every lifecycle stage. Plugin authors write platform-agnostic
code: they wrap their sync work in `Effect.try` and map the thrown cause to a tagged
`PluginExecutionError`. Higher-order plugin constructors that need services (e.g. a remote HTTP
fetch) request them inside an `Effect.gen` at construction time, close over the resolved values, and
return a plain `Plugin` whose effects still satisfy `R = never`.

The orchestrator (`packages/cli/src/services/Generator.ts`) drives the lifecycle through
`yield* registration.plugin.generate(context)`. Failures propagate as typed `PluginExecutionError`s
up to the CLI boundary, where `formatErrorForCli` translates them into single-line user-facing
messages.

## Consequences

### Positive

- Plugin authors compose lifecycle stages with the same primitives the rest of the codebase uses —
  `Effect.gen`, `Effect.try`, `Effect.tap`.
- Failures carry the plugin name and phase as structured data; the CLI surface prints
  `Failed in plugin 'openapi' (generate): ...` instead of a stack trace.
- Higher-order constructors like `definePluginWithLibCopy`
  (`packages/gen/src/plugins/definePluginWithLibCopy.ts`) deduplicate the byte-equivalent
  boilerplate across the five first-party plugins (`types`, `clients`, `server`, `hono`, `aws-cdk`).
- The `GeneratorContext` sync helpers (`writeFile`, `renderTemplate`, `addGeneratedFile`) remain
  sync; plugin authors continue to call them inside the `try` block of their `Effect.try` boundary.
- Lifecycle failure semantics mirror `try/finally`: failures in `initialize`, `collectResources`,
  and `generate` abort the run with a `PluginExecutionError`; failures in `finalize` are demoted to
  a WARN log and the run completes. Cleanup work should not fail an otherwise-successful operation.

### Negative

- Breaking change for any third-party plugin built against V1's `BasePlugin`. The public/legacy
  surface — `BasePlugin`, `TypeweaverPlugin`, `createPluginRegistry`, and `legacyAdapter` — is gone.
  `createPluginContextBuilder` was preserved as a `services/internal/` implementation detail backing
  `ContextBuilder`; it is no longer exported from the package's public API.
- Plugin packages must now declare `effect ^3.21.x` as a `peerDependency` (mirrored across all six
  first-party plugins).
- Authors who previously relied on `Promise`-based lifecycle methods have to learn enough Effect to
  wrap their work in `Effect.try`. The migration guide (`docs/plugin-authoring.md`) documents the
  minimum surface.

### Alternatives Considered

A thinner wrapper that kept the class shape and added an `effect:` lifecycle method alongside the V1
`Promise`-based one was rejected: it leaves two parallel code paths that the orchestrator must
maintain and that authors must reason about. A clean cut is cheaper than a long deprecation window
for a pre-1.0 project.

### Version pinning

Every Effect dependency is pinned to `^3.21.x`. Effect v4 was still in beta at migration time and
its `@effect/platform` / `@effect/cli` peers track 3.x; pinning the ecosystem to one minor line
keeps `Layer.provide`, `Effect.Service`, and `@effect/cli` integration on the same release train.
The pin is mirrored across every first-party plugin (`peerDependencies.effect: "^3.21.x"`) so
external users see one consistent range.

## Reference Files

- `packages/gen/src/plugins/Plugin.ts` — the V2 contract
- `packages/gen/src/plugins/definePluginWithLibCopy.ts` — first-party HOC
- `packages/gen/src/plugins/errors/PluginExecutionError.ts` — the typed error
- `packages/types/src/index.ts`, `packages/clients/src/index.ts`, `packages/server/src/index.ts`,
  `packages/hono/src/index.ts`, `packages/aws-cdk/src/index.ts` — minimal `definePluginWithLibCopy`
  plugins
- `packages/openapi/src/openApiPlugin.ts` — factory plugin with normalized options
