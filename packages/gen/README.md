# @rexeus/typeweaver-gen

Code generation engine and utilities for TypeWeaver plugins.

## Overview

This package provides the plugin architecture and utilities that power TypeWeaver's extensible code
generation system. It includes base classes, context utilities, and the plugin registry system.

## Installation

```bash
npm install @rexeus/typeweaver-gen
```

**Peer Dependencies:**

```bash
npm install @rexeus/typeweaver-core
```

## Plugin Architecture

### Creating a Plugin

```typescript
import { BasePlugin, type GeneratorContext } from "@rexeus/typeweaver-gen";

export default class MyPlugin extends BasePlugin {
  public name = "my-plugin";

  public override generate(context: GeneratorContext): Promise<void> | void {
    // Your generation logic here
    const content = context.renderTemplate(templatePath, templateData);
    context.writeFile("relative/path/to/output.ts", content);
    context.addGeneratedFile("relative/path/to/output.ts");
  }
}
```

### Plugin Context

The `GeneratorContext` provides utilities for code generation:

```typescript
interface GeneratorContext {
  // Input/output directories
  outputDir: string;
  inputDir: string;
  templateDir: string;
  coreDir: string;

  // Resource data
  resources: GetResourcesResult;

  // Configuration
  config: PluginConfig;

  // Utility functions
  writeFile: (relativePath: string, content: string) => void;
  renderTemplate: (templatePath: string, data: unknown) => string;
  addGeneratedFile: (relativePath: string) => void;
  getGeneratedFiles: () => string[];
}
```

### Utility Functions

#### `writeFile(relativePath, content)`

Writes files relative to the output directory with automatic directory creation:

```typescript
context.writeFile("users/UserClient.ts", generatedClientCode);
```

#### `renderTemplate(templatePath, data)`

Renders EJS templates with provided data:

```typescript
const content = context.renderTemplate(path.join(__dirname, "templates", "Client.ejs"), {
  entityName,
  operations,
  coreDir: context.coreDir,
});
```

#### `addGeneratedFile(relativePath)`

Tracks generated files (automatically called by `writeFile`):

```typescript
context.addGeneratedFile("users/UserClient.ts");
```

## Resource System

The resource system provides structured access to API definitions:

### Resource Types

```typescript
interface GetResourcesResult {
  entityResources: Record<string, OperationResource[]>;
  sharedResponseResources: SharedResponseResource[];
}

interface OperationResource {
  entityName: string;
  definition: HttpOperationDefinition;
  outputDir: string;
  outputRequestFile: string;
  outputResponseFile: string;
  outputRequestValidationFile: string;
  outputResponseValidationFile: string;
  // ... more output file paths
}

interface SharedResponseResource {
  name: string;
  definition: HttpResponseDefinition;
  outputDir: string;
  outputFileName: string;
  outputFile: string;
}
```

### Using Resources

```typescript
export default class MyPlugin extends BasePlugin {
  public name = "my-plugin";

  public override generate(context: GeneratorContext): void {
    // Iterate through entities
    for (const [entityName, operations] of Object.entries(context.resources.entityResources)) {
      // Generate entity-level code
      this.generateEntityCode(entityName, operations, context);

      // Generate operation-level code
      for (const operation of operations) {
        this.generateOperationCode(operation, context);
      }
    }

    // Use shared responses
    for (const sharedResponse of context.resources.sharedResponseResources) {
      this.generateSharedResponse(sharedResponse, context);
    }
  }
}
```

## Template System

### Template Structure

Templates should be placed in a `templates/` directory within your plugin:

```
my-plugin/
├── src/
│   ├── index.ts
│   ├── MyGenerator.ts
│   └── templates/
│       ├── Client.ejs
│       └── Router.ejs
└── package.json
```

### Template Usage

Templates receive context data and can use EJS syntax:

```ejs
<%# templates/Client.ejs %>
import { ApiClient } from "<%= coreDir %>";

export class <%= pascalCaseEntityName %>Client extends ApiClient {
  <% for (const operation of operations) { %>
  public <%= operation.operationId %>() {
    // Generated method
  }
  <% } %>
}
```

## Plugin Lifecycle

### Lifecycle Hooks

```typescript
interface TypeWeaverPlugin {
  /**
   * Initialize the plugin
   * Called before any generation happens
   */
  initialize?(context: PluginContext): Promise<void> | void;

  /**
   * Collect and transform resources
   * Allows plugins to modify the resource collection
   */
  collectResources?(
    resources: GetResourcesResult
  ): Promise<GetResourcesResult> | GetResourcesResult;

  /**
   * Main generation logic
   * Called with all resources and utilities
   */
  generate?(context: GeneratorContext): Promise<void> | void;

  /**
   * Finalize the plugin
   * Called after all generation is complete
   */
  finalize?(context: PluginContext): Promise<void> | void;
}
```

## Built-in Plugins

TypeWeaver includes several built-in plugins:

- **@rexeus/typeweaver-types** - TypeScript types and Zod validators
- **@rexeus/typeweaver-clients** - HTTP API clients
- **@rexeus/typeweaver-aws-cdk** - AWS CDK constructs and HTTP API routers

## Best Practices

### File Organization

- Use consistent naming patterns for generated files
- Organize output by entity or feature
- Include proper imports and exports

### Template Design

- Keep templates focused and modular
- Use consistent variable naming
- Include proper TypeScript types in generated code

### Error Handling

- Validate input data before generation
- Provide clear error messages
- Handle edge cases gracefully

```typescript
export default class MyPlugin extends BasePlugin {
  public name = "my-plugin";

  public override generate(context: GeneratorContext): void {
    try {
      // Generation logic
    } catch (error) {
      throw new Error(`Plugin ${this.name} failed: ${error.message}`);
    }
  }
}
```

## License

Apache 2.0 © Dennis Wentzien 2025
