# ADR 0002: Normalized Core Model

## Status

Proposed

## Context

ADR 0001 established the move from a filesystem-driven, class-based specification system to a purely
functional code-first API built around:

- `defineResponse(...)`
- `defineDerivedResponse(base, overrides)`
- `defineOperation(...)`
- `defineSpec({ resources })`

That decision leaves several architectural questions open:

1. What should the normalized internal model look like?
2. How do we separate response definitions from response usage?
3. Which generated artifacts are canonical and generated once, and which remain operation-specific?
4. How should the spec be loaded?
5. How should generated output be organized?

The current architecture is shaped by filesystem discovery and carries that baggage deep into
generation. `ResourceReader`, `GetResourcesResult`, `OperationResource`, and related types mix
together:

- authoring concerns
- discovery concerns
- output-path concerns
- generation concerns

The new architecture must make these boundaries explicit.

## Decision

Typeweaver will adopt a **three-layer architecture**:

1. **Definition layer** — the functional API values authored by users
2. **Normalized core model** — the canonical internal representation for validation and generation
3. **Generator context** — plugin-facing utilities and derived output-path helpers

The normalized core model will explicitly separate:

- response definitions
- response usage inside operations
- inline responses
- named reusable responses
- derived response lineage

The generator architecture will treat **all named response definitions as canonical**.

This means:

- every value created by `defineResponse(...)` is canonical
- every value created by `defineDerivedResponse(...)` is canonical
- only inline response objects inside an operation are operation-local

This is preferred over a usage-count-based rule because it is more deterministic, easier to explain,
and avoids output shape changing merely because a response becomes used by a second operation later.

## Definition Layer

The definition layer represents what the user authors through the public API.

It should contain at least:

- `SpecDefinition`
- `ResourceDefinition`
- `OperationDefinition`
- `ResponseDefinition`
- `DerivedResponseDefinition`
- request definition types

### Responsibilities

- model authoring intent
- keep response identity stable through object identity
- preserve base references for derived responses
- remain independent from filesystem layout
- remain independent from generated output topology

### Non-responsibilities

- computing output paths
- deciding import topology
- exposing filesystem metadata
- plugin-specific shaping

## Normalized Core Model

The normalized core model is the generator's canonical view of the spec.

It should live independently from the public authoring API and should be shaped by generation-domain
needs rather than by source layout.

### Recommended model

```ts
type NormalizedSpec = {
  readonly resources: readonly NormalizedResource[];
  readonly responses: readonly NormalizedResponse[];
};

type NormalizedResource = {
  readonly name: string;
  readonly operations: readonly NormalizedOperation[];
};

type NormalizedOperation = {
  readonly operationId: string;
  readonly method: HttpMethod;
  readonly path: string;
  readonly summary: string;
  readonly request?: NormalizedRequest;
  readonly responses: readonly NormalizedResponseUsage[];
};

type NormalizedRequest = {
  readonly header?: ZodType;
  readonly param?: ZodType;
  readonly query?: ZodType;
  readonly body?: ZodType;
};

type NormalizedResponse = {
  readonly name: string;
  readonly statusCode: HttpStatusCode;
  readonly statusCodeName: string;
  readonly description: string;
  readonly header?: ZodType;
  readonly body?: ZodType;
  readonly kind: "response" | "derived-response";
  readonly derivedFrom?: string;
};

type NormalizedResponseUsage = {
  readonly responseName: string;
  readonly source: "canonical" | "inline";
};
```

## Definition vs Usage

This distinction is mandatory in the new architecture.

### `NormalizedResponse`

Represents a canonical, materialized response definition.

This is the answer to:

> What is the response?

It is the unit used for:

- global response identity
- deduplication
- one-time generation of reusable artifacts
- lineage tracking for derived responses

### `NormalizedResponseUsage`

Represents how a response appears in a specific operation.

This is the answer to:

> How does this operation use that response?

It is the unit used for:

- operation-level unions
- imports of canonical responses
- distinguishing inline response artifacts from canonical imports

### Rule

- named response definitions become `NormalizedResponse`
- inline operation responses become `NormalizedResponseUsage` with `source: "inline"`
- named responses used in an operation become `NormalizedResponseUsage` with `source: "canonical"`

## Canonical Artifacts vs Operation-Specific Artifacts

This decision determines what is generated once versus per operation.

### Canonical response artifacts

Generated exactly once per named response definition:

