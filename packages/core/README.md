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

---

## 📥 Installation

```bash
npm install @rexeus/typeweaver-core
```

## 💡 How to use

This package is typically consumed by generated code. You also use it when authoring specs via
`defineSpec`, `defineOperation`, and `defineResponse`. To get started with generation, see
[@rexeus/typeweaver](https://github.com/rexeus/typeweaver/tree/main/packages/cli/README.md).

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

## 🏷️ Naming conventions

- `operationId` should use camelCase (preferred), for example `getUser`.
- PascalCase `operationId` values are still supported.
- snake_case and kebab-case `operationId` values are not supported.
- `resourceName` should preferably be a singular noun in camelCase, for example `user` or
  `authSession`.
- Plural and PascalCase `resourceName` values are supported.
- snake_case and kebab-case `resourceName` values are not supported.

## 📄 License

Apache 2.0 © Dennis Wentzien 2026
