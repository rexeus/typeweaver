# 🧵✨ @rexeus/typeweaver-core

[![npm version](https://img.shields.io/npm/v/@rexeus/typeweaver-core.svg)](https://www.npmjs.com/package/@rexeus/typeweaver-core)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)

Typeweaver is a type-safe HTTP API framework built for API-first development with a focus on
developer experience. Use typeweaver to specify your HTTP APIs in TypeScript and Zod, and generate
clients, validators, routers, and more ✨

## 📝 Core Package

Core runtime and authoring types for typeweaver. This package provides the HTTP primitives,
functional spec helpers, validators, and error types that all generators and plugins build on.
Generated code imports these runtime utilities.

The authored spec is the source contract described in the repository
[vision](../../VISION.md#one-contract-many-projections); normalization and generation live in
`@rexeus/typeweaver-gen`.

---

## 📥 Installation

```bash
npm install @rexeus/typeweaver-core
```

## 💡 How to use

This package is typically consumed by generated code. You also use it when authoring specs via
`defineSpec`, `defineOperation`, and `defineResponse`. To get started with generation, see
[@rexeus/typeweaver](https://github.com/rexeus/typeweaver/tree/main/packages/cli/README.md).

Reusable responses can be specialized without duplicating their common contract:

```ts
const TodoNotFoundError = defineDerivedResponse(NotFoundError, {
  name: "TodoNotFoundError",
  description: "Todo not found",
  body: z.object({
    message: z.literal("Todo not found"),
    actualValues: z.object({ todoId: z.string() }),
  }),
});
```

<!-- docs-example: core-response-derivation -->

Imports and the parent response are included in the typechecked
[response-derivation fixture](../cli/examples/documentation/core-response-derivation.ts).

## 🔧 What It Provides

- **HTTP primitives**: `HttpMethod`, `HttpStatusCode`, `IHttpRequest`, `IHttpResponse`,
  `ITypedHttpResponse`.
- **Spec authoring**: `defineSpec`, `defineOperation`, `defineResponse`, `defineDerivedResponse` —
  the functional API for declaring your API contracts.
- **Type guards**: `isTypedHttpResponse` for runtime discrimination of typed response objects.
- **Validation**: `IRequestValidator`, `IResponseValidator`, plus `RequestValidationError` and
  `ResponseValidationError` with structured issues.
- **Utilities**: `UnknownResponseError` for unrecognized responses.

This package does not ship framework adapters. Use plugins like `@rexeus/typeweaver-hono` or
`@rexeus/typeweaver-aws-cdk` for routers/integrations.

## 📄 License

Apache 2.0 © Dennis Wentzien 2026
