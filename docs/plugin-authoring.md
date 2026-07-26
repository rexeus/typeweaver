# Plugin Authoring Guide

This guide shows how to build a typeweaver plugin against the V2 plugin API. For the architectural
background, see [ADR 0003: Effect-native plugin API](./adr/0003-effect-native-plugin-api.md),
[ADR 0004: FileSystem service adoption](./adr/0004-filesystem-service-adoption.md), and
[ADR 0007: Generator per-call isolation](./adr/0007-generator-per-call-isolation.md).

If you are migrating a V1 plugin (built against `extends BasePlugin`), see the breaking-change
section in [`MIGRATION.md`](../MIGRATION.md).

---

## Quick start

A minimal plugin is a record returned by `definePlugin(...)`:

```ts
import { definePlugin, PluginExecutionError } from "@rexeus/typeweaver-gen";
import type { Plugin } from "@rexeus/typeweaver-gen";
import { Effect } from "effect";

export const helloPlugin: Plugin = definePlugin({
  name: "hello",
  generate: context =>
    Effect.try({
      try: () => {
        context.writeFile("hello.txt", "hello from a typeweaver plugin\n");
      },
      catch: cause =>
        new PluginExecutionError({
          pluginName: "hello",
          phase: "generate",
          cause,
        }),
    }),
});

export default helloPlugin;
```

Three things to notice:

1. `generate` returns an `Effect`. The error channel is narrowed to `PluginExecutionError`. The
   orchestrator does not catch raw `throw`s — you own the boundary.
2. The work inside `try:` is plain synchronous code: `context.writeFile(...)`. The `Effect.try`
   wrapper turns a thrown exception into a typed failure.
3. The plugin is the **value** returned from `definePlugin(...)`. There is no class to subclass and
   no method to override.

---

## The `Plugin` shape

```ts
type Plugin = {
  readonly name: string;
  readonly depends?: readonly string[];
  readonly initialize?: (ctx: PluginContext) => Effect<void, PluginExecutionError>;
  readonly collectResources?: (
    spec: NormalizedSpec
  ) => Effect<NormalizedSpec, PluginExecutionError>;
  readonly generate?: (ctx: GeneratorContext) => Effect<void, PluginExecutionError>;
  readonly finalize?: (ctx: PluginContext) => Effect<void, PluginExecutionError>;
};
```

The four lifecycle stages run in this order, once per `typeweaver generate` invocation:

| Stage              | When                                         | Use it for                                                                            |
| ------------------ | -------------------------------------------- | ------------------------------------------------------------------------------------- |
| `initialize`       | After plugin discovery, before normalization | Setup that needs the resolved output directory but not the spec                       |
| `collectResources` | After normalization, before emission         | Transforming the normalized spec (e.g. injecting derived ops)                         |
| `generate`         | Once the spec is final                       | Writing files via `context.writeFile`                                                 |
| `finalize`         | After every plugin has generated             | Post-processing, summary output. Failures surface as WARN — they do not fail the run. |

All four are optional. The first-party plugins (`types`, `clients`, `server`, `hono`, `aws-cdk`,
`openapi`) only implement `generate`.

`depends` declares a topological ordering: a plugin with `depends: ["types"]` will not run a stage
until `types`'s same stage has completed.

### Supported lifecycle boundary

The V2 API is designed for deterministic code generators and exit-independent resources:

- every hook returns an Effect with `R = never`; plugins provide their own services before returning
  from a hook;
- work whose failure must fail generation belongs in `initialize`, `collectResources`, or
  `generate`;
- `finalize` is best-effort cleanup: typed failures are logged as warnings, while defects still
  propagate after every eligible finalizer has been attempted;
- `finalize` does not receive the pipeline's original `Exit`, so commit-versus-rollback transactions
  are not supported by V2.

