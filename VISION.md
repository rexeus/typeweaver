# TypeWeaver vision

TypeWeaver is an API-first platform for defining an executable HTTP contract once and projecting it
into the developer surfaces needed to build, integrate, document, and operate a TypeScript API. The
contract is the product: generated artifacts must remain deterministic, validated, portable, and
honest about information they cannot represent.

## Target users and jobs

TypeWeaver serves TypeScript teams that want a code-first contract without hand-maintaining parallel
types, validators, clients, routers, and API descriptions.

- API authors define request and response behavior once with TypeScript and Zod.
- Backend developers generate typed handler surfaces and runtime validation for their chosen server.
- Client developers consume generated commands and discriminated response types.
- Platform teams publish standards-based API descriptions and reusable plugins.
- Plugin authors extend generation through a documented, stable normalized model.

## One contract, many projections

A `defineSpec(...)` entrypoint is the single executable source for an API. TypeWeaver validates and
normalizes that contract before generators consume it. Built-in projections include TypeScript
request and response types, Zod validators, Fetch clients, Fetch-native and Hono servers, AWS CDK
infrastructure helpers, and OpenAPI documents.

Every projection must preserve the parts of the contract it can represent. When a target cannot
express something faithfully, TypeWeaver reports a stable diagnostic or fails with an actionable
error instead of silently widening or inventing behavior.

## Product principles

1. **Truth before breadth.** Shipped behavior, documentation, examples, and compatibility claims
   must agree and be backed by executable evidence.
2. **One validated core.** Authoring values normalize into a generator-neutral model before any
   plugin emits files.
3. **End-to-end type safety.** External input starts as `unknown`, is validated at a boundary, and
   becomes a precise type; public defaults must not hide holes with `any`.
4. **Deterministic generation.** Identical contracts and configuration produce identical output,
   with path safety and transactional publication preserved.
5. **Standards with explicit loss.** HTTP, JSON Schema, and OpenAPI projections describe their
   supported subset and surface representability loss.
6. **Portable generated surfaces.** Framework-specific integrations are optional, and the
   Fetch-native path remains usable across supported JavaScript runtimes.
7. **Extensibility through public contracts.** Third-party plugins build on documented package
   exports and contexts, not private repository internals.

## Explicit non-goals

The current product direction does not include:

- a full OpenAPI importer;
- an ORM, authentication provider, or business-logic generator;
- a native Effect `HttpApi` backend;
- a lossless Zod, OpenAPI, and Effect Schema round trip;
- mandatory Effect usage for core, client, Hono, or Fetch-native server consumers;
- preserving the retired filesystem-discovery authoring model;
- performance claims without a reproducible benchmark.

These boundaries keep TypeWeaver focused on contract definition, validation, and projections rather
than becoming a general application framework.

## North-star workflow

1. Author a typed spec entrypoint with resources, operations, requests, responses, and reusable
   definitions.
2. Run one validation command that reports authoring errors and projection limitations before
   publishing output.
3. Select the required projections in configuration.
4. Generate deterministic types, validators, clients, server surfaces, and standards documents.
5. Implement business logic against generated handler contracts and use generated clients from
   consumers and automation.
6. Evolve the source contract, review stable diagnostics and contract changes, regenerate, and let
   compile-time and runtime checks expose affected integrations.

The successful experience has no parallel handwritten contract and no hidden step that only works
inside the TypeWeaver repository.

## Standards and runtime portability

TypeWeaver models HTTP explicitly, authors schemas with Zod, projects schemas through JSON Schema
Draft 2020-12 semantics, and generates OpenAPI 3.1 documents. Exact supported OpenAPI targets and
known representation limits belong in the OpenAPI package documentation.

Repository development and the CLI require Node.js 24. Generated bundles are verified on Node.js,
Deno, and Bun. Fetch-native output avoids framework lock-in; Hono and AWS CDK remain opt-in
projections with their own peer dependencies.

## Effect is optional

Effect 3 improves TypeWeaver's internal orchestration and the plugin lifecycle through typed errors,
resource safety, and composable services. Plugin authors who use `@rexeus/typeweaver-gen`
participate in that lifecycle.

Effect is not required to author a core contract, use a generated client, or implement a generated
Hono or Fetch-native handler. Effect-oriented handler APIs are additive developer surfaces, not a
replacement for the plain promise-based path.

## Measurable success signals

- Every public quickstart and plugin workflow has an executable or typechecked fixture.
- Repository truth checks keep toolchain, package inventory, architecture status, and documentation
  aligned with manifests and implementation.
- Unsupported schema and projection cases produce stable, actionable diagnostics.
- Public request, response, handler, and adapter body defaults pass compile-time checks proving they
  are not `any`.
- The same generated contract passes Node.js, Deno, and Bun bundle checks.
- OpenAPI outputs pass the validator matrix declared for each supported profile.
- A third-party plugin can be scaffolded, tested, and generated using only public packages and
  documentation.
- A generated command-line client completes real success and failure workflows against a local
  TypeWeaver server.
- Required repository and pull-request gates are green at the exact reviewed commit.
