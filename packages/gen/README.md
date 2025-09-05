# 🧵✨ @rexeus/typeweaver-gen

[![npm version](https://img.shields.io/npm/v/@rexeus/typeweaver-gen.svg)](https://www.npmjs.com/package/@rexeus/typeweaver-gen)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)

Typeweaver is a type-safe HTTP API framework built for API-first development with a focus on
developer experience. Use typeweaver to specify your HTTP APIs in TypeScript and Zod, and generate
clients, validators, routers, and more ✨

## 📝 Generation Package

Provides the core components for generating code with typeweaver. This package forms the basis for
all plugins.

---

## 📥 Installation

```bash
npm install -D @rexeus/typeweaver-gen
```

## 💡 How to use

Most users don’t depend on this package directly — use the CLI instead:
[`@rexeus/typeweaver`](../cli/README.md). If you’re writing a plugin, start here.

### 🚀 Minimal plugin

```ts
import { BasePlugin, type GeneratorContext } from "@rexeus/typeweaver-gen";

export default class MyPlugin extends BasePlugin {
  // Give your plugin a unique name
  name = "my-plugin";

  // Use the generate phase to render templates and write files
  async generate(context: GeneratorContext) {
    for (const [entity, { operations }] of Object.entries(context.resources.entityResources)) {
      const content = context.renderTemplate("Entity.ejs", {
        entity,
        operations,
        coreDir: context.coreDir,
      });
      context.writeFile(`${entity}/${entity}Stuff.ts`, content);
    }
  }
}
```

Templates live under your plugin’s `src/templates`. They receive your data object as EJS locals.

## 🔧 What it provides

- Base classes: `BasePlugin`, `BaseTemplatePlugin` for lifecycle defaults, EJS helpers, and lib
  copying.
- Types & contexts: `TypeweaverPlugin`, `PluginContext`, `GeneratorContext` with `writeFile`,
  `renderTemplate`, and file tracking.
- Registry: `PluginRegistry` to register and query plugins; the CLI orchestrates lifecycle
  execution.
- Resource model: `GetResourcesResult`, `EntityResources`, representing the normalized API data
  derived from your definition.

## 🔌 Plugin lifecycle

The lifecycle keeps concerns separated and makes it easy to compose multiple plugins. Implement only
what you need.

```ts
type TypeweaverPlugin = {
  name: string;
  initialize?(context: PluginContext): void | Promise<void>;
  collectResources?(
    resources: GetResourcesResult
  ): GetResourcesResult | Promise<GetResourcesResult>;
  generate?(context: GeneratorContext): void | Promise<void>;
  finalize?(context: PluginContext): void | Promise<void>;
};
```

- Initialize phase (`initialize`): Load and validate plugin configuration, check prerequisites.
- Collect Resources phase (`collectResources`): Inspect the normalized API model; derive or enrich
  metadata (naming, groupings), filter or reorder resources, and share derived artifacts across
  plugins if needed.
- Generate phase (`generate`): Render templates and emit code using `context.writeFile` (tracked);
  copy or produce any runtime libraries required by the generated code.
- Finalize phase (`finalize`): Post-process outputs, clean stale generated files, and perform final
  organization steps.

## 🧰 Generator context

The `GeneratorContext` describes the generation phase: it provides access to resolved paths,
configuration, the normalized resources, and helper methods for safe file emission and templating.
You receive it only inside the `generate` lifecycle method.

```ts
type GeneratorContext = {
  inputDir: string;
  outputDir: string;
  templateDir: string;
  coreDir: string;
  config: PluginConfig;
  resources: GetResourcesResult;
  writeFile(rel: string, content: string): void; // mkdir -p + write + track
  // Tracked files are automatically exported via a generated barrel index.ts
  renderTemplate(tplPath: string, data: unknown): string; // EJS render
  addGeneratedFile(rel: string): void; // track only
  getGeneratedFiles(): string[]; // list tracked files
};
```

### 📦 Shipping runtime helpers

Sometimes your generated code needs small reusable runtime pieces (e.g., abstract classes, adapters,
validators, utils etc.). Ship them with your plugin and copy them into the consumer’s generated
output.

- Where to put them: Place TypeScript files under your plugin’s `src/lib`. They will compile to
  `dist/lib` when you build the plugin.
- Copy them:

  ```ts
  import path from "path";
  import { fileURLToPath } from "url";
  import { BasePlugin, type GeneratorContext } from "@rexeus/typeweaver-gen";

  // Needed to resolve __dirname in ES modules
  const __dirname = path.dirname(fileURLToPath(import.meta.url));

  export default class MyPlugin extends BasePlugin {
    name = "my-plugin";

    generate(context: GeneratorContext) {
      const libSourceDir = path.join(__dirname, "lib");
      this.copyLibFiles(context, libSourceDir, this.name); // -> <output>/lib/my-plugin
    }
  }
  ```

## 📌 Notes

- Plugins are configured/executed by the CLI (`@rexeus/typeweaver`). See the CLI options
  [here](../cli/README.md#️-options).
- Keep plugins focused: one concern per plugin (clients, routers, infra).
- Prefer `GeneratorContext.writeFile` over manual fs writes for tracking and directory setup.

## 📄 License

Apache 2.0 © Dennis Wentzien 2025
