# TypeWeaver Migration Guide

This document covers all breaking changes and required migration steps across major TypeWeaver
releases.

---

## Table of Contents

- [Migrating from 0.7.x to 0.8.x](#migrating-from-07x-to-08x)
- [Migrating from 0.8.x to 0.9.x](#migrating-from-08x-to-09x)

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

### 9. Generated Output Namespaces

Generated files are now grouped by plugin under the output root. Shared artifacts still stay at the
top level.

**Before:**

```text
generated/
├── spec/
├── responses/
├── lib/
├── todo/
│   ├── GetTodoRequest.ts
│   ├── GetTodoResponse.ts
│   ├── TodoClient.ts
│   ├── TodoRouter.ts
│   └── TodoHono.ts
└── index.ts
```

**After:**

```text
generated/
├── spec/
├── responses/
├── lib/
│   ├── clients/
│   ├── hono/
│   ├── server/
│   └── types/
├── types/
│   └── todo/
├── clients/
│   └── todo/
├── server/
│   └── todo/
├── hono/
│   └── todo/
└── index.ts
```

Update any direct imports into generated resource files so they point at the plugin namespace:

- `generated/todo/GetTodoRequest` → `generated/types/todo/GetTodoRequest`
- `generated/todo/TodoClient` → `generated/clients/todo/TodoClient`
- `generated/todo/TodoRouter` → `generated/server/todo/TodoRouter`
- `generated/todo/TodoHono` → `generated/hono/todo/TodoHono`

Shared imports stay rooted where they were before:

- `generated/spec/spec`
- `generated/responses/...`
- `generated/lib/<plugin>/...`

### 10. Migration Checklist (0.8.x to 0.9.x)

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
- [ ] Update direct generated imports to use plugin namespaces (`types/`, `clients/`, `server/`,
      `hono/`, etc.)
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
