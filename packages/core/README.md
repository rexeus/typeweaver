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

### API metadata and security

Every `defineSpec` call declares `metadata.title` and `metadata.version`; it may also declare a
description and reusable tags. Security schemes are generator-neutral discriminated unions for HTTP
basic/bearer, API keys, OAuth2, and OpenID Connect.

Security requirements use AND within one object and OR between array entries. An omitted resource or
operation security declaration inherits its parent, `security: []` makes that scope explicitly
public, and a non-empty array replaces the inherited requirement. These declarations describe the
contract; they do not enforce authentication.

<!-- docs-example: metadata-security-contract -->

The full authoring shape is typechecked in the
[metadata/security fixture](../cli/examples/documentation/metadata-security.ts) and specified by
[ADR 0009](../../docs/adr/0009-api-metadata-and-security-contract.md).

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
  `ITypedHttpResponse`, and `IRawHttpRequest`.
- **Spec authoring**: `defineSpec`, `defineOperation`, `defineResponse`, `defineDerivedResponse`,
  metadata, tags, and generator-neutral security declarations.
- **Type guards**: `isTypedHttpResponse` for runtime discrimination of typed response objects.
- **Validation**: `IRequestValidator`, `IResponseValidator`, plus `RequestValidationError` and
  `ResponseValidationError` with structured issues.
- **Utilities**: `UnknownResponseError` for unrecognized responses.

### HTTP body boundary

The unvalidated `IHttpBody` boundary is `unknown`. Generated request and response declarations
replace it with the type derived from each operation's Zod schema. Code that handles a bare
`IHttpRequest` or `IHttpResponse` must validate or narrow `body` before reading it:

```ts
function readTextBody(response: IHttpResponse): string | undefined {
  return typeof response.body === "string" ? response.body : undefined;
}
```

Fetch-native adapters preserve strings, `ArrayBuffer`, and `Blob` values and JSON-serialize other
supported response values. They reject values that `JSON.stringify` cannot represent instead of
silently producing an empty response.

### Raw, validated, and client request values

Typeweaver keeps three HTTP request representations separate:

- `IRawHttpRequest` is adapter output. Path values are strings; repeated query and header values are
  readonly string arrays; an unvalidated body is `unknown`.
- `IHttpRequest<Header, Param, Query, Body>` is validated output. Generated request types use each
  Zod schema's output type and keep every property readonly.
- `ClientHttpParam`, `ClientHttpQuery`, and `ClientHttpHeader` accept the domain scalars that a
  generated client can serialize: `string`, finite `number`, `boolean`, `bigint`, and valid `Date`.

Request schemas must accept the raw representation and produce a supported client scalar or scalar
array. For textual HTTP booleans, prefer `z.stringbool()`: it maps values such as `"false"` and
`"0"` to `false`. `z.coerce.boolean()` intentionally retains Zod's JavaScript-truthiness behavior,
so both non-empty strings produce `true`.

See the [typed HTTP boundary migration guide](../../docs/migrations/typed-http-boundaries.md) for
examples and compatibility guidance.

This package does not ship framework adapters. Use plugins like `@rexeus/typeweaver-hono` or
`@rexeus/typeweaver-aws-cdk` for routers/integrations.

## 📄 License

Apache 2.0 © Dennis Wentzien 2026