- response type alias
- response body type alias
- response header type alias
- response factory/helper
- optional canonical validator, if validator generation remains split that way

Examples:

- `ValidationErrorResponse.ts`
- `TodoNotFoundErrorResponse.ts`

### Operation-specific artifacts

Generated per operation:

- operation request types
- operation response union
- operation response validator composition
- command/handler wiring
- imports of canonical response artifacts

Examples:

- `GetTodoRequest.ts`
- `GetTodoResponse.ts`
- `GetTodoResponseValidator.ts`

### Important rule

Derived responses are fully materialized during normalization.

Generated code must not express derivation through inheritance or extension of another generated
response artifact. By the time generators run, a derived response is simply a fully resolved
canonical response with lineage metadata.

## Derived Response Semantics

Derived response depth is unrestricted.

### Merge rules

When materializing a derived response chain:

- explicitly set child values override parent values
- missing child values inherit from the parent
- merge whenever structurally possible

Detailed behavior:

- `name` — required on the child and defines the new response identity
- `description` — child overrides when set, otherwise inherits
- `statusCode` — child overrides when set, otherwise inherits
- `header` — merge object schemas when possible, child fields override on conflict
- `body` — merge object schemas when possible, child fields override on conflict

If a merge is structurally impossible, normalization must fail fast with a clear error.

### Cycle safety

Derived chains are allowed at arbitrary depth, but cycles are forbidden.

Validation must detect cycles across the full response graph before generation.

## Validation Rules

The normalized pipeline must validate at least the following:

- global uniqueness of response names
- global uniqueness of operation IDs
- uniqueness of method + normalized path
- required `resources` in `defineSpec(...)`
- non-empty resources
- valid request schema shapes
- path parameter consistency with `request.param`
- valid derived response chains
- no cyclic derivation

## Bundling and Loading Strategy

Input loading and generated output structure are separate concerns.

### Input strategy

The spec entrypoint should be bundled and then loaded.

Recommended flow:

1. author provides a spec entrypoint such as `api/spec.ts`
2. CLI bundles the entrypoint and all transitive imports into a self-contained ESM file
3. CLI imports that bundle and obtains the `SpecDefinition`
4. normalization and validation run on the imported spec
5. generation runs from the normalized model

### Why bundling is preferred

- removes directory scanning completely
- removes default-export-per-file discovery rules
- removes `instanceof`-based classification
- removes input-directory copying as the primary loading strategy
- makes the loaded spec self-contained and reproducible

### Relationship to generated output

The bundled spec is an input-loading concern only.

It may be written into generated output under something like:

```txt
generated/spec/spec.js
generated/spec/spec.d.ts
```

This allows runtime access to bundled schemas if needed, but it does not define the rest of the
output topology.

## Output Topology

Generated output should be organized around canonical reusable artifacts and resource-specific
artifacts.

Recommended topology:

```txt
generated/
  spec/
    spec.js
    spec.d.ts
  responses/
    ValidationErrorResponse.ts
    TodoNotFoundErrorResponse.ts
  todo/
    GetTodoRequest.ts
    GetTodoResponse.ts
    GetTodoResponseValidator.ts
    TodoClient.ts
  account/
    ...
  index.ts
```

### Topology rules

- `spec/` contains the bundled spec artifact
- `responses/` contains canonical reusable response artifacts
- each resource directory contains operation-specific artifacts and resource-level outputs
- generators compute output paths from the normalized model, not from authoring file paths

## Consequences

### Positive

- the architecture gains a clear separation between definition, normalization, and generation
- response reuse becomes deterministic and easy to reason about
- canonical artifacts are generated exactly once
- output shape is stable and not dependent on usage count heuristics
- plugins can consume a model shaped by generation concerns rather than filesystem concerns
- bundling removes a major source of complexity from loading

### Negative

- this requires a substantial rework of generator internals
- plugins must migrate to the new normalized model
- path computation needs a dedicated abstraction instead of being carried around on resources
- more architectural decisions are made explicitly up front rather than emerging from the old loader

## Out of Scope for This ADR

- exact plugin API migration details
- exact CLI flag naming
- bundler implementation choice finalization
- detailed template changes for each built-in generator

## Follow-Up Decisions

1. Finalize the concrete TypeScript module layout for the new definition and normalization layers.
2. Decide whether canonical response validators live next to canonical response types or are kept
   fully operation-scoped.
3. Decide whether `responses/` is the final output directory name or whether another name better
   reflects generated artifacts.
