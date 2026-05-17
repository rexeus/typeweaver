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

| Stage              | When                                         | Use it for                                                      |
| ------------------ | -------------------------------------------- | --------------------------------------------------------------- |
| `initialize`       | After plugin discovery, before normalization | Setup that needs the resolved output directory but not the spec |
| `collectResources` | After normalization, before emission         | Transforming the normalized spec (e.g. injecting derived ops)   |
| `generate`         | Once the spec is final                       | Writing files via `context.writeFile`                           |
| `finalize`         | After every plugin has generated             | Post-processing, summary output                                 |

All four are optional. The first-party plugins (`types`, `clients`, `server`, `hono`, `aws-cdk`,
`openapi`) only implement `generate`.

`depends` declares a topological ordering: a plugin with `depends: ["types"]` will not run a stage
until `types`'s same stage has completed.

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
export const openApiPlugin = (options: unknown = {}): Plugin => {
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
| `renderTemplate(templatePath, data)`      | Renders an EJS-like template to a string. Pure, no I/O.                   |
| `addGeneratedFile(path)`                  | Registers a path without writing (for files produced by `copyLibFiles`).  |
| `getGeneratedFiles()`                     | Snapshot of every registered path so far, sorted lexicographically.       |
| `getResourceOutputDir(name)`              | Output directory for a normalized resource.                               |
| `getOperationOutputPaths({ ... })`        | All eight per-operation output paths (request, response, client, ...).    |
| `getCanonicalResponse(name)`              | Look up a canonical `NormalizedResponse` by name.                         |
| `getCanonicalResponseOutputFile(name)`    | Output file path for a canonical response.                                |
| `getCanonicalResponseImportPath({ ... })` | Relative import path from an importing directory to a canonical response. |
| `getOperationDefinitionAccessor({ ... })` | TypeScript accessor for an operation's bundled spec definition.           |
| `getSpecImportPath({ importerDir })`      | Relative import path to the bundled spec module.                          |

All paths returned by these helpers are forward-slash, project-relative or absolute as documented in
`packages/gen/src/plugins/contextTypes.ts`. The `writeFile` and `addGeneratedFile` helpers run the
requested path through the path-safety guard (see `packages/gen/src/helpers/pathSafety.ts`); unsafe
paths throw `UnsafeGeneratedPathError`, which becomes a `PluginExecutionError` at your boundary.

---

## Higher-order plugin constructors

If your plugin needs a service (an HTTP client, a config loader, a clock), the V2 contract still
requires `Plugin.generate` to have `R = never`. Resolve the services at **construction time**,
inside an `Effect.gen`, and close over the resolved values:

```ts
import { Effect } from "effect";
import { definePlugin } from "@rexeus/typeweaver-gen";
import type { Plugin } from "@rexeus/typeweaver-gen";

export const remoteSchemaPlugin = (url: string): Effect.Effect<Plugin, never, HttpClient> =>
  Effect.gen(function* () {
    const http = yield* HttpClient;
    const schema = yield* http.fetchJson(url);

    return definePlugin({
      name: "remote-schema",
      generate: context =>
        Effect.try({
          try: () => {
            context.writeFile("remote-schema.json", JSON.stringify(schema, null, 2));
          },
          catch: cause =>
            new PluginExecutionError({
              pluginName: "remote-schema",
              phase: "generate",
              cause,
            }),
        }),
    });
  });
```

The integrator decides where to compose this — typically inside a custom `Layer` that provides
`HttpClient`. The plugin author surface (the returned `Plugin`) stays platform-agnostic.

`definePluginWithLibCopy` is itself a higher-order constructor that resolves the lib-file directory
at construction time and closes over it.

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
    "@rexeus/typeweaver-gen": "workspace:^",
    "effect": "^3.21.2"
  }
}
```

Export your plugin as one of the following — `PluginLoader` checks each in order:

1. **Named export** matching the plugin's name (`export const myPlugin`).
2. **Default export** that is a `Plugin` record.
3. **Default export** that is a `(options?) => Plugin` factory.

The CLI loads plugins by name. A plugin named `my-plugin` is loaded from a package whose
`package.json` `name` is `@rexeus/typeweaver-my-plugin` or `typeweaver-plugin-my-plugin`, or by
explicit absolute path in `typeweaver.config.js`.

---

## Testing plugins

The V2 contract is testable without a real runtime. Build a fake `GeneratorContext` that records
writes, then `Effect.runSync` the plugin's `generate`:

```ts
import { Effect } from "effect";
import { describe, expect, test } from "vitest";
import { openApiPlugin } from "../../src/index.js";

const aFakeContext = () => {
  const writtenFiles: { path: string; content: string }[] = [];
  return {
    outputDir: "/tmp/test",
    inputDir: "/tmp/test/spec",
    config: {},
    normalizedSpec: { resources: [], responses: [] },
    coreDir: "@rexeus/typeweaver-core",
    responsesOutputDir: "/tmp/test/responses",
    specOutputDir: "/tmp/test/spec-out",
    writeFile: (path: string, content: string) => writtenFiles.push({ path, content }),
    renderTemplate: () => {
      throw new Error("not used in this test");
    },
    addGeneratedFile: () => undefined,
    getGeneratedFiles: () => writtenFiles.map(f => f.path),
    // ... rest of the GeneratorContext surface ...
    writtenFiles,
  };
};

describe("openApiPlugin", () => {
  test("writes an OpenAPI document to the default output path", () => {
    const context = aFakeContext();
    const plugin = openApiPlugin({});

    Effect.runSync(plugin.generate!(context));

    expect(context.writtenFiles).toHaveLength(1);
    expect(context.writtenFiles[0].path).toBe("openapi/openapi.json");
  });
});
```

For a complete example, see `packages/openapi/__test__/unit/OpenApiPlugin.test.ts`.

The pattern keeps your tests fast (no disk I/O), deterministic (no real runtime), and focused on the
plugin's behavior rather than the orchestration around it.

---

## Further reading

- [ADR 0003: Effect-native plugin API](./adr/0003-effect-native-plugin-api.md) — why V2 exists, what
  V1 looked like
- [ADR 0004: FileSystem service adoption](./adr/0004-filesystem-service-adoption.md) — why
  `context.writeFile` is sync
- [ADR 0005: Effect.Service patterns](./adr/0005-effect-service-patterns.md) — `succeed:` vs
  `effect:` when you build a higher-order constructor
- [ADR 0007: Generator per-call isolation](./adr/0007-generator-per-call-isolation.md) — why
  concurrent generation works
- `packages/gen/src/plugins/Plugin.ts` — the `Plugin` type
- `packages/gen/src/plugins/definePluginWithLibCopy.ts` — the HOC source
