# 🧵✨ @rexeus/typeweaver-core

[![npm version](https://img.shields.io/npm/v/@rexeus/typeweaver-core.svg)](https://www.npmjs.com/package/@rexeus/typeweaver-core)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)

Typeweaver is a type-safe HTTP API framework built for API-first development with a focus on
developer experience. Use typeweaver to specify your HTTP APIs in TypeScript and Zod, and generate
clients, validators, routers, and more ✨

## 📝 Core Package

Core runtime and definition types for typeweaver. This package provides the HTTP primitives,
definition classes, validators, and error types that all generators and plugins build on. The
generated code imports these runtime utilities.

---

## 📥 Installation

```bash
npm install @rexeus/typeweaver-core
```

## 💡 How to use

This package is typically consumed by generated code. You can also import HTTP primitives (e.g.,
`HttpResponse`, `HttpStatusCode`) directly in your application code. To get started with generation,
see [@rexeus/typeweaver](https://github.com/rexeus/typeweaver/tree/main/packages/cli/README.md).

## 🔧 What It Provides

- HTTP primitives: `HttpMethod`, `HttpStatusCode`, `IHttpRequest`, `IHttpResponse`, `HttpResponse`.
- Definitions: `HttpOperationDefinition`, `HttpRequestDefinition`, `HttpResponseDefinition` (incl.
  `extend()` for composing headers/bodies).
- Validation: `IRequestValidator`, `IResponseValidator`, plus `RequestValidationError` and
  `ResponseValidationError` with structured issues.
- Utilities: `UnknownResponse` for catch‑all responses.

This package does not ship framework adapters. Use plugins like `@rexeus/typeweaver-hono` or
`@rexeus/typeweaver-aws-cdk` for routers/integrations.

## 📄 License

Apache 2.0 © Dennis Wentzien 2026
