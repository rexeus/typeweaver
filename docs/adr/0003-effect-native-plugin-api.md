# ADR 0003: Effect-native Plugin API (V2)

## Status

Accepted; amended so that hosts own the per-generation lifetime of scoped plugins (see
[Scoped plugin lifetimes](#scoped-plugin-lifetimes)).

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

The Effect migration replaced the imperative interior of the generator with explicit
`Context.Service` classes and structured concurrency. The plugin contract was the last imperative
layer left.

## Decision

V2 plugins are **records** returned by the `definePlugin(...)` helper. Lifecycle stages are
`Effect`s whose error channel is narrowed to `PluginExecutionError`:

```ts
// packages/gen/src/plugins/Plugin.ts
export type PluginLifecycleHooks = {
  readonly initialize?: (ctx: PluginContext) => Effect.Effect<void, PluginExecutionError>;
  readonly collectResources?: (
    spec: NormalizedSpec
  ) => Effect.Effect<NormalizedSpec, PluginExecutionError>;
  readonly generate?: (ctx: GeneratorContext) => Effect.Effect<void, PluginExecutionError>;
  readonly finalize?: (ctx: PluginContext) => Effect.Effect<void, PluginExecutionError>;
};

export type PluginAcquisition = Effect.Effect<
  PluginLifecycleHooks,
  PluginExecutionError,
  Scope.Scope
>;

export type Plugin = {
  readonly name: string;
  readonly depends?: readonly string[];
  readonly validate?: (
    spec: NormalizedSpec,
    ctx: PluginValidationContext
  ) => Effect.Effect<readonly Issue[], PluginExecutionError>;
} & (PluginLifecycleHooks | { readonly acquire: PluginAcquisition });

export const definePlugin = (plugin: Plugin): Plugin => plugin;
```

`Plugin.generate` keeps `R = never` on every lifecycle stage. Plugin authors write platform-agnostic
code: they wrap their sync work in `Effect.try` and map the thrown cause to a tagged
`PluginExecutionError`. The standard loader accepts a `Plugin` record or a pure, synchronous
`PluginFactory`; it never executes an Effect-returning factory. A service-dependent plugin declares
`acquire` instead of top-level lifecycle hooks, as described in
[Scoped plugin lifetimes](#scoped-plugin-lifetimes). Its hooks therefore still satisfy `R = never`,
while resource acquisition and release stay inside the generator lifecycle.

### Scoped plugin lifetimes

A plugin that owns resources is a scoped constructor, the same shape as `Layer.effect` over
`Effect.acquireRelease`: `acquire` runs in a Scope and returns the lifecycle hooks closed over the
services it acquired. The **host owns that Scope** for exactly one generation:

1. The host wraps each generation in a Scope (`Effect.scoped` around the plugin lifecycle in
   `packages/cli/src/services/internal/pluginLifecycle.ts`, and around each `run` of the public test
   kit).
2. At the `initialize` stage, in registration order, the host runs each plugin's acquisition
   (`acquirePluginLifecycle` returns a plain plugin's own hooks unchanged) and then its `initialize`
   hook. Acquisition failures are `PluginExecutionError`s in the `initialize` phase. Acquisition
   plus `initialize` and the registration on the finalizer stack form one masked transition.
3. The host runs `collectResources` and `generate` with the acquired hooks and `finalize` in reverse
   order for every initialized plugin. Closing the Scope then releases the resources of every scoped
   plugin in reverse order, on success, typed failure, defect, and interruption.

`validate` stays outside `acquire`, so validation-only runs never acquire resources.
`defineScopedPlugin` builds this shape from a Layer and hooks whose requirement channel is the
Layer's output. It builds the Layer with a private memo map, the documented equivalent of
`Effect.provide(layer, { local: true })`, so a generation never reuses an instance that an enclosing
runtime already built.

The first implementation built the Layer inside `initialize`, kept the Scope and services in a
`WeakMap` keyed by the current fiber, and closed the Scope from `finalize`. That required every host
to run all hooks of a generation on one fiber: a hook that a host ran under `Effect.timeout` or
`Effect.race` found no services and died. It also needed guards against double initialization.
Host-owned Scopes remove the per-fiber state and those guards: the hooks close over their services
and run on any fiber, and concurrent generations that share a module-cached plugin instance are
isolated because each acquisition returns its own hooks.

Because `finalize` does not receive the generator's original `Exit`, this pattern remains limited to
exit-independent resources. The Scope closes with the lifecycle's exit, which precedes formatting
and publication, so it is not a commit signal; transactional finalizers require a future lifecycle
contract.

The orchestrator (`packages/cli/src/services/Generator.ts`) drives the lifecycle through
`yield* registration.plugin.generate(context)`. Failures propagate as typed `PluginExecutionError`s
up to the CLI boundary, where `formatErrorForCli` translates them into single-line user-facing
messages.

### Plugin construction-time validation

Plugins with options (today: `openapi`) validate their inputs eagerly when the plugin record is
constructed — for example `openApiPlugin({...})` rejects an unsafe `outputPath` before the Effect
lifecycle ever runs. Construction happens at composition time, outside any Effect, so the failure
mode is a **synchronous throw**, not an Effect failure.

The throw is itself a `Data.TaggedError`: `PluginConfigError`
(`packages/gen/src/plugins/errors/PluginConfigError.ts`), carrying the plugin name and the specific
reason. The `PluginLoader` (`packages/cli/src/services/PluginLoader.ts`) recognises the tag inside
its candidate-resolution `try/catch` and short-circuits the load with the `PluginConfigError`
directly, instead of folding the message into a generic `PluginLoadError`. The CLI boundary
therefore distinguishes "this plugin is misconfigured" from "we could not load this plugin at all" —
two failure shapes that deserve two error tags.

Plugin authors who introduce their own options follow the same pattern: validate eagerly in the
plugin constructor and throw `PluginConfigError` on rejection. The lifecycle stages stay
`Effect`-native; only the constructor's options check is sync.

## Consequences

### Positive

- Plugin authors compose lifecycle stages with the same primitives the rest of the codebase uses —
  `Effect.gen`, `Effect.try`, `Effect.tap`.
- Failures carry the plugin name and phase as structured data; the CLI surface prints
  `Failed in plugin 'openapi' (generate): ...` instead of a stack trace.
- Construction helpers like `definePluginWithLibCopy`
  (`packages/gen/src/plugins/definePluginWithLibCopy.ts`) deduplicate the byte-equivalent
  boilerplate across the five first-party plugins (`types`, `clients`, `server`, `hono`, `aws-cdk` —
  `openapi` uses `definePlugin` directly).
- Service-dependent plugins have one resource lifetime per generation. The factory itself remains
  pure and synchronous; `acquire` builds the private Layer into the host's generation Scope, and the
  host releases it after `finalize`. This path intentionally supports unconditional cleanup, not
  finalizers whose behavior depends on the generator's `Exit`.
- The `GeneratorContext` sync helpers (`writeFile`, `renderTemplate`, `addGeneratedFile`) remain
  sync; plugin authors continue to call them inside the `try` block of their `Effect.try` boundary.
- An **additive Effect-native context surface** exists alongside the sync helpers:
  `writeFileEffect`, `renderTemplateEffect`, and `addGeneratedFileEffect` express the same
  guarantees (path-traversal guard, atomic temp-file + rename replace, mode preservation, file
  tracking, queued `Generated:` log line) over the platform `FileSystem` service, with closed typed
  error channels (`UnsafeGeneratedPathError | PlatformError`, `TemplateRenderError`). The
  `FileSystem` is captured when the context is built, so lifecycle stages keep `R = never`; authors
  map failures into `PluginExecutionError` via `Effect.mapError` instead of `Effect.try`. Both
  surfaces share one tracker and one log queue, so mixing them in a single plugin is safe.
- Lifecycle failure semantics mirror `try/finally`: failures in `initialize`, `collectResources`,
  and `generate` abort the run with a `PluginExecutionError`; failures in `finalize` are demoted to
  a WARN log and the run completes. Cleanup work should not fail an otherwise-successful operation.

### Negative

- Breaking change for any third-party plugin built against V1's `BasePlugin`. The public/legacy
  surface — `BasePlugin`, `TypeweaverPlugin`, `createPluginRegistry`, and `legacyAdapter` — is gone.
  `createPluginContextBuilder` was preserved as a `services/internal/` implementation detail backing
  `ContextBuilder`; it is no longer exported from the package's public API.
- Plugin packages must declare the exact native `effect 4.0.0-rc.116` peer (mirrored across all
  first-party plugins).
- Authors who previously relied on `Promise`-based lifecycle methods have to learn enough Effect to
  wrap their work in `Effect.try`. The migration guide (`docs/plugin-authoring.md`) documents the
  minimum surface.

### Alternatives Considered

A thinner wrapper that kept the class shape and added an `effect:` lifecycle method alongside the V1
`Promise`-based one was rejected: it leaves two parallel code paths that the orchestrator must
maintain and that authors must reason about. A clean cut is cheaper than a long deprecation window
for a pre-1.0 project.

### Version contract

Development and tests run on the exact native Effect `4.0.0-rc.116` pin. Every first-party plugin
publishes `peerDependencies.effect: "4.0.0-rc.116"` through the workspace catalog so all lifecycle
values share one runtime identity. `config/effect-baseline.json` records the pin; ADR 0008 documents
the source reference and standalone tsgo diagnostics gate.

## Reference Files

- `packages/gen/src/plugins/Plugin.ts` — the V2 contract
- `packages/gen/src/plugins/definePluginWithLibCopy.ts` — first-party HOC
- `packages/gen/src/plugins/defineScopedPlugin.ts` — scoped plugin helper over a Layer
- `packages/cli/src/services/internal/pluginLifecycle.ts` — host-owned generation Scope
- `packages/gen/src/plugins/errors/PluginExecutionError.ts` — lifecycle-phase typed error
- `packages/gen/src/plugins/errors/PluginConfigError.ts` — construction-time typed error
- `packages/cli/src/services/PluginLoader.ts` — recognises `PluginConfigError` and short-circuits
- `packages/types/src/index.ts`, `packages/clients/src/index.ts`, `packages/server/src/index.ts`,
  `packages/hono/src/index.ts`, `packages/aws-cdk/src/index.ts` — minimal `definePluginWithLibCopy`
  plugins
- `packages/openapi/src/openApiPlugin.ts` — factory plugin with normalized options
- `packages/openapi/src/internal/normalizeOptions.ts` — construction-time validation raising
  `PluginConfigError`
