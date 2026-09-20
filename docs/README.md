# TypeWeaver documentation

Use this page to move from the product overview to the guide or package reference that owns your
question. TypeWeaver's READMEs are task- and concept-oriented guides; the published TypeScript
declarations remain the exact signature reference for every export.

## Start here

- [Product overview](../README.md) — understand the contract-first workflow and choose a projection.
- [Getting started](./getting-started.md) — scaffold or manually build a Todo API, then generate,
  call, and serve it.
- [Vision](../VISION.md) — read the product promise, boundaries, and non-goals.
- [Migration guide](../MIGRATION.md) — adapt applications to public contract changes.

## Author and operate a contract

- [Core contract](../packages/core/README.md) — specs, resources, operations, requests, responses,
  metadata, and security declarations.
- [CLI](../packages/cli/README.md) — scaffold, validate, generate, diagnose, and automate.
- [Generated types and validators](../packages/types/README.md) — request and response types,
  validation behavior, and structured errors.
- [Troubleshooting](./getting-started.md#diagnose-common-failures) — start with `typeweaver doctor`
  and common generation failures.

## Client projections

- [Fetch clients](../packages/clients/README.md) — generated resource clients, request commands,
  transport behavior, validation, and cancellation.
- [Command-line client](../packages/command/README.md) — generate deterministic Node.js commands
  from the client projection.

## Server projections

- [Fetch-native server](../packages/server/README.md) — portable routers, typed handlers,
  middleware, and configurable validation.
- [Hono](../packages/hono/README.md) — generated Hono routers over the same contract.
- [Effect](../packages/effect/README.md) — optional Effect-returning adapters over the Fetch-native
  handler contract.

## Documentation and infrastructure projections

- [OpenAPI](../packages/openapi/README.md) — validated OpenAPI 3.1.2 and 3.2.0 documents, projection
  loss, and diagnostics.
- [AWS CDK](../packages/aws-cdk/README.md) — HTTP API route helpers with integrations,
  authorization, and stack ownership left to the application.

## Plugin and schema tooling

- [Plugin authoring](./plugin-authoring.md) — build, test, and scaffold a third-party projection.
- [Generator SDK](../packages/gen/README.md) — normalized model, lifecycle, services, diagnostics,
  output safety, and test kit.
- [Zod to TypeScript](../packages/zod-to-ts/README.md) — supported TypeScript projections and
  unsupported schema behavior.
- [Zod to JSON Schema](../packages/zod-to-json-schema/README.md) — supported JSON Schema
  projections, loss, and diagnostics.

## Runtime and peer support

| Surface                  | Documented baseline or peer contract                                              |
| ------------------------ | --------------------------------------------------------------------------------- |
| Repository and CLI       | Node.js 24                                                                        |
| Fetch-native server      | Standard `Request`/`Response` hosts                                               |
| Generated command client | Node.js                                                                           |
| Hono integration         | Hono `>=4.11.0 <5`                                                                |
| Effect adapter           | Exact `effect@4.0.0-rc.116` peer                                                  |
| Native Effect surfaces   | Exact `effect@4.0.0-rc.116`; core and plain generated consumption remain optional |
| Zod authoring/converters | Zod `>=4.3.0 <5`                                                                  |

Runtime support is projection-specific. Check the selected package guide before deployment; a
runtime used by one generated surface is not automatically supported by every other surface.

The CLI programmatic API, `@rexeus/typeweaver-gen` plugin authoring, first-party generator packages
(including `command`, `hono`, and `openapi`), and `@rexeus/typeweaver-effect` require the exact
native `effect@4.0.0-rc.116` identity. The generated client, Fetch-native server, Hono and command
runtime outputs, and OpenAPI JSON remain Effect-optional because they do not import Effect. See
[ADR 0008](./adr/0008-effect-4-baseline.md) and its superseded historical record
[ADR 0010](./adr/0010-effect-4-workspace-compatibility.md).

## Maintainer references

- [Architecture decisions](./adr/) — accepted design decisions and version baselines.
- [TypeScript compiler profiles](../packages/tsconfig/README.md) — private shared profiles, adopted
  strict flags, intended consumers, and the checked-JavaScript scope.
- [Maintainability inventory](./maintainability-inventory.md) — exact lint thresholds, type-aware
  semantic rules, suppression governance, generated-code policy, and executable contracts.
