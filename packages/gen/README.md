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
[`@rexeus/typeweaver`](https://github.com/rexeus/typeweaver/tree/main/packages/cli/README.md). If
you’re writing a plugin, start here.

### 🚀 Minimal plugin

```ts
import { BasePlugin, type GeneratorContext } from "@rexeus/typeweaver-gen";

export class MyPlugin extends BasePlugin {
  // Give your plugin a unique name
  name = "my-plugin";

  // Use the generate phase to render templates and write files
  async generate(context: GeneratorContext) {
    for (const resource of context.normalizedSpec.resources) {
      const content = context.renderTemplate("Entity.ejs", {
        resource,
        operations: resource.operations,
        coreDir: context.coreDir,
      });
      context.writeFile(`${resource.name}/${resource.name}Stuff.ts`, content);
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
- Resource model: `NormalizedSpec`, `NormalizedResource`, `NormalizedOperation`,
  `NormalizedResponse`, and `NormalizedResponseUsage`, representing the normalized API data derived
  from your spec entrypoint.

## 🔌 Plugin lifecycle

The lifecycle keeps concerns separated and makes it easy to compose multiple plugins. Implement only
what you need.

```ts
type TypeweaverPlugin = {
  name: string;
  initialize?(context: PluginContext): Promise<void> | void;
  collectResources?(normalizedSpec: NormalizedSpec): Promise<NormalizedSpec> | NormalizedSpec;
  generate?(context: GeneratorContext): Promise<void> | void;
  finalize?(context: PluginContext): Promise<void> | void;
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

The `GeneratorContext` is passed to your plugin's `generate` method. It gives you everything you
need to emit files: the normalized spec, resolved paths, and helpers for imports, templates, and
file tracking.

### Properties

| Property             | Description                                                                                                                                    |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `normalizedSpec`     | The fully validated and normalized API spec — resources, operations, and responses ready for generation.                                       |
| `templateDir`        | Absolute path to your plugin's compiled EJS templates (`dist/templates/`). Pass template names relative to this directory to `renderTemplate`. |
| `coreDir`            | The import specifier for `@rexeus/typeweaver-core` — use in templates so generated code imports core types correctly.                          |
| `responsesOutputDir` | Absolute path to the shared `responses/` output directory where canonical response files are written.                                          |
| `specOutputDir`      | Absolute path to the `spec/` output directory containing the bundled spec and shim files.                                                      |

### Methods

| Method                                                          | Description                                                                                              |
| --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `getCanonicalResponse(name)`                                    | Look up a canonical (shared) response by name. Throws if the response does not exist.                    |
| `getCanonicalResponseOutputFile(name)`                          | Get the absolute output file path for a canonical response.                                              |
| `getCanonicalResponseImportPath({ importerDir, responseName })` | Compute the relative import path from a generated file to a canonical response file.                     |
| `getSpecImportPath({ importerDir })`                            | Compute the relative import path from a generated `spec.ts` consumer to the bundled spec shim.           |
| `getOperationOutputPaths({ resourceName, operationId })`        | Get all output file paths for a given operation (request, response, validators, etc.).                   |
| `getResourceOutputDir(name)`                                    | Get the absolute output directory for a resource (e.g. `<output>/todo/`).                                |
| `writeFile(rel, content)`                                       | Write a file relative to the output root. Creates directories as needed and tracks the file for cleanup. |
| `renderTemplate(tplPath, data)`                                 | Render an EJS template from `templateDir` with the given data object. Returns the rendered string.       |
| `addGeneratedFile(rel)`                                         | Mark a file as generated (for tracking) without writing it. Useful when another tool produces the file.  |
| `getGeneratedFiles()`                                           | List all file paths tracked during this generation run.                                                  |

### Example: using the context in a plugin

```ts
async generate(context: GeneratorContext) {
  for (const resource of context.normalizedSpec.resources) {
    const outputDir = context.getResourceOutputDir(resource.name);

    for (const operation of resource.operations) {
      // Render a template with operation data
      const content = context.renderTemplate("MyTemplate.ejs", {
        coreDir: context.coreDir,
        operation,
      });

      // Write the result — directories are created automatically
      context.writeFile(`${resource.name}/${operation.operationId}Custom.ts`, content);
    }
  }
}
```

### 📦 Shipping runtime helpers

Sometimes your generated code needs small reusable runtime pieces (e.g., abstract classes, adapters,
validators, utils etc.). Ship them with your plugin and copy them into the consumer’s generated
output.

- Where to put them: Place TypeScript files under your plugin’s `src/lib`. They will compile to
  `dist/lib` when you build the plugin.
- Copy them:

  ```ts
  import path from "node:path";
  import { fileURLToPath } from "node:url";
  import { BasePlugin, type GeneratorContext } from "@rexeus/typeweaver-gen";

  // Resolve the directory of the current module
  const moduleDir = path.dirname(fileURLToPath(import.meta.url));

  export class MyPlugin extends BasePlugin {
    name = "my-plugin";

    generate(context: GeneratorContext) {
      const libSourceDir = path.join(moduleDir, "lib");
      this.copyLibFiles(context, libSourceDir, this.name); // -> <output>/lib/my-plugin
    }
  }
  ```

## 📌 Notes

- Plugins are configured and executed by the CLI (`@rexeus/typeweaver`). See the CLI options
  [here](https://github.com/rexeus/typeweaver/tree/main/packages/cli/README.md#️-options).
- Keep plugins focused: one concern per plugin (clients, routers, infra).
- Prefer `GeneratorContext.writeFile` over manual fs writes for tracking and directory setup.

## 📄 License

Apache 2.0 © Dennis Wentzien 2026
