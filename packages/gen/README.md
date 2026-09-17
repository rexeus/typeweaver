# `@rexeus/typeweaver-gen`

> Build TypeWeaver projections against one validated, normalized API model using a public lifecycle,
> structured diagnostics, path-safe output contexts, scoped Effect services, and an in-memory plugin
> test kit.

[![npm version](https://img.shields.io/npm/v/@rexeus/typeweaver-gen.svg)](https://www.npmjs.com/package/@rexeus/typeweaver-gen)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](../../LICENSE)

## Choose this package when

Most TypeWeaver users should install [`@rexeus/typeweaver`](../cli/README.md), select first-party
projections, and never depend on this package directly.

Use `@rexeus/typeweaver-gen` when you are:

- writing a third-party generator plugin;
- testing a projection independently of the CLI;
- consuming TypeWeaver's normalized contract model;
- integrating generation through the public orchestration contracts.

## Install the plugin SDK

```bash
pnpm add -D \
  @rexeus/typeweaver-gen \
  @rexeus/typeweaver-core \
  effect \
  zod
```

The supported Effect peer range is `>=3.22.0 <4`. Keep one compatible Effect identity in the
dependency graph.

## The normalized model is the extension boundary

Plugins do not reinterpret the raw authoring module independently. TypeWeaver first validates and
normalizes the contract, then gives every plugin the same generator-neutral model:

```text
authoring module
      │
      ▼
validate + normalize
      │
      ▼
NormalizedSpec
      │
      ├── plugin A
      ├── plugin B
      └── plugin C
```

The model includes normalized resources, operations, request parts, named response usage, metadata,
tags, and effective security declarations. It preserves whether security was absent, inherited,
explicitly public, or overridden.

<!-- docs-example: metadata-security-contract -->

The authoring input behind this normalized shape is typechecked in the
[metadata and security fixture](../cli/examples/documentation/metadata-security.ts).

## Write a minimal plugin

```ts
import { definePlugin, PluginExecutionError, type Plugin } from "@rexeus/typeweaver-gen";
import { Effect } from "effect";

export const summaryPlugin: Plugin = definePlugin({
  name: "summary",
  generate: context =>
    Effect.try({
      try: () => {
        const lines = context.normalizedSpec.resources.map(
          resource => `- ${resource.name}: ${resource.operations.length} operations`
        );

        context.writeFile("summary.md", `${lines.join("\n")}\n`);
      },
      catch: cause =>
        new PluginExecutionError({
          pluginName: "summary",
          phase: "generate",
          cause,
        }),
    }),
});

export default summaryPlugin;
```

<!-- docs-example: minimal-plugin -->

The public plugin shape, typed error channel, and path-safe writer are checked in the
[minimal plugin fixture](../cli/examples/documentation/minimal-plugin.ts).

Lifecycle hooks return `Effect` values with a typed `PluginExecutionError` channel. Convert
synchronous throws with `Effect.try`; the orchestrator does not silently turn defects into
successful generation.

## Lifecycle

```ts
type Plugin = {
  readonly name: string;
  readonly depends?: readonly string[];
  readonly validate?: (
    normalizedSpec: NormalizedSpec,
    context: PluginValidationContext
  ) => Effect.Effect<readonly Issue[], PluginExecutionError>;
  readonly initialize?: (context: PluginContext) => Effect.Effect<void, PluginExecutionError>;
  readonly collectResources?: (
    normalizedSpec: NormalizedSpec
  ) => Effect.Effect<NormalizedSpec, PluginExecutionError>;
  readonly generate?: (context: GeneratorContext) => Effect.Effect<void, PluginExecutionError>;
  readonly finalize?: (context: PluginContext) => Effect.Effect<void, PluginExecutionError>;
};
```

| Hook               | Purpose                                                  | Generator writer available? |
| ------------------ | -------------------------------------------------------- | --------------------------- |
| `validate`         | report stable, structured, projection-specific issues    | no                          |
| `initialize`       | prepare plugin state after paths and config are resolved | no                          |
| `collectResources` | derive or transform the normalized model before emission | no                          |
| `generate`         | emit files from the final normalized model               | yes                         |
| `finalize`         | clean up or summarize after all plugins generated        | no                          |

Only `generate` receives `GeneratorContext` and its path-safe writer. `initialize` and `finalize`
receive the smaller `PluginContext`; avoid bypassing the generated-file lifecycle with direct
filesystem writes.

`depends` defines topological ordering for every lifecycle stage. A plugin with `depends: ["types"]`
runs after `types` in that stage.

A typed `PluginExecutionError` returned by `finalize` is logged as a best-effort warning after
generation. Defects and interruption are not downgraded: TypeWeaver still attempts every remaining
finalizer in reverse order, then fails the lifecycle with the accumulated cause.

## Validation must remain side-effect-free

`PluginValidationContext` intentionally exposes only the input directory and read-only user
configuration. It has no output directory, file writer, template renderer, or generated-file
tracker.

Return issues instead of logging ad-hoc text:

```ts
import { Effect } from "effect";
import { definePlugin } from "@rexeus/typeweaver-gen";

export default definePlugin({
  name: "operation-budget",
  validate: spec =>
    Effect.succeed(
      spec.resources.flatMap((resource, resourceIndex) =>
        resource.operations.length > 20
          ? [
              {
                code: "TW-PLUGIN-OPERATION-BUDGET-001",
                severity: "warning",
                message: `${resource.name} contains more than 20 operations.`,
                path: `/resources/${resourceIndex}`,
                fixable: false,
              },
            ]
          : []
      )
    ),
});
```

Stable issue codes let CI, IDEs, and future tooling react without parsing human prose.

## Emit files through the context

Prefer `context.writeFile()` over direct filesystem writes. The public context:

- rejects output paths that escape the configured directory;
- tracks generated files;
- publishes through the orchestrator's file lifecycle;
- exposes resource-aware output helpers;
- renders templates through the configured renderer.

A plugin that ships static runtime support can use `definePluginWithLibCopy`:

```ts
import path from "node:path";
import { fileURLToPath } from "node:url";
import { definePluginWithLibCopy, type Plugin } from "@rexeus/typeweaver-gen";
import { generate } from "./generator.js";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));

export const widgetPlugin: Plugin = definePluginWithLibCopy({
  name: "widget",
  depends: ["types"],
  libSourceDir: path.join(moduleDir, "lib"),
  generators: [generate],
});
```

The library is copied to `output/lib/widget/` and emitted files can import it through generated
paths.

## Factory plugins and configuration

A plugin may export a factory when users need projection-specific options. The CLI resolves a
configured tuple such as:

```js
export default {
  input: "./api/spec/index.ts",
  output: "./api/generated",
  plugins: [["widget", { mode: "compact" }]],
};
```

Keep user options narrow, validate them early, and preserve the distinction between product-wide
config and projection-owned config.

## Scoped Effect services

Use `defineScopedPlugin` when a plugin needs an Effect `Layer` with acquisition and release.
TypeWeaver acquires one scope per generation call, provides it to lifecycle hooks, isolates
concurrent runs that share the same plugin value, and releases it after success, typed failure,
defect, or interruption.

This is the preferred model for resources such as temporary directories, caches, connections, or
plugin-owned tracing services.

## Test the public lifecycle in memory

`createPluginTestKit` runs a plugin without importing CLI internals:

```ts
import { createPluginTestKit, definePlugin, type NormalizedSpec } from "@rexeus/typeweaver-gen";
import { Effect } from "effect";

const plugin = definePlugin({
  name: "hello",
  generate: context => Effect.sync(() => context.writeFile("hello.txt", "hello\n")),
});

const normalizedSpec: NormalizedSpec = {
  metadata: { title: "Plugin Fixture API", version: "1.0.0" },
  securitySchemes: [],
  security: { requirements: [], source: "none" },
  resources: [],
  responses: [],
  warnings: [],
};

const kit = createPluginTestKit({ normalizedSpec });
const result = await Effect.runPromise(kit.run(plugin));

expect(result.issues).toEqual([]);
expect(result.generatedFiles).toContain("/typeweaver/plugin-test/output/hello.txt");
expect(result.files.find(file => file.path.endsWith("/hello.txt"))?.content).toBe("hello\n");
```

<!-- docs-example: plugin-test-kit -->

The in-memory lifecycle and scoped-service path are typechecked in the
[plugin test-kit fixture](../cli/examples/documentation/plugin-test-kit.ts).

The test result exposes issues, paths, file contents, the final normalized spec, and best-effort
finalizer failures. Focused context builders are available for individual hook tests.

## Public surface

The package exports:

- plugin constructors: `definePlugin`, `defineScopedPlugin`, and `definePluginWithLibCopy`;
- plugin and factory types;
- lifecycle contexts and normalized model types;
- `Issue`, the `Severity` type, issue registries, and normalization-to-issue helpers;
- tagged plugin, dependency, and path-safety errors;
- `createPluginTestKit` and inspectable in-memory output types;
- orchestration services used by the CLI;
- `TypeweaverConfig` for JavaScript-config JSDoc annotations.

## Boundaries

A plugin should not:

- mutate the user's source contract;
- write during validation;
- bypass output path safety;
- duplicate normalization rules privately;
- hide representational loss;
- require CLI internals for tests;
- combine unrelated projections merely because they share a package.

## Related documentation

- [Migration guide](../../MIGRATION.md)
- [Full plugin-authoring guide](../../docs/plugin-authoring.md)
- [CLI reference](../cli/README.md)
- [Contract authoring](../core/README.md)
- [Vision](../../VISION.md)

## License

Apache 2.0 © Dennis Wentzien 2026
