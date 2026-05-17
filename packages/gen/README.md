# 🧵✨ @rexeus/typeweaver-gen

[![npm version](https://img.shields.io/npm/v/@rexeus/typeweaver-gen.svg)](https://www.npmjs.com/package/@rexeus/typeweaver-gen)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)

Typeweaver is a type-safe HTTP API framework built for API-first development with a focus on
developer experience. Use typeweaver to specify your HTTP APIs in TypeScript and Zod, and generate
clients, validators, routers, and more ✨

## 📝 Generation Package

Core building blocks for authoring typeweaver plugins: the `Plugin` type, the `definePlugin` and
`definePluginWithLibCopy` constructors, the normalized resource model, and the lifecycle context
types consumed by the CLI orchestrator.

---

## 📥 Installation

```bash
npm install -D @rexeus/typeweaver-gen effect
```

`effect` is a peer dependency — match the CLI's version (`^3.21.x`).

## 💡 How to use

Most users don't depend on this package directly — use the CLI instead:
[`@rexeus/typeweaver`](https://github.com/rexeus/typeweaver/tree/main/packages/cli/README.md). If
you're writing a plugin, start here.

### 🚀 Minimal plugin

A plugin is a value returned from `definePlugin(...)`. Each lifecycle stage returns an `Effect`
whose error channel is narrowed to `PluginExecutionError`. The orchestrator does not catch raw
throws — wrap synchronous emission in `Effect.try` so thrown exceptions become typed failures:

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

### 📦 Emit-and-copy plugins

When a plugin ships static runtime support code under `src/lib/`, use `definePluginWithLibCopy`. It
copies the lib directory into `output/lib/{pluginName}/` and runs one or more synchronous emitter
functions inside a shared `Effect.try` boundary:

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

## 🔌 Plugin lifecycle

The orchestrator runs four optional stages once per `typeweaver generate` invocation:

```ts
type Plugin = {
  readonly name: string;
  readonly depends?: readonly string[];
  readonly initialize?: (ctx: PluginContext) => Effect.Effect<void, PluginExecutionError>;
  readonly collectResources?: (
    spec: NormalizedSpec
  ) => Effect.Effect<NormalizedSpec, PluginExecutionError>;
  readonly generate?: (ctx: GeneratorContext) => Effect.Effect<void, PluginExecutionError>;
  readonly finalize?: (ctx: PluginContext) => Effect.Effect<void, PluginExecutionError>;
};
```

| Stage              | When                                         | Use it for                                                      |
| ------------------ | -------------------------------------------- | --------------------------------------------------------------- |
| `initialize`       | After plugin discovery, before normalization | Setup that needs the resolved output directory but not the spec |
| `collectResources` | After normalization, before emission         | Transforming the normalized spec (e.g. injecting derived ops)   |
| `generate`         | Once the spec is final                       | Writing files via `context.writeFile`                           |
| `finalize`         | After every plugin has generated             | Post-processing, summary output                                 |

`depends` declares a topological ordering: a plugin with `depends: ["types"]` will not run a stage
until `types`'s same stage has completed.

## 🔧 What it exports

- **Plugin authoring:** `definePlugin`, `definePluginWithLibCopy`, `copyPluginLibFiles`, the
  `Plugin` type.
- **Lifecycle contexts:** `PluginContext`, `GeneratorContext` — the records passed to each stage,
  with helpers for `writeFile`, `renderTemplate`, `addGeneratedFile`, and per-resource path
  resolution.
- **Tagged errors:** `PluginExecutionError`, `PluginDependencyError`, `UnsafeGeneratedPathError` —
  raised at the plugin boundary and the orchestrator.
- **Normalized resource model:** `NormalizedSpec`, `NormalizedResource`, `NormalizedOperation`,
  `NormalizedResponse`, `NormalizedResponseUsage` — the validated API model delivered to plugins.
- **Services:** `PluginRegistry`, `TemplateRenderer`, `PathSafety`, `ContextBuilder` — composed by
  the CLI runtime; plugin authors rarely need to reference them directly.

## 📚 Authoring a plugin

The README covers the minimum surface. For the full guide — `GeneratorContext` helpers, factory
plugins with options, higher-order constructors that resolve services at composition time, lib-copy
internals, the `depends` ordering rules, and a testable fake-context pattern — see
[`docs/plugin-authoring.md`](https://github.com/rexeus/typeweaver/tree/main/docs/plugin-authoring.md).

Background reading on the API shape:

- [ADR 0003: Effect-native plugin API](https://github.com/rexeus/typeweaver/tree/main/docs/adr/0003-effect-native-plugin-api.md)
- [ADR 0004: FileSystem service adoption](https://github.com/rexeus/typeweaver/tree/main/docs/adr/0004-filesystem-service-adoption.md)
- [ADR 0007: Generator per-call isolation](https://github.com/rexeus/typeweaver/tree/main/docs/adr/0007-generator-per-call-isolation.md)

### 🏷️ Spec naming validation

The normalization pipeline validates supported naming formats before generation:

- `operationId` should use camelCase (preferred), for example `getUser`.
- PascalCase `operationId` values are supported for compatibility.
- snake_case and kebab-case `operationId` values are rejected during normalization.
- `resourceName` should preferably be a singular noun in camelCase, for example `user` or
  `authSession`.
- Plural and PascalCase `resourceName` values are supported.
- snake_case and kebab-case `resourceName` values are rejected during normalization.

## 📌 Notes

- Plugins are configured and executed by the CLI (`@rexeus/typeweaver`). See the CLI options
  [here](https://github.com/rexeus/typeweaver/tree/main/packages/cli/README.md#️-options).
- Keep plugins focused: one concern per plugin (clients, routers, infra).
- Prefer `GeneratorContext.writeFile` over manual `fs` writes — it routes through the path-safety
  guard, registers paths with the tracker, and uses an atomic temp-file + rename.

## 📄 License

Apache 2.0 © Dennis Wentzien 2026
