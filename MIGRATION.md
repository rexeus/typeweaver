# TypeWeaver Migration Guide

This document covers all breaking changes and required migration steps across major TypeWeaver
releases.

---

## Table of Contents

- [Migrating from 0.12.x to 0.13.x](#migrating-from-012x-to-013x)
- [Migrating from 0.7.x to 0.8.x](#migrating-from-07x-to-08x)
- [Migrating from 0.8.x to 0.9.x](#migrating-from-08x-to-09x)

---

## Migrating from 0.12.x to 0.13.x

Version 0.13.0 completes the migration to **Effect** as typeweaver's runtime foundation. The change
is internal-architectural but breaks two surfaces:

1. The **plugin API** (V1 class-based → V2 Effect-native records). Affects anyone who built a custom
   plugin.
2. The **CLI surface** (now built on `@effect/cli`). Affects scripts that parsed CLI output or
   relied on the previous error format.

The **spec authoring API** (`defineSpec` / `defineOperation` / `defineResponse`) is **unchanged**.
Existing specs and Zod schemas keep working byte-for-byte.

### 1. Plugin API V1 → V2 (BREAKING — third-party plugin authors)

The V1 class hierarchy is gone:

- `BasePlugin` is deleted. Class-based plugins no longer load.
- `TypeweaverPlugin`, `createPluginRegistry`, and `legacyAdapter` are deleted.
  `createPluginContextBuilder` was preserved as a `services/internal/` implementation detail backing
  the `ContextBuilder` service; it is no longer part of the package's public API.
- Plugins are now records returned by `definePlugin(...)`. Lifecycle stages return
  `Effect<void, PluginExecutionError>` instead of `Promise<void> | void`.
- Plugin `finalize` failures now surface as WARN logs instead of failing the run. If your plugin
  runs hard-fail work in finalize, move it to `generate`.

**Before (0.12.x) — class-based plugin:**

```ts
import { BasePlugin } from "@rexeus/typeweaver-gen";
import type { GeneratorContext } from "@rexeus/typeweaver-gen";
import { generate as generateRequests } from "./requestGenerator.js";

export class TypesPlugin extends BasePlugin {
  public override readonly name = "types";

  public override async generate(context: GeneratorContext): Promise<void> {
    await this.copyLibFiles(context, "./lib");
    generateRequests(context);
  }
}
```

**After (0.13.x) — V2 plugin:**

```ts
import path from "node:path";
import { fileURLToPath } from "node:url";
import { definePluginWithLibCopy } from "@rexeus/typeweaver-gen";
import type { Plugin } from "@rexeus/typeweaver-gen";
import { generate as generateRequests } from "./requestGenerator.js";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));

export const typesPlugin: Plugin = definePluginWithLibCopy({
  name: "types",
  libSourceDir: path.join(moduleDir, "lib"),
  generators: [generateRequests],
});

export default typesPlugin;
```

Plugin packages must declare `effect ^3.21.x` as a `peerDependency`:

```json
{
  "peerDependencies": {
    "@rexeus/typeweaver-gen": "workspace:^",
    "effect": "^3.21.2"
  }
}
```

`GeneratorContext.writeFile`, `renderTemplate`, and `addGeneratedFile` remain synchronous. Plugin
authors wrap their sync work in `Effect.try` and map thrown causes to `PluginExecutionError` — the
orchestrator does **not** catch raw throws. See
[`docs/plugin-authoring.md`](./docs/plugin-authoring.md) for the full V2 contract and
[ADR 0003](./docs/adr/0003-effect-native-plugin-api.md) for the design rationale.

### 2. CLI on `@effect/cli` (BREAKING for invocation in scripts)

The CLI is now built on `@effect/cli`. Three observable changes:

- **Help output** differs from the previous commander-based format. Flag names and exit codes are
  preserved; the visual layout is new.
- **Error messages** are now formatted via `formatErrorForCli`. A failure prints a single
  user-facing line like
  `Failed to bundle spec entrypoint '/path/to/spec.ts': Cannot find module '...'` instead of a
  multi-line FiberFailure stack trace. Scripts that grepped the previous error text will need to
  update their patterns.
- **Log lines** drop timestamps and fiber identifiers. Info-level lines go to stdout; `[WARN]` and
  `[ERROR]` lines go to stderr.

CLI **flags and exit codes are unchanged**:

```bash
# Same as 0.12.x
npx typeweaver generate \
  --input ./api/spec/index.ts \
  --output ./api/generated \
  --plugins clients,hono \
  --format \
  --clean
```

See [ADR 0006](./docs/adr/0006-cli-error-and-log-formatting.md) for the formatting pipeline.

### 3. Internal API changes (informational; only programmatic consumers)

If you imported the generator programmatically rather than through the CLI:

- The imperative `Generator` class is replaced by an `Effect.Service` that lives inside a
  `ManagedRuntime`. Construct via the runtime, not via `new Generator()`. See
  `packages/cli/src/effectRuntime.ts` and
  [ADR 0007](./docs/adr/0007-generator-per-call-isolation.md).
- `createPluginRegistry` is deleted; the runtime composes the equivalent service.
  `createPluginContextBuilder` is no longer exported — it lives under `services/internal/` as
  implementation detail of the `ContextBuilder` service.
- Errors are now `Data.TaggedError` instances throughout. Inspect the `_tag` field for typed
  branching (`UnsafeGeneratedPathError`, `PluginExecutionError`, `SpecBundleError`, etc.).

### 4. Spec authoring API: UNCHANGED

The functional spec API introduced in 0.9.0 is unchanged in 0.13.0:

- `defineSpec({ resources: { ... } })`
- `defineOperation({ ... })`
- `defineResponse({ ... })`
- `defineDerivedResponse(base, overrides)`

Zod schemas continue to be authored the same way. Generated output for the shipped first-party
plugins is **byte-identical** to 0.12.x — the `test-utils/src/test-project/output` golden fixture
verifies this on every build.

### 5. Migration Checklist (0.12.x to 0.13.x)

For **end users** (you use the CLI but don't author plugins):

- [ ] Update any scripts that parsed the previous CLI error format.
- [ ] Update any scripts that parsed log lines (timestamps and fiber tags are gone).
- [ ] Regenerate output with `npx typeweaver generate`. Output is byte-stable so this is a no-op for
      clean working trees — but it confirms the new CLI runs against your spec.

For **plugin authors**:

- [ ] Replace `extends BasePlugin` with `definePlugin(...)` or `definePluginWithLibCopy(...)`.
- [ ] Wrap sync emitter bodies in `Effect.try` with `PluginExecutionError` mapping (or use
      `definePluginWithLibCopy`, which does it for you).
- [ ] Declare `effect ^3.21.x` as a `peerDependency`.
- [ ] Run plugin tests through `Effect.runSync(plugin.generate(context))` against a fake context
      (see [`docs/plugin-authoring.md`](./docs/plugin-authoring.md) for the pattern).
- [ ] Verify your plugin is discoverable: a named export matching the plugin name, a default export
      of a `Plugin` record, or a default export of a `(options?) => Plugin` factory.

### Further reading

- [ADR 0003: Effect-native plugin API (V2)](./docs/adr/0003-effect-native-plugin-api.md)
- [ADR 0004: FileSystem service adoption strategy](./docs/adr/0004-filesystem-service-adoption.md)
- [ADR 0005: Effect.Service patterns (succeed vs effect)](./docs/adr/0005-effect-service-patterns.md)
- [ADR 0006: CLI error and log formatting](./docs/adr/0006-cli-error-and-log-formatting.md)
- [ADR 0007: Generator per-call isolation](./docs/adr/0007-generator-per-call-isolation.md)
- [Plugin authoring guide](./docs/plugin-authoring.md)

---

## Migrating from 0.7.x to 0.8.x

Version 0.8.0 replaces **class-based responses** with **plain objects** that use a `type`
discriminator field. This eliminates `instanceof` checks across the entire runtime and makes
responses serializable, testable, and structurally type-safe.

### 1. Generated Responses: Classes to Plain Objects

Every generated response was previously a class extending `HttpResponse`. Now it is a plain
`ITypedHttpResponse` type with a factory function.

**Before (0.7.x) — Class-based response:**

```ts
// Generated: CreateTodoResponse.ts
import { HttpResponse, HttpStatusCode } from "@rexeus/typeweaver-core";

export type ICreateTodoSuccessResponse = {
  statusCode: HttpStatusCode.CREATED;
  header: ICreateTodoSuccessResponseHeader;
  body: ICreateTodoSuccessResponseBody;
};

export class CreateTodoSuccessResponse
  extends HttpResponse<ICreateTodoSuccessResponseHeader, ICreateTodoSuccessResponseBody>
  implements ICreateTodoSuccessResponse
{
  public override readonly statusCode = HttpStatusCode.CREATED;

  public constructor(response: Omit<ICreateTodoSuccessResponse, "statusCode">) {
    super(HttpStatusCode.CREATED, response.header, response.body);
  }
}
```

**After (0.8.x) — Typed plain object with factory:**

```ts
// Generated: CreateTodoSuccessResponse.ts
import { HttpStatusCode } from "@rexeus/typeweaver-core";
import type { ITypedHttpResponse } from "@rexeus/typeweaver-core";

export type ICreateTodoSuccessResponse = ITypedHttpResponse<
  "CreateTodoSuccess",
  HttpStatusCode.CREATED,
  ICreateTodoSuccessResponseHeader,
  ICreateTodoSuccessResponseBody
>;

export const createCreateTodoSuccessResponse = (
  input: Omit<ICreateTodoSuccessResponse, "type" | "statusCode">
): ICreateTodoSuccessResponse => ({
  ...input,
  type: "CreateTodoSuccess",
  statusCode: HttpStatusCode.CREATED,
});
```

### 2. Creating Responses: `new` to Factory Functions

Replace all `new XxxResponse(...)` calls with `createXxxResponse(...)` factory calls.

**Before (0.7.x):**

```ts
import { CreateTodoSuccessResponse } from "./generated/todo/CreateTodoResponse";

const response = new CreateTodoSuccessResponse({
  header: { "Content-Type": "application/json" },
  body: { id: "123", title: "My Todo", ... },
});
```

**After (0.8.x):**

```ts
import { createCreateTodoSuccessResponse } from "./generated/responses/CreateTodoSuccessResponse";

const response = createCreateTodoSuccessResponse({
  header: { "Content-Type": "application/json" },
  body: { id: "123", title: "My Todo", ... },
});
```

### 3. Type Discrimination: `instanceof` to `type` Field

Replace all `instanceof` checks with checks against the `type` string literal.

**Before (0.7.x):**

```ts
import { CreateTodoSuccessResponse } from "./generated/todo/CreateTodoResponse";

if (response instanceof CreateTodoSuccessResponse) {
  console.log(response.body.id);
}
```

**After (0.8.x):**

```ts
if (response.type === "CreateTodoSuccess") {
  // TypeScript narrows the type automatically
  console.log(response.body.id);
}
```

The `type` field is a string literal that matches the response name. TypeScript's discriminated
union narrowing works out of the box.

### 4. Core Type Changes

| 0.7.x                              | 0.8.x                               | Notes                   |
| ---------------------------------- | ----------------------------------- | ----------------------- |
| `HttpResponse` (class)             | `ITypedHttpResponse` (type)         | No longer a class       |
| `UnknownResponse` (class)          | `createUnknownResponse()` (factory) | Factory function        |
| `response instanceof HttpResponse` | `isTypedHttpResponse(response)`     | Type guard function     |
| `response.statusCode`              | `response.statusCode`               | Unchanged               |
| —                                  | `response.type`                     | New discriminator field |

### 5. Client Return Types

HTTP clients no longer throw error responses. Instead, they return a union of all possible responses
(success and error).

**Before (0.7.x):**

```ts
try {
  const response = await client.createTodo(request);
  // response is always a success type — errors were thrown
} catch (error) {
  if (error instanceof ForbiddenErrorResponse) { ... }
}
```

**After (0.8.x):**

```ts
const response = await client.createTodo(request);

if (response.type === "CreateTodoSuccess") {
  console.log(response.body.id);
} else if (response.type === "ForbiddenError") {
  console.error(response.body.message);
}
```

### 6. Generated Output Structure

Response files moved from entity-scoped directories to a centralized `responses/` directory. This
eliminates duplicate generation when multiple operations share the same response.

**Before (0.7.x):**

```
generated/
├── shared/
│   ├── ForbiddenErrorResponse.ts
│   └── ...
├── todo/
│   ├── CreateTodoResponse.ts     ← contained both the response class AND the union type
│   └── ...
```

**After (0.8.x):**

```
generated/
├── responses/
│   ├── CreateTodoSuccessResponse.ts   ← individual response type + factory
│   ├── ForbiddenErrorResponse.ts      ← shared responses live here too
│   └── index.ts
├── todo/
│   ├── CreateTodoResponse.ts          ← only the union type (re-exports from responses/)
│   └── ...
```

### 7. Migration Checklist (0.7.x to 0.8.x)

- [ ] Regenerate all output with `npx typeweaver generate`
- [ ] Replace all `new XxxResponse(...)` with `createXxxResponse(...)`
- [ ] Replace all `instanceof XxxResponse` with `response.type === "XxxName"`
- [ ] Replace `instanceof HttpResponse` with `isTypedHttpResponse(response)`
- [ ] Update client error handling from `try/catch` to discriminated union checks
- [ ] Update imports — response types now come from `responses/` directory
- [ ] Remove unused class imports (`HttpResponse`, `UnknownResponse`)

---

## Migrating from 0.8.x to 0.9.x

Version 0.9.0 replaces the **folder-scanning definition approach** with a **functional spec API**.
Instead of the CLI discovering definitions by traversing a directory tree, you now declare your
entire API through a single `defineSpec()` entrypoint.

### 1. Spec Definition: Directory Scanning to Functional API

The fundamental shift: TypeWeaver no longer infers your API structure from the filesystem. You
explicitly compose it in code.

**Before (0.8.x) — Directory-based definitions:**

The CLI scanned a `definition/` directory. Each subdirectory was an entity, each file was an
operation or response:

```
api/definition/
├── index.ts                        ← re-exported everything via `export *`
├── shared/
│   ├── ForbiddenErrorDefinition.ts
│   ├── NotFoundErrorDefinition.ts
│   ├── sharedResponses.ts
│   └── ...
├── todo/
│   ├── todoSchema.ts
│   ├── errors/
│   │   └── TodoNotFoundErrorDefinition.ts
│   ├── mutations/
│   │   ├── CreateTodoDefinition.ts
│   │   └── ...
│   └── queries/
│       ├── GetTodoDefinition.ts
│       └── ...
└── auth/
    ├── AccessTokenDefinition.ts
    └── ...
```

```ts
// definition/index.ts — just re-exports
export * from "./shared";
export * from "./todo";
export * from "./auth";
```

The CLI inferred entity grouping from directory names and required a separate `--shared` flag:

```bash
npx typeweaver generate \
  --input ./api/definition \
  --shared ./api/definition/shared \
  --output ./api/generated
```

**After (0.9.x) — Functional spec entrypoint:**

You compose the entire API spec programmatically through `defineSpec()`:

```ts
// api/spec/index.ts
import { defineSpec } from "@rexeus/typeweaver-core";
import { AccessTokenDefinition, RefreshTokenDefinition } from "./auth";
import {
  CreateTodoDefinition,
  GetTodoDefinition,
  ListTodosDefinition,
  DeleteTodoDefinition,
  // ...
} from "./todo";

export const spec = defineSpec({
  resources: {
    auth: {
      operations: [AccessTokenDefinition, RefreshTokenDefinition],
    },
    todo: {
      operations: [
        CreateTodoDefinition,
        GetTodoDefinition,
        ListTodosDefinition,
        DeleteTodoDefinition,
        // ...
      ],
    },
  },
});
```

The CLI now takes a single file entrypoint instead of a directory:

```bash
npx typeweaver generate \
  --input ./api/spec/index.ts \
  --output ./api/generated
```

### 2. Defining Operations: Classes to Functions

Operation and response definitions use factory functions instead of class constructors.

**Before (0.8.x) — Class-based definitions:**

```ts
// definition/todo/mutations/CreateTodoDefinition.ts
import { HttpOperationDefinition, HttpStatusCode, HttpMethod } from "@rexeus/typeweaver-core";
import { sharedResponses, defaultRequestHeadersWithPayload, defaultResponseHeader } from "../../shared";
import { todoSchema } from "../todoSchema";

export const CreateTodoDefinition = new HttpOperationDefinition({
  operationId: "CreateTodo",
  summary: "Create new todo",
  method: HttpMethod.POST,
  path: "/todos",
  request: {
    body: todoSchema.omit({ id: true, status: true, createdAt: true, ... }),
    header: defaultRequestHeadersWithPayload,
  },
  responses: [
    {
      name: "CreateTodoSuccess",
      body: todoSchema,
      description: "Todo created successfully",
      statusCode: HttpStatusCode.CREATED,
      header: defaultResponseHeader,
    },
    ...sharedResponses,
  ],
});
```

**After (0.9.x) — Functional definitions:**

```ts
// spec/todo/mutations/CreateTodoDefinition.ts
import { defineOperation, defineResponse, HttpMethod, HttpStatusCode } from "@rexeus/typeweaver-core";
import { sharedResponses, defaultRequestHeadersWithPayload, defaultResponseHeader } from "../../shared";
import { todoSchema } from "../todoSchema";

export const CreateTodoDefinition = defineOperation({
  operationId: "CreateTodo",
  summary: "Create new todo",
  method: HttpMethod.POST,
  path: "/todos",
  request: {
    body: todoSchema.omit({ id: true, status: true, createdAt: true, ... }),
    header: defaultRequestHeadersWithPayload,
  },
  responses: [
    defineResponse({
      name: "CreateTodoSuccess",
      body: todoSchema,
      description: "Todo created successfully",
      statusCode: HttpStatusCode.CREATED,
      header: defaultResponseHeader,
    }),
    ...sharedResponses,
  ],
});
```

### 3. Defining Responses: Classes to Functions

Shared response definitions now use `defineResponse()` instead of `new HttpResponseDefinition()`.

**Before (0.8.x):**

```ts
// definition/shared/ForbiddenErrorDefinition.ts
import { HttpResponseDefinition, HttpStatusCode } from "@rexeus/typeweaver-core";
import { z } from "zod";
import { defaultResponseHeader } from "./defaultResponseHeader";

export const ForbiddenErrorDefinition = new HttpResponseDefinition({
  name: "ForbiddenError",
  body: z.object({
    message: z.literal("Forbidden request"),
    code: z.literal("FORBIDDEN_ERROR"),
  }),
  header: defaultResponseHeader,
  statusCode: HttpStatusCode.FORBIDDEN,
  description: "Forbidden request",
});
```

**After (0.9.x):**

```ts
// spec/shared/ForbiddenErrorDefinition.ts
import { defineResponse, HttpStatusCode } from "@rexeus/typeweaver-core";
import { z } from "zod";
import { defaultResponseHeader } from "./defaultResponseHeader";

export const ForbiddenErrorDefinition = defineResponse({
  name: "ForbiddenError",
  body: z.object({
    message: z.literal("Forbidden request"),
    code: z.literal("FORBIDDEN_ERROR"),
  }),
  header: defaultResponseHeader,
  statusCode: HttpStatusCode.FORBIDDEN,
  description: "Forbidden request",
});
```

### 4. Derived Responses: `extend()` to `defineDerivedResponse()`

Entity-specific error responses that previously used `HttpResponseDefinition.extend()` now use the
standalone `defineDerivedResponse()` function.

**Before (0.8.x):**

```ts
// definition/todo/errors/TodoNotFoundErrorDefinition.ts
import { z } from "zod";
import { NotFoundErrorDefinition } from "../../shared";

export const TodoNotFoundErrorDefinition = NotFoundErrorDefinition.extend({
  name: "TodoNotFoundError",
  description: "Todo not found",
  body: z.object({
    message: z.literal("Todo not found"),
    code: z.literal("TODO_NOT_FOUND_ERROR"),
    actualValues: z.object({
      todoId: z.ulid(),
    }),
  }),
});
```

**After (0.9.x):**

```ts
// spec/todo/errors/TodoNotFoundErrorDefinition.ts
import { defineResponse, HttpStatusCode } from "@rexeus/typeweaver-core";
import { z } from "zod";
import { defaultResponseHeader } from "../../shared";

export const TodoNotFoundErrorDefinition = defineResponse({
  name: "TodoNotFoundError",
  description: "Todo not found",
  statusCode: HttpStatusCode.NOT_FOUND,
  header: defaultResponseHeader,
  body: z.object({
    message: z.literal("Todo not found"),
    code: z.literal("TODO_NOT_FOUND_ERROR"),
    actualValues: z.object({
      todoId: z.ulid(),
    }),
  }),
});
```

Alternatively, use `defineDerivedResponse()` to inherit and merge schemas from a parent:

```ts
import { defineDerivedResponse } from "@rexeus/typeweaver-core";
import { z } from "zod";
import { NotFoundErrorDefinition } from "../../shared/NotFoundErrorDefinition";

export const TodoNotFoundErrorDefinition = defineDerivedResponse(NotFoundErrorDefinition, {
  name: "TodoNotFoundError",
  description: "Todo not found",
  body: z.object({
    message: z.literal("Todo not found"),
    code: z.literal("TODO_NOT_FOUND_ERROR"),
    actualValues: z.object({
      todoId: z.ulid(),
    }),
  }),
});
```

`defineDerivedResponse()` automatically merges `ZodObject` body and header schemas with the parent.
It also records lineage metadata used during normalization.

### 5. CLI Changes

| 0.8.x                                | 0.9.x                                   | Notes                                     |
| ------------------------------------ | --------------------------------------- | ----------------------------------------- |
| `--input <directory>`                | `--input <file>`                        | Now points to a single `.ts` entrypoint   |
| `--shared <directory>`               | Removed                                 | Shared responses are composed in the spec |
| Definitions discovered by filesystem | Definitions composed via `defineSpec()` | Explicit over implicit                    |

**Before (0.8.x):**

```bash
npx typeweaver generate \
  --input ./api/definition \
  --shared ./api/definition/shared \
  --output ./api/generated
```

**After (0.9.x):**

```bash
npx typeweaver generate \
  --input ./api/spec/index.ts \
  --output ./api/generated
```

**Config file (0.9.x):**

```js
// typeweaver.config.js
export default {
  input: "./api/spec/index.ts",
  output: "./api/generated",
  plugins: ["clients", "hono"],
  format: true,
  clean: true,
};
```

### 6. Core API Changes

| 0.8.x                                   | 0.9.x                                | Notes                                      |
| --------------------------------------- | ------------------------------------ | ------------------------------------------ |
| `new HttpOperationDefinition({...})`    | `defineOperation({...})`             | Function instead of class                  |
| `new HttpResponseDefinition({...})`     | `defineResponse({...})`              | Function instead of class                  |
| `ResponseDefinition.extend({...})`      | `defineDerivedResponse(base, {...})` | Standalone function with explicit base     |
| `export * from "./entity"` (index.ts)   | `defineSpec({ resources: {...} })`   | Explicit resource composition              |
| Directory structure determines entities | `resources` keys determine entities  | `{ todo: { operations: [...] } }`          |
| Inline response objects in operations   | `defineResponse({...})` required     | Responses must go through `defineResponse` |

### 7. New Validation and Error Handling

The 0.9.x spec normalization process introduces stricter validation with descriptive errors:

| Error                               | Description                                                  |
| ----------------------------------- | ------------------------------------------------------------ |
| `DuplicateOperationIdError`         | Two operations share the same `operationId`                  |
| `DuplicateRouteError`               | Two operations share the same `method + path` combination    |
| `EmptyResourceOperationsError`      | A resource has an empty `operations` array                   |
| `EmptySpecResourcesError`           | The spec has no resources defined                            |
| `InvalidRequestSchemaError`         | A request schema is not a valid Zod type                     |
| `PathParameterMismatchError`        | Path parameters (`:param`) do not match `request.param` keys |
| `DuplicateResponseNameError`        | Two responses share the same `name` within the spec          |
| `InvalidDerivedResponseError`       | A derived response references a non-existent parent          |
| `DerivedResponseCycleError`         | Derived responses form a circular dependency                 |
| `MissingDerivedResponseParentError` | A derived response's parent is not included in the spec      |

These errors are thrown at spec load time with clear messages indicating which operation or response
caused the issue.

### 8. Directory Structure Convention

While the filesystem no longer drives generation, the recommended project structure remains similar:

```
api/spec/
├── index.ts                        ← exports defineSpec({...})
├── shared/
│   ├── sharedResponses.ts          ← array of shared response definitions
│   ├── ForbiddenErrorDefinition.ts
│   ├── NotFoundErrorDefinition.ts
│   ├── defaultResponseHeader.ts
│   └── ...
├── todo/
│   ├── index.ts                    ← re-exports all todo operations
│   ├── todoSchema.ts               ← Zod schemas for the entity
│   ├── errors/
│   │   └── TodoNotFoundErrorDefinition.ts
│   ├── mutations/
│   │   ├── CreateTodoDefinition.ts
│   │   └── ...
│   └── queries/
│       ├── GetTodoDefinition.ts
│       └── ...
└── auth/
    ├── index.ts
    ├── AccessTokenDefinition.ts
    └── ...
```

The key difference: `index.ts` at the root now calls `defineSpec()` instead of simply re-exporting.

### 9. Migration Checklist (0.8.x to 0.9.x)

- [ ] Rename `definition/` directory to `spec/` (recommended convention, not required)
- [ ] Replace `new HttpOperationDefinition({...})` with `defineOperation({...})`
- [ ] Replace `new HttpResponseDefinition({...})` with `defineResponse({...})`
- [ ] Replace `ResponseDefinition.extend({...})` with `defineDerivedResponse(base, {...})` or a
      standalone `defineResponse({...})`
- [ ] Wrap inline response objects in `defineResponse({...})`
- [ ] Create a `spec/index.ts` that exports `defineSpec({ resources: {...} })`
- [ ] Map each entity directory to a key in the `resources` object
- [ ] List all operations for each resource in the `operations` array
- [ ] Update CLI invocation: `--input` now points to the spec entrypoint file
- [ ] Remove `--shared` flag from CLI invocations and config files
- [ ] Update `typeweaver.config.js` if used: `input` is now a file path, remove `shared`
- [ ] Regenerate all output with `npx typeweaver generate`
- [ ] Verify no `HttpOperationDefinition` or `HttpResponseDefinition` class imports remain

---

## Full Migration Path (0.7.x to 0.9.x)

If upgrading directly from 0.7.x to 0.9.x, apply both sets of changes:

1. **Definitions** — Replace class constructors with functional API (`defineOperation`,
   `defineResponse`, `defineDerivedResponse`)
2. **Spec entrypoint** — Create a `defineSpec()` root that composes all resources
3. **Generated responses** — Update from class instantiation (`new XxxResponse`) to factory
   functions (`createXxxResponse`)
4. **Type discrimination** — Replace `instanceof` with `response.type === "..."` checks
5. **Client error handling** — Move from `try/catch` with `instanceof` to discriminated union
   pattern matching
6. **CLI** — Update from `--input <dir> --shared <dir>` to `--input <file>`
7. **Regenerate** — Run `npx typeweaver generate` and verify all imports resolve
