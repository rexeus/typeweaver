# ADR 0001: Functional Spec API

## Status

Proposed

## Context

Typeweaver currently uses a filesystem-driven specification model. Users must place definition files
at exact locations, structure folders by resource or entity, and default-export class instances that
are discovered through directory traversal.

This approach has several drawbacks:

- Authoring is coupled to file and folder layout instead of an explicit API.
- New users must learn framework-specific filesystem rules before they can define an API.
- Shared responses depend on special directories and manual aggregation.
- Discovery and identity rely on implicit conventions like default exports, folder names, and
  string-based name matching.
- The generator architecture is shaped by the discovery mechanism rather than by a clean domain
  model.

We want to replace this with a slimmer, code-first, onboarding-friendly approach that follows modern
TypeScript best practices and allows the generator architecture to be rebuilt around a clearer core
model.

## Decision

Typeweaver will move to a **functional spec API** and a **new normalized core model**.

The new public API in V1 will be:

- `defineResponse(...)`
- `defineDerivedResponse(base, overrides)`
- `defineOperation(...)`
- `defineSpec({ resources })`

The following decisions are explicitly part of this ADR:

1. The old filesystem-based definition model will not be preserved as part of the target
   architecture.
2. The generator may be reworked radically to fit the new model.
3. The new API will be purely functional. No builder is part of V1.
4. `ref(...)` will not be introduced in V1.
5. `sharedResponses` will not be part of `defineSpec(...)` in V1.
6. `resources` is required in `defineSpec(...)`.
7. Response names are globally unique.
8. Shared responses are not a separate authoring concept. Reuse happens through direct imports of
   response definitions.
9. Derived responses are first-class response definitions and may also be reused across multiple
   operations.
10. If a response definition is reused in multiple operations, its generated artifacts must be
    created once and imported where needed.

## Target API

```ts
const ValidationError = defineResponse({
  name: "ValidationError",
  statusCode: 400,
  description: "Validation error",
  body: z.object({
    message: z.literal("Request is invalid"),
    code: z.literal("VALIDATION_ERROR"),
  }),
});

const NotFoundError = defineResponse({
  name: "NotFoundError",
  statusCode: 404,
  description: "Resource not found",
  body: z.object({
    message: z.string(),
    code: z.string(),
  }),
});

const TodoNotFoundError = defineDerivedResponse(NotFoundError, {
  name: "TodoNotFoundError",
  description: "Todo not found",
  body: z.object({
    message: z.literal("Todo not found"),
    code: z.literal("TODO_NOT_FOUND"),
    actualValues: z.object({
      todoId: z.string(),
    }),
  }),
});

const GetTodo = defineOperation({
  operationId: "GetTodo",
  method: HttpMethod.GET,
  path: "/todos/:todoId",
  request: {
    param: z.object({
      todoId: z.string(),
    }),
  },
  responses: [
    {
      name: "GetTodoSuccess",
      statusCode: 200,
      description: "Todo retrieved",
      body: todoSchema,
    },
    ValidationError,
    TodoNotFoundError,
  ],
});

export default defineSpec({
  resources: {
    todo: [GetTodo],
  },
});
```

## Core Model Principles

The internal generator architecture will be built around a normalized domain model, not around the
authoring file layout.

The model must represent at least:

- API spec
- resources
- operations
- requests
- response definitions
- response usages
- derived response relationships

### Identity model

- A named response definition is a first-class entity.
- A derived response definition is also a first-class entity.
- Inline responses and named response definitions must be distinguishable in the model.
- Reuse is determined from definition identity and usage, not from directory placement.

### Resource model

- Resource grouping is explicit through `defineSpec({ resources })`.
- No resource names are inferred from the filesystem.

### Generator contract

- Generators consume a normalized model.
- The normalized model must not depend on filesystem conventions.
- Output paths and plugin-specific concerns are derived after normalization, not encoded into the
  authoring model itself.

## Generation Rules

### Single generation for reused responses

If a named response definition is used by multiple operations:

- its generated interfaces/types/factories/validators are created exactly once
- operations that use it import those generated artifacts
- the same response must never be emitted redundantly per operation

This rule applies equally to normal responses and derived responses.

### Global response name uniqueness

Response names are globally unique across the entire spec.

This applies to:

- normal named responses
- derived responses
- inline responses with explicit names

Global uniqueness keeps generation deterministic and avoids naming collisions in output.

### Derived response merge semantics

`defineDerivedResponse(base, overrides)` merges the base definition with the child definition using
the following rules:

- explicit child values override parent values
- values not provided by the child are inherited from the parent
- merge whenever structurally possible

More specifically:

- `name`: required on the child and defines the new response identity
- `description`: child overrides when provided, otherwise inherits
- `statusCode`: child overrides when provided, otherwise inherits
- `header`: merge when both sides are mergeable object schemas; child fields override matching
  parent fields
- `body`: merge when both sides are mergeable object schemas; child fields override matching parent
  fields

If a merge is not structurally possible, generation should fail fast with a clear error instead of
silently producing ambiguous behavior.

## Consequences

### Positive

- Better developer experience for new and existing users
- Authoring is no longer coupled to filesystem structure
- Shared and derived responses become explicit, first-class concepts
- Generator architecture can align with a clean domain model instead of legacy discovery
- Reused responses can be generated once and imported consistently
- The public API becomes smaller and easier to explain

### Negative

- This is a breaking architectural change
- Existing filesystem-driven definitions are no longer the target model
- Generator and plugin internals will require substantial rework
- Several previously implicit conventions now need to be explicitly modeled and validated

## Out of Scope for V1

The following are explicitly not part of the initial design:

- filesystem-driven resource discovery
- special `shared/` directory semantics
- `sharedResponses` registration in `defineSpec(...)`
- `ref(...)` as a response usage API
- builder-style authoring APIs
- preserving the old class-based definition model as a design constraint

## Open Questions

1. What exact normalized model shape should be exposed to built-in and third-party plugins?
2. Which generated artifacts belong to a canonical response definition versus an operation-level
   response union or wrapper?
3. How should output paths for shared reusable artifacts be organized in a way that remains clear to
   consumers without reintroducing old filesystem semantics?
4. Should derived response chains be unrestricted, or should depth/shape validation be tightened
   beyond V1?
