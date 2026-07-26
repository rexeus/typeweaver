# TypeWeaver Migration Guide

This document covers all breaking changes and required migration steps across major TypeWeaver
releases.

---

## Table of Contents

- [Migrating from 0.12.x to 1.0.x](#migrating-from-012x-to-10x)
- [Migrating from 0.7.x to 0.8.x](#migrating-from-07x-to-08x)
- [Migrating from 0.8.x to 0.9.x](#migrating-from-08x-to-09x)

---

## Migrating from 0.12.x to 1.0.x

Version 1.0.0 completes the migration to **Effect** as typeweaver's runtime foundation and matures
the executable API contract. The release breaks seven surfaces:

1. The **plugin API** (V1 class-based → V2 Effect-native records). Affects anyone who built a custom
   plugin.
2. The **CLI surface** (now built on `@effect/cli`). Affects scripts that parsed CLI output or
   relied on the previous error format.
3. A small set of **programmatic extension APIs** now use options objects. This affects direct
   `NetworkError` construction and custom subclasses of the generated server and Hono router bases.
4. The **Zod-to-TypeScript converter** rejects unsupported schema shapes instead of silently
   generating `unknown`.
5. The unvalidated **HTTP body boundary** is `unknown` instead of implicit `any`.
6. The **spec authoring API** requires API metadata and can declare generator-neutral security,
   descriptions, tags, and deprecation.
7. The **OpenAPI projection** moves from hard-coded 3.1.1 output to explicit 3.1.2 and 3.2.0 target
   profiles, with API identity sourced from the spec.

### 1. Plugin API V1 → V2 (BREAKING — third-party plugin authors)

The V1 class hierarchy is gone:

- `BasePlugin` is deleted. Class-based plugins no longer load.
- `TypeweaverPlugin`, `createPluginRegistry`, and `legacyAdapter` are deleted.
  `createPluginContextBuilder` was preserved as a `services/internal/` implementation detail backing
  the `ContextBuilder` service; it is no longer part of the package's public API.
- Plugins are now records returned by `definePlugin(...)`. Lifecycle stages return
  `Effect<void, PluginExecutionError>` instead of `Promise<void> | void`.
- Plugins may add an optional `validate(normalizedSpec, context)` hook returning
  `Effect<readonly Issue[], PluginExecutionError>`. Its `PluginValidationContext` is intentionally
  write-incapable: it has no output directory, writer, template renderer, or generated-file tracker.
  Existing plugins do not need to add the hook.
- Normalize errors now map exhaustively to stable `TW-SPEC-001` through `TW-SPEC-021` entries via
  `SPEC_ISSUE_REGISTRY`; use `normalizationErrorToIssue` for structured reports instead of parsing
  English error messages.
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

**After (1.0.x) — V2 plugin:**

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

Plugin packages must declare the supported Effect 3 range `>=3.22.0 <4` as a `peerDependency`.
TypeWeaver itself develops and tests against Effect 3.22.0:

```json
{
  "peerDependencies": {
    "@rexeus/typeweaver-gen": "^1.0.0",
    "effect": ">=3.22.0 <4"
  }
}
```

`GeneratorContext.writeFile`, `renderTemplate`, and `addGeneratedFile` remain synchronous. Plugin
authors wrap their sync work in `Effect.try` and map thrown causes to `PluginExecutionError` — the
orchestrator does **not** catch raw throws. Plugins written in Effect style can use the additive
Effect-native counterparts (`writeFileEffect`, `renderTemplateEffect`, `addGeneratedFileEffect`)
instead — same guarantees, typed error channels, I/O through `@effect/platform`'s `FileSystem`
service. See [`docs/plugin-authoring.md`](./docs/plugin-authoring.md) for the full V2 contract and
[ADR 0003](./docs/adr/0003-effect-native-plugin-api.md) for the design rationale.

Plugin authors no longer need to copy the CLI's private fake contexts or manually retain
`Layer.buildWithScope` state. Use `createPluginTestKit` for path-safe in-memory lifecycle tests and
`defineScopedPlugin` for one plugin-owned Layer per generation call. The helper releases the Layer
after success, typed failure, defect, and interruption while keeping ordinary plugin hooks at
`R = never`.

For a new V2 package, run
`typeweaver add plugin --name <lowercase-kebab-name> --target <new-directory>`. This additive,
non-interactive command creates a strict TypeScript package with public lifecycle tests, a
configurable factory example, and an integration generation fixture. It refuses an existing target;
there is no migration required for existing plugin packages.

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

One behavioral tightening: the output-target safety guard now runs on **every** generation —
including `--no-clean` — before anything touches the filesystem. Pointing `--output` at the current
working directory, a workspace root, or any directory carrying a workspace marker (`.git`,
`pnpm-workspace.yaml`, …) is rejected up front. Previously `--no-clean` skipped the guard entirely.
Generating next to the spec source (e.g. `--output spec` with `--input spec/index.ts`) remains
allowed with `--no-clean`; only the destructive clean step refuses targets that contain the input
file.

The additive `typeweaver validate` command runs normalization and plugin validation without writing
project output. Its `--json` mode emits a versioned report accepted by the public
`ValidationReportSchema`; `--fail-on` and `--strict` control the deterministic exit threshold.
Existing `generate` invocations do not need to change.

The additive `typeweaver doctor` command checks the supported runtime and package-manager workflow,
configuration and spec resolution, plugin availability, output safety, Effect compatibility, and
optional formatter availability. `--deep` performs the same scoped no-output validation used by
`validate`. Human and JSON reports use stable `TW-DOCTOR-*` codes; JSON output is accepted by the
public `DoctorReportSchema`. Warnings retain exit code 0, while any failed check exits 1. Existing
scripts do not need to change unless they choose to add this preflight.

The former placeholder `typeweaver init` command is now an additive, non-interactive project
bootstrap. It requires `--target`, refuses a non-empty directory unless `--force` is explicit, and
publishes a complete Todo starter transactionally. `--dry-run` reports the planned files without
writing, `--config-format mjs|cjs|js` selects the generated config module, and `--json` emits a
versioned report accepted by the public `InitReportSchema`. An existing `package.json` is always
preserved; `--force` replaces only conflicting starter files. Existing `generate`, `validate`, and
`doctor` scripts do not need to change.

The new `@rexeus/typeweaver-command` package is additive. Install it together with
`@rexeus/typeweaver-clients` and add both `"clients"` and `"command"` to the plugin list when you
want a generated Node.js command-line client. Existing generated clients require no migration. The
new plugin emits one command per operation, uses only declared contract security, and forwards
cancellation into the existing Fetch transport. Its executable is `command/cli.mts`; compile the
generated NodeNext sources and run the emitted `command/cli.mjs`. See the
[command package guide](./packages/command/README.md) for deterministic flags, body sources, output,
exit codes, and representability limits.

### 3. Internal API changes (informational; only programmatic consumers)

If you imported the generator programmatically rather than through the CLI:

- The imperative `Generator` class is replaced by an `Effect.Service` that lives inside a
  `ManagedRuntime`. Import the public runtime and service from `@rexeus/typeweaver`, then dispose
  the runtime when the embedding process no longer needs it:

  ```ts
  import { effectRuntime, Generator } from "@rexeus/typeweaver";

  try {
    await effectRuntime.runPromise(
      Generator.generate({
        inputFile: "./api/spec/index.ts",
        outputDir: "./api/generated",
      })
    );
  } finally {
    await effectRuntime.dispose();
  }
  ```

  The package-root import is side-effect-free: only the `typeweaver` binary parses argv or starts
  the CLI. See `packages/cli/src/effectRuntime.ts` and
  [ADR 0007](./docs/adr/0007-generator-per-call-isolation.md).

- `createPluginRegistry` is deleted; the runtime composes the equivalent service.
  `createPluginContextBuilder` is no longer exported — it lives under `services/internal/` as
  implementation detail of the `ContextBuilder` service.
- `MainLayer` (from `@rexeus/typeweaver-gen`) now requires the platform-agnostic `FileSystem` tag
  from `@effect/platform` — `ContextBuilder` captures it for the Effect-native plugin context
  surface. Provide `NodeContext.layer` (production) or an in-memory/no-op `FileSystem` layer (tests)
  beneath it.
- Errors are now `Data.TaggedError` instances throughout. Inspect the `_tag` field for typed
  branching (`UnsafeGeneratedPathError`, `PluginExecutionError`, `SpecBundleError`, etc.).
- Fiber interruption waits for a running Rolldown bundle to settle before the generator releases its
  output lock. Rolldown has no cancellation signal, so the CLI stages the bundle beside its
  destination and publishes it only after a successful build. This can delay interruption by the
  remaining bundle time, but prevents detached writes after cleanup or lock release.
- Atomic generator writes record a successfully published file before attempting fallible temp
  cleanup. A cleanup error can still fail the operation, but the generated-file tracker and pending
  log queue remain consistent with the filesystem.
- Multi-mode errors use nested discriminants instead of optional field bags:
  `PluginDependencyError.issue.kind` distinguishes `missing-dependency` from `dependency-cycle`,
  while `UnsafeCleanTargetError.details.reason` selects the exact clean-target payload. Update
  programmatic field access accordingly.
- `GenerateFailure` is the canonical generator error union and is derived from
  `Generator.generate`'s Effect error channel. The incomplete duplicate `GenerationError` type was
  removed.
- Expected operational failures remain typed rather than becoming Effect defects. Programmatic
  callers can branch on formatter load/execution/filesystem errors, `CleanTargetInspectionError`,
  `OutputLockError`, and `GeneratedPathProbeError`; the underlying cause and affected path or
  operation are retained.
- Custom top-level configuration keys survive CLI flag resolution and remain available to plugins
  through `context.config`.
- `NetworkError` now receives its metadata through a `NetworkErrorOptions` object. Replace
  `new NetworkError(message, code, method, url, { cause })` with
  `new NetworkError(message, { code, method, url, cause })`.
- Generated client `ApiClientProps` add optional `defaultHeaders`, `defaultQuery`, and `signal`
  fields. They require no migration; command values override defaults, and an external signal is
  combined with `timeoutMs` when both are present.
- Generated server `ServerContext` now includes the incoming Fetch request's `signal`. Existing
  handlers require no migration; cancellation-aware handlers and adapters can forward this
  `AbortSignal` to their runtime boundary.
- Custom `TypeweaverRouter` subclasses now call the protected `route` method with one exported
  `TypeweaverRouteOptions` object instead of the previous positional arguments.
- Custom `TypeweaverHono` subclasses now call the protected `handleRequest` method with one exported
  `TypeweaverHonoRequestOptions` object instead of the previous five positional arguments.

### 4. API metadata and security contract (BREAKING for spec authors)

Every spec now owns its API identity. Add `metadata.title` and `metadata.version` to each
`defineSpec` call:

```ts
// Before (0.12.x)
export const spec = defineSpec({ resources });

// After (1.0.x)
export const spec = defineSpec({
  metadata: {
    title: "Todo API",
    version: "1.0.0",
    description: "Contract for todo clients and servers",
    tags: [{ name: "todos", description: "Todo management" }],
  },
  resources,
});
```

Security is descriptive and generator-neutral; TypeWeaver does not authenticate requests. Schemes
are named once and requirements use AND within one object and OR between array entries:

```ts
export const spec = defineSpec({
  metadata: {
    title: "Service API",
    version: "1.0.0",
    tags: [{ name: "health", description: "Service health" }],
  },
  securitySchemes: [
    { name: "bearerAuth", kind: "http", scheme: "bearer" },
    {
      name: "apiKeyAuth",
      kind: "apiKey",
      credentialName: "X-API-Key",
      location: "header",
    },
  ],
  security: [{ bearerAuth: [] }],
  resources: {
    health: {
      tags: ["health"],
      security: [{ bearerAuth: [], apiKeyAuth: [] }],
      operations: [GetHealth],
    },
  },
});
```

`security: undefined` inherits the enclosing declaration, `security: []` is explicitly public, and a
non-empty array replaces the inherited requirement. Resources add optional `description`, `tags`,
and `security`; operations add optional `description`, `deprecated`, `tags`, and `security`. Tags
referenced by resources or operations must be declared in `metadata.tags`. In the complete fixture,
`GetHealth` declares `security: []` to override the resource requirement.

<!-- docs-example: metadata-security-contract -->

The complete metadata/security migration shape is typechecked in the
[metadata/security fixture](./packages/cli/examples/documentation/metadata-security.ts).

Plugin authors consuming `NormalizedSpec` must add `metadata`, `securitySchemes`, and resolved
`security` fields to manually constructed fixtures. Normalized resources and operations likewise
contain resolved tags/security, while operations always contain a boolean `deprecated`. Prefer
calling the public normalization pipeline instead of assembling normalized objects by hand.

Zod request and response schemas continue to be authored the same way. Regeneration updates the
generated client, server, and Hono support code to the options-object APIs described above, so
expect source diffs. The test-project golden fixture verifies the exact 1.0 output on every build.

### 5. OpenAPI target profiles and spec-owned identity (BREAKING)

`@rexeus/typeweaver-openapi` now defaults to OpenAPI 3.1.2 and accepts an explicit `target` of
`"3.1.2"` or `"3.2.0"`. Existing users that require the compatibility profile may omit the option;
users that require 3.2 select it explicitly:

```ts
openApiPlugin({
  target: "3.2.0",
  outputPath: "openapi/openapi.json",
});
```

Remove `info` from OpenAPI plugin and builder options. Title, version, description, and reusable
tags now come from `defineSpec({ metadata: ... })`, so every generator consumes one API identity.
Servers, the output path, and the projection target remain OpenAPI options.

Regeneration changes the emitted `openapi` field from `3.1.1` to `3.1.2` by default and projects
contract security into `components.securitySchemes`, root `security`, and effective operation
`security`. Explicitly public operations emit `security: []`. Builder representability warnings are
available as stable `TW-PLUGIN-OPENAPI-*` issues through the plugin's write-incapable `validate`
hook rather than generation-time warning logs.

<!-- docs-example: openapi-options -->

The supported option shapes are typechecked in the
[OpenAPI options fixture](./packages/cli/examples/documentation/openapi-options.ts).

### 6. Unsupported Zod schemas fail explicitly

`@rexeus/typeweaver-zod-to-ts` previously converted `z.lazy()`, `z.templateLiteral()`, `z.custom()`,
and `z.transform()` to TypeScript `unknown`. This hid contract loss in generated output. These
schemas now throw the exported `UnsupportedZodTypeError`, including when one is nested or used as a
pipe output.

The error has stable fields for programmatic handling:

```ts
import { TsTypeNode, UnsupportedZodTypeError } from "@rexeus/typeweaver-zod-to-ts";

try {
  TsTypeNode.fromZod(schema);
} catch (error: unknown) {
  if (error instanceof UnsupportedZodTypeError) {
    console.error(error.code, error.schemaKind, error.reason);
  }
}
```

Replace unsupported shapes with an equivalent supported schema before generation. `z.unknown()`
remains supported and still generates TypeScript `unknown`.

### 7. Unvalidated HTTP bodies are unknown

`IHttpBody` and the default body types of `IHttpRequest`, `IHttpResponse`, handlers, and generated
Fetch/Hono adapters no longer resolve to `any`. Generated operation types remain schema-specific.
Code using an unparameterized HTTP type must now narrow or validate its body:

```ts
function getMessage(response: IHttpResponse): string | undefined {
  const body = response.body;
  if (
    body !== null &&
    typeof body === "object" &&
    "message" in body &&
    typeof body.message === "string"
  ) {
    return body.message;
  }
  return undefined;
}
```

Custom subclasses of the generated Hono `HttpAdapter` that relied on implicit `any` defaults should
provide explicit request, response, and context type arguments. The Fetch-native server and Hono
adapters continue to support JSON values, strings, `ArrayBuffer`, `Blob`, `null`, and `undefined`.
Values that cannot be represented by `JSON.stringify` now fail explicitly; Hono exposes
`HonoResponseSerializationError` for this case.

### 8. Migration Checklist (0.12.x to 1.0.x)

For **end users** (you use the CLI but don't author plugins):

- [ ] Update any scripts that parsed the previous CLI error format.
- [ ] Update any scripts that parsed log lines (timestamps and fiber tags are gone).
- [ ] Regenerate output with `npx typeweaver generate` and review the expected options-object source
      diffs in the generated client, server, and Hono support code.
- [ ] Replace any `z.lazy()`, `z.templateLiteral()`, `z.custom()`, or `z.transform()` schema that
      reaches TypeScript generation with a supported, statically inspectable schema.
- [ ] Narrow `body` before reading it when using unparameterized `IHttpRequest` or `IHttpResponse`
      types.
- [ ] Add explicit request, response, and context generics to custom generated `HttpAdapter`
      subclasses that previously relied on defaults.
- [ ] Add `metadata.title` and `metadata.version` to every `defineSpec` call.
- [ ] Move reusable API tags and security schemes into the generator-neutral spec contract.
- [ ] Use `security: []` for operations or resources that must remain explicitly public under an
      inherited security requirement.
- [ ] Remove `info` from OpenAPI plugin options and select `target: "3.2.0"` only when consumers
      support that profile; otherwise use the 3.1.2 default.

For **plugin authors**:

- [ ] Replace `extends BasePlugin` with `definePlugin(...)` or `definePluginWithLibCopy(...)`.
- [ ] Wrap sync emitter bodies in `Effect.try` with `PluginExecutionError` mapping (or use
      `definePluginWithLibCopy`, which does it for you).
- [ ] Declare `effect >=3.22.0 <4` as a `peerDependency`.
- [ ] Replace hand-built full `GeneratorContext` fakes with `createPluginTestKit`; inspect its
      issues, generated files, contents, and finalizer failures.
- [ ] Verify your plugin is discoverable: a named export matching the plugin name, a default export
      of a `Plugin` record, or a default export of a `(options?) => Plugin` factory.
- [ ] Keep configurable factories pure and synchronous. If the plugin owns a long-lived Effect
      service, use `defineScopedPlugin` with a per-generation Layer (see the
      [scoped-service example](./packages/cli/examples/scoped-service-plugin.mjs)). This supports
      exit-independent cleanup; `finalize` does not receive the generator's original `Exit`, so
      transactional finalizers need a different integration boundary.
- [ ] Update manually constructed `NormalizedSpec`, resource, and operation fixtures with metadata,
      resolved security, tags, and deprecation defaults.

### Further reading

- [ADR 0003: Effect-native plugin API (V2)](./docs/adr/0003-effect-native-plugin-api.md)
- [ADR 0004: FileSystem service adoption strategy](./docs/adr/0004-filesystem-service-adoption.md)
- [ADR 0005: Effect.Service patterns (succeed vs effect)](./docs/adr/0005-effect-service-patterns.md)
- [ADR 0006: CLI error and log formatting](./docs/adr/0006-cli-error-and-log-formatting.md)
- [ADR 0007: Generator per-call isolation](./docs/adr/0007-generator-per-call-isolation.md)
- [ADR 0009: API metadata and security contract](./docs/adr/0009-api-metadata-and-security-contract.md)
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