The [scoped service pattern](#exit-independent-scoped-services-inside-a-synchronous-factory) below
shows the supported resource lifetime. If a plugin requires exit-dependent transaction semantics,
that needs a future lifecycle contract rather than a local workaround.

---

## `definePlugin` vs `definePluginWithLibCopy`

Pick the helper that matches your plugin's shape.

### `definePlugin` — generic

Use it when you write files programmatically and do not ship any runtime support code:

```ts
import { definePlugin, PluginExecutionError } from "@rexeus/typeweaver-gen";
import { Effect } from "effect";

export const openApiPlugin = definePlugin({
  name: "openapi",
  generate: context =>
    Effect.try({
      try: () => {
        const document = buildOpenApiDocument(context.normalizedSpec);
        context.writeFile("openapi/openapi.json", JSON.stringify(document, null, 2));
      },
      catch: cause =>
        new PluginExecutionError({
          pluginName: "openapi",
          phase: "generate",
          cause,
        }),
    }),
});
```

### `definePluginWithLibCopy` — emit-and-copy pattern

Use it when your plugin (a) copies a static `lib/` directory of runtime support code into the
generated output, then (b) runs one or more synchronous emitter functions. Five of the first-party
plugins follow this exact shape:

```ts
import path from "node:path";
import { fileURLToPath } from "node:url";
import { definePluginWithLibCopy } from "@rexeus/typeweaver-gen";
import type { Plugin } from "@rexeus/typeweaver-gen";
import { generate as generateRequests } from "./requestGenerator.js";
import { generate as generateResponses } from "./responseGenerator.js";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));

export const typesPlugin: Plugin = definePluginWithLibCopy({
  name: "types",
  libSourceDir: path.join(moduleDir, "lib"),
  generators: [generateRequests, generateResponses],
});

export default typesPlugin;
```

`definePluginWithLibCopy` handles the `Effect.try` boundary, the `PluginExecutionError` mapping, and
the lib-file copying. Your emitter functions are plain sync `(context: GeneratorContext) => void`.

---

## Factory style vs record style

The first-party plugins export their `Plugin` two different ways. Both are discoverable by
`PluginLoader`.

### Record style — no configuration

A plugin that takes no options exports the `Plugin` record directly:

```ts
// packages/types/src/index.ts
export const typesPlugin: Plugin = definePluginWithLibCopy({ ... });
export default typesPlugin;
```

### Factory style — with options

A plugin that takes configuration exports a function that validates the options and returns a
`Plugin`:

```ts
// packages/openapi/src/openApiPlugin.ts
export const openApiPlugin = (options: OpenApiPluginOptions = {}): Plugin => {
  const normalized = normalizeOpenApiPluginOptions(options);

  return definePlugin({
    name: "openapi",
    generate: context => Effect.try({ ... }),
  });
};

export default openApiPlugin;
```

The factory contract is **pure and synchronous**. Validate options eagerly so misconfiguration
surfaces at composition time, not during generation. Do not perform I/O inside the factory.

The user invokes a factory plugin in `typeweaver.config.js` by passing an array tuple:

```ts
export default {
  plugins: ["types", ["openapi", { info: { title: "My API", version: "1.0.0" } }]],
};
```

### Reporting misconfiguration: `PluginConfigError`

Construction-time validation lives outside any `Effect`, so it cannot fail an Effect channel. Raise
misconfiguration as a synchronous throw of `PluginConfigError`:

```ts
import { PluginConfigError } from "@rexeus/typeweaver-gen";

const PLUGIN_NAME = "openapi";

export const openApiPlugin = (options: unknown = {}): Plugin => {
  if (typeof options !== "object" || options === null) {
    throw new PluginConfigError({
      pluginName: PLUGIN_NAME,
      reason: "options must be an object",
    });
  }
  // ... further validation ...

  return definePlugin({ name: PLUGIN_NAME, generate: ... });
};
```

`PluginConfigError` is itself a `Data.TaggedError`, so the `PluginLoader` recognises it and surfaces
it directly to the CLI boundary as a typed failure — the user sees
`Plugin 'openapi' is misconfigured: ...` rather than a generic "plugin failed to load" wrapper. A
`PluginConfigError` short-circuits every remaining resolution strategy for the same plugin name,
because misconfiguration is the same regardless of which specifier resolved the module.

Keep lifecycle-stage failures on the `Effect` channel as `PluginExecutionError`; reserve
`PluginConfigError` strictly for construction-time options rejection.

---

## The `Effect.try` boundary

V2 plugin bodies wrap their synchronous work in `Effect.try`. The orchestrator does **not** catch
raw `throw`s for you: a thrown exception inside a `generate` body that is not wrapped becomes a
runtime defect, not a typed `PluginExecutionError`.

The pattern is always the same:

```ts
generate: context =>
  Effect.try({
    try: () => {
      // ...your sync emission logic here...
      context.writeFile("foo.ts", renderedContent);
    },
    catch: cause =>
      new PluginExecutionError({
        pluginName: "my-plugin",
        phase: "generate",
        cause,
      }),
  });
```

The `cause` is whatever was thrown — a `Error`, a string, an unknown object. `PluginExecutionError`
preserves it for downstream inspection but renders only the message in the CLI surface (see
[ADR 0006: CLI error and log formatting](./adr/0006-cli-error-and-log-formatting.md)).

---

## The `GeneratorContext` sync helpers

Inside the `try:` block, the `GeneratorContext` exposes a sync API. Every helper throws on failure;
the surrounding `Effect.try` converts the throw into a `PluginExecutionError`.

| Helper                                    | Purpose                                                                   |
| ----------------------------------------- | ------------------------------------------------------------------------- |
| `writeFile(path, content)`                | Atomic temp-file + rename write; registers the path with the tracker.     |
| `renderTemplate(templatePath, data)`      | Reads and renders an EJS-like template; throws on I/O or render failure.  |
| `addGeneratedFile(path)`                  | Registers a path without writing (for files produced by `copyLibFiles`).  |
| `getGeneratedFiles()`                     | Snapshot of every registered path so far, sorted lexicographically.       |
| `getResourceOutputDir(name)`              | Output directory for a normalized resource.                               |
| `getOperationOutputPaths({ ... })`        | All eight per-operation output paths (request, response, client, ...).    |
| `getCanonicalResponse(name)`              | Look up a canonical `NormalizedResponse` by name.                         |
| `getCanonicalResponseOutputFile(name)`    | Output file path for a canonical response.                                |
| `getCanonicalResponseImportPath({ ... })` | Relative import path from an importing directory to a canonical response. |
| `getOperationDefinitionAccessor({ ... })` | TypeScript accessor for an operation's bundled spec definition.           |
| `getSpecImportPath({ importerDir })`      | Relative import path to the bundled spec module.                          |

Filesystem paths returned by output helpers use the host platform's separators. Helpers intended for
generated TypeScript imports return forward-slash module specifiers. The `writeFile` and
`addGeneratedFile` helpers run the requested path through the path-safety guard (see
`packages/gen/src/helpers/pathSafety.ts`); unsafe paths throw `UnsafeGeneratedPathError`, which
becomes a `PluginExecutionError` at your boundary.

---

## The Effect-native context surface

If you prefer to write your plugin in Effect style — no `Effect.try` boundary, typed errors all the
way — the context also exposes Effect-returning counterparts of the I/O helpers:

| Helper                                     | Error channel                                                          |
| ------------------------------------------ | ---------------------------------------------------------------------- |
| `writeFileEffect(path, content)`           | `GeneratedPathProbeError \| UnsafeGeneratedPathError \| PlatformError` |
| `renderTemplateEffect(templatePath, data)` | `TemplateRenderError \| PlatformError`                                 |
| `addGeneratedFileEffect(path)`             | `GeneratedPathProbeError \| UnsafeGeneratedPathError`                  |

These provide the **same guarantees** as the sync helpers — path-traversal guard, atomic temp-file +
rename replace, file-mode preservation, tracker registration, queued `Generated:` log line — but the
I/O routes through `@effect/platform`'s `FileSystem` service. The service is captured when the
context is built, so your lifecycle stages keep `R = never`. Map the typed failures into
`PluginExecutionError` before returning:

```ts
export const myPlugin = definePlugin({
  name: "my-plugin",
  generate: context =>
    Effect.gen(function* () {
      const source = yield* context.renderTemplateEffect("MyTemplate.ejs", {
        items: context.normalizedSpec.resources,
      });
      yield* context.writeFileEffect("my-plugin/output.ts", source);
    }).pipe(
      Effect.mapError(
        cause =>
          new PluginExecutionError({
            pluginName: "my-plugin",
            phase: "generate",
            cause,
          })
      )
    ),
});
```

Both surfaces share one file tracker and one log queue, so a plugin may freely mix sync and Effect
helpers. Keep emission logic dependent on the smallest `Pick<GeneratorContext, ...>` it needs; this
makes plugin tests independent of filesystem and orchestration details. The first-party Hono router
generator is the repository's reference implementation: it renders and writes generated routers
exclusively through `renderTemplateEffect` and `writeFileEffect`, mapping their typed failures once
at the plugin boundary.

---

## Exit-independent scoped services inside a synchronous factory

The standard loader accepts a `Plugin` record or a synchronous `(options?: PluginConfig) => Plugin`
factory. It does not execute Effect-returning factories. This keeps construction deterministic:
validate options and create per-generation closure state in the factory, but perform no I/O and
acquire no resources there.

When a plugin needs a long-lived service whose cleanup is unconditional (an HTTP client, connection
pool, cache, or watcher), keep every lifecycle method at `R = never` with this ownership pattern:

1. Export a synchronous `PluginFactory`. The loader creates one plugin instance per generation, so
   its private state is not shared between concurrent runs.
2. In `initialize`, create a private `Scope` and build the service `Layer` with
   `Layer.buildWithScope`. If initialization fails or is interrupted, close the Scope before the
   failure leaves `initialize`; otherwise retain the Scope and built service context in the
   instance.
3. In later hooks, provide the retained service context to the hook Effect.
4. In `finalize`, finish the plugin's service-dependent work first and close the Scope in an
   `Effect.ensuring` finalizer. The generator invokes `finalize` exactly once for every successfully
   initialized plugin, including after failure, defect, or interruption elsewhere in the pipeline.

`Plugin.finalize` does not receive the generator's original `Exit`, so the private Scope is closed
with `Exit.void`. This pattern is intentionally limited to **exit-independent resources**. Do not
use it for a transaction or any resource whose finalizer must choose commit versus rollback from the
pipeline outcome; supporting that would require a future plugin-lifecycle contract that carries the
original `Exit`.

Do not provide the resource Layer independently to each lifecycle hook: that would acquire and
release a different resource for every hook. Do not call `Effect.runSync`, `Effect.runPromise`, or
create a local runtime inside the plugin.

The complete [`scoped-service-plugin.mjs`](../packages/cli/examples/scoped-service-plugin.mjs)
example implements this pattern. It is JavaScript with `checkJs`, is compiled during verification,
and is exercised through the built CLI. Its fixture proves the resource sequence
`acquire → generate → finalize → release`.

---

## Packaging

A plugin package's `package.json` must declare its peer dependencies. Mirror the six first-party
plugins:

```json
{
  "name": "my-typeweaver-plugin",
  "type": "module",
  "main": "dist/index.mjs",
  "types": "dist/index.d.ts",
  "peerDependencies": {
    "@rexeus/typeweaver-gen": "^1.0.0",
    "effect": ">=3.22.0 <4"
  }
}
```

TypeWeaver develops and tests against Effect 3.22.0. The peer range accepts later compatible Effect
3 releases without admitting Effect 4. Its 3.22 lower bound is required by the current `@effect/*`
package family and keeps the plugin and generator on one Effect identity.

Export your plugin in one of these forms:

1. **Default export** that is a `Plugin` record.
2. **Default export** that is a synchronous `(options?) => Plugin` factory.
3. **Named export** containing either form when no valid default exists.

`PluginLoader` prefers `default`, then checks named exports in module order until it finds the first
valid plugin shape. Export one plugin value per module; helper functions may be exported alongside
it because a valid default always wins.

The CLI loads plugins by name. A plugin named `my-plugin` is loaded from a package whose
`package.json` `name` is `@rexeus/typeweaver-my-plugin` or `typeweaver-plugin-my-plugin`, or by
explicit absolute path in `typeweaver.config.js`.

---

## Testing plugins

The V2 contract is testable without a real runtime. Put emission logic behind the narrowest context
slice it needs, then test that function with a complete fake for that small contract:

```ts
import { definePlugin, PluginExecutionError } from "@rexeus/typeweaver-gen";
import type { GeneratorContext } from "@rexeus/typeweaver-gen";
import { Effect } from "effect";
import { describe, expect, test } from "vitest";

type HelloContext = Pick<GeneratorContext, "writeFile">;

export const generateHello = (context: HelloContext): void => {
  context.writeFile("hello.txt", "hello from a typeweaver plugin\n");
};

export const helloPlugin = definePlugin({
  name: "hello",
  generate: context =>
    Effect.try({
      try: () => generateHello(context),
      catch: cause =>
        new PluginExecutionError({
          pluginName: "hello",
          phase: "generate",
          cause,
        }),
    }),
});

describe("generateHello", () => {
  test("writes the greeting", () => {
    const writtenFiles: Array<{ path: string; content: string }> = [];
    const context: HelloContext = {
      writeFile: (path, content) => {
        writtenFiles.push({ path, content });
      },
    };

    generateHello(context);

    expect(writtenFiles).toEqual([
      { path: "hello.txt", content: "hello from a typeweaver plugin\n" },
    ]);
  });
});
```

The pattern keeps your tests fast (no disk I/O), deterministic (no real runtime), and focused on the
plugin's behavior rather than the orchestration around it.

---

## Further reading

- [ADR 0003: Effect-native plugin API](./adr/0003-effect-native-plugin-api.md) — why V2 exists, what
  V1 looked like
- [ADR 0004: FileSystem service adoption](./adr/0004-filesystem-service-adoption.md) — why
  `context.writeFile` is sync
- [ADR 0005: Effect.Service patterns](./adr/0005-effect-service-patterns.md) — choosing `succeed:`
  or `effect:` for application services
- [ADR 0007: Generator per-call isolation](./adr/0007-generator-per-call-isolation.md) — why
  concurrent generation works
- `packages/gen/src/plugins/Plugin.ts` — the `Plugin` type
- `packages/gen/src/plugins/definePluginWithLibCopy.ts` — the HOC source
