# `@rexeus/typeweaver-core`

> Author the executable HTTP contract that every TypeWeaver projection consumes, and use the shared
> runtime types imported by generated code.

[![npm version](https://img.shields.io/npm/v/@rexeus/typeweaver-core.svg)](https://www.npmjs.com/package/@rexeus/typeweaver-core)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](../../LICENSE)

## Choose this package when

Install `@rexeus/typeweaver-core` when you:

- define a TypeWeaver spec;
- consume generated request, response, or validator code;
- need the shared HTTP primitives and structured validation errors.

```bash
pnpm add @rexeus/typeweaver-core zod
```

Generation itself is driven by [`@rexeus/typeweaver`](../cli/README.md).

## Author a contract

A TypeWeaver contract has three main levels:

```text
spec
└── resources
    └── operations
        ├── request definition
        └── response definitions
```

```ts
import {
  defineOperation,
  defineResponse,
  defineSpec,
  HttpMethod,
  HttpStatusCode,
} from "@rexeus/typeweaver-core";
import { z } from "zod";

const GetTodoSuccess = defineResponse({
  name: "GetTodoSuccess",
  statusCode: HttpStatusCode.OK,
  description: "The todo was found",
  body: z.object({
    id: z.uuid(),
    title: z.string(),
    completed: z.boolean(),
  }),
});

const GetTodo = defineOperation({
  operationId: "getTodo",
  method: HttpMethod.GET,
  path: "/todos/:todoId",
  summary: "Get one todo",
  request: {
    param: z.object({ todoId: z.uuid() }),
  },
  responses: [GetTodoSuccess],
});

export const spec = defineSpec({
  metadata: { title: "Todo API", version: "1.0.0" },
  resources: {
    todo: { operations: [GetTodo] },
  },
});
```

The helpers return the values you provide while preserving literal types for generation and
compile-time inference.

## Contract rules

### Specs

`defineSpec` requires:

- `metadata.title`;
- `metadata.version`;
- a resource map.

Each resource key becomes its generated directory name. Prefer singular camelCase names such as
`user` or `authSession`. PascalCase and plural names remain supported for compatibility; snake_case
and kebab-case are rejected during normalization.

Response names must be globally unique across the complete spec.

### Operations

Every `defineOperation` declares:

- a globally unique `operationId`;
- an HTTP method;
- an Express-style path such as `/todos/:todoId`;
- a summary;
- a request object whose `header`, `param`, `query`, and `body` schemas are individually optional;
- at least one declared response.

Prefer camelCase operation IDs. PascalCase remains supported for compatibility; snake_case and
kebab-case are rejected.

Every path placeholder must match a key in `request.param`. Request parts are optional individually:

```ts
const operation = defineOperation({
  // operationId, method, path, summary, and responses omitted here
  request: {
    header: HeaderSchema,
    param: PathSchema,
    query: QuerySchema,
    body: BodySchema,
  },
});
```

The first response is the primary success case used by generators that need one conventional success
result.

### Responses

Use `defineResponse` for a named reusable response:

```ts
const NotFound = defineResponse({
  name: "NotFound",
  statusCode: HttpStatusCode.NOT_FOUND,
  description: "The requested resource was not found",
  body: z.object({ message: z.string() }),
});
```

Create a specialized response without duplicating the common shape:

```ts
import { defineDerivedResponse } from "@rexeus/typeweaver-core";

const TodoNotFound = defineDerivedResponse(NotFound, {
  name: "TodoNotFound",
  description: "The todo was not found",
  body: z.object({ todoId: z.uuid() }),
});
```

<!-- docs-example: core-response-derivation -->

The parent and derived response shapes are typechecked in the
[response derivation fixture](../cli/examples/documentation/core-response-derivation.ts).

Object bodies and structurally compatible object headers are merged. A child schema replaces a
non-object body. Unsupported header merges fail explicitly instead of guessing.

## Metadata and tags

```ts
export const spec = defineSpec({
  metadata: {
    title: "Accounts API",
    version: "2.0.0",
    description: "Account lifecycle operations.",
    tags: [{ name: "accounts", description: "Account management" }],
  },
  resources: {
    account: {
      description: "Create and manage accounts.",
      tags: ["accounts"],
      operations: [CreateAccount, GetAccount],
    },
  },
});
```

Metadata is generator-neutral. Projections such as OpenAPI consume it without becoming the owner of
API identity.

## Security declarations

The core package models HTTP basic and bearer authentication, API keys, OAuth 2, and OpenID Connect
in a generator-neutral contract.

Security requirement semantics are:

- schemes inside one object are combined with **AND**;
- objects inside the requirement array are alternatives combined with **OR**;
- an omitted resource or operation declaration inherits its parent;
- `security: []` marks the scope explicitly public;
- a non-empty declaration replaces the inherited requirement.

These values describe the contract. They do not authenticate requests. Enforcement remains owned by
server middleware, Hono, infrastructure, or application code.

<!-- docs-example: metadata-security-contract -->

The complete metadata and security inheritance contract is typechecked in the
[metadata and security fixture](../cli/examples/documentation/metadata-security.ts).

## Runtime boundary

`IRawHttpRequest` is the unvalidated transport contract: its body is `unknown`, and its query and
header values are raw `string | readonly string[]`. `IHttpResponse.body` is also `unknown`. Bare
`IHttpRequest` defaults are **not** that contract — they describe already validated output, and
generated operation-specific types replace the raw values with the inferred schema type after
validation.

```ts
import type { IHttpResponse } from "@rexeus/typeweaver-core";

function readTextBody(response: IHttpResponse): string | undefined {
  return typeof response.body === "string" ? response.body : undefined;
}
```

Do not read a bare HTTP body without validating or narrowing it first.

### Raw, validated, and client request values

Typeweaver keeps three HTTP request representations separate:

- `IRawHttpRequest` is adapter output. Path values are strings; repeated query and header values are
  readonly string arrays; an unvalidated body is `unknown`.
- `IHttpRequest<Header, Param, Query, Body>` is validated output. Generated request types use each
  Zod schema's output type and keep every property readonly.

Operation-specific `IRaw<OperationId>Request` aliases derive from `IRawHttpRequest` and specialize
only the router-guaranteed path parameters. Query and header stay open transport records with
lowercase/runtime keys and undeclared values possible, and every query/header value is
`string | readonly string[]` regardless of whether the schema produces a scalar or an array.
`method` stays `HttpMethod` because a HEAD request may fall back to a GET route, and the body stays
optional `unknown`. The generated validator performs multiplicity normalization and header-list
handling; a raw handler must narrow those values itself.

- `ClientHttpParam`, `ClientHttpQuery`, and `ClientHttpHeader` accept the domain scalars that a
  generated client can serialize: `string`, finite `number`, `boolean`, `bigint`, and valid `Date`.

Request schemas must accept the raw representation and produce a supported client scalar or scalar
array. For textual HTTP booleans, prefer `z.stringbool()`: it maps values such as `"false"` and
`"0"` to `false`. `z.coerce.boolean()` intentionally retains Zod's JavaScript-truthiness behavior,
so both non-empty strings produce `true`.

Request headers use the separate broad `HttpRequestHeaderSchema` so coercing and domain-output
values are supported. Response headers keep the stack-base transport-safe `HttpHeaderSchema`
(`string`/`string[]` only), unchanged by this work. Open request object containers (`z.looseObject`,
loose/passthrough, and non-`never` catchalls) are rejected in favor of `z.record(...)`, and a bare
`unknown`/`any` pipe input requires its downstream schema to accept the raw value (all
`z.preprocess`/transform pipe inputs are rejected as opaque). Array fields and record values must
keep transport and output cardinality aligned, so schemas with unsupported outputs or mismatched
cardinality are rejected at `defineOperation`. `__proto__` is reserved in every request transport
part and route placeholder, so statically knowable reserved names are rejected at `defineOperation`,
while detectable key pipes/transforms and non-string keys are also rejected. Record key schemas must
preserve each raw key exactly; the generated validator parses every own raw record key with the key
schema before the container parse and reports an explicit issue for overwrites, collisions, and
transformed `__proto__` outputs. Generated clients reject an own `__proto__` param, query, or header
key as `reserved-key`; `constructor` and `toString` remain supported.

Finite request-header record keys (literals, enums, and their unions) are restored to their declared
casing after case-insensitive transport lookup. Non-finite header record keys keep the
lowercase/runtime spelling supplied by Fetch, so their key schema must accept that spelling. Query
record keys remain case-sensitive.

See the [typed HTTP boundary migration guide](../../docs/migrations/typed-http-boundaries.md) for
examples and compatibility guidance.

## Main exports

| Area              | Exports                                                                                                  |
| ----------------- | -------------------------------------------------------------------------------------------------------- |
| Authoring         | `defineSpec`, `defineOperation`, `defineResponse`, `defineDerivedResponse`                               |
| HTTP              | `HttpMethod`, `HttpStatusCode`, `IHttpRequest`, `IHttpResponse`, `ITypedHttpResponse`, `IRawHttpRequest` |
| Validation        | `IRequestValidator`, `IResponseValidator`, `RequestValidationError`, `ResponseValidationError`           |
| Response handling | `isTypedHttpResponse`, `UnknownResponseError`                                                            |
| Contract metadata | API metadata, tags, and security definitions                                                             |

Generated server and client surfaces import these shared contracts, which is why this package is an
application dependency rather than only a generator dependency.

## Boundaries

This package does not:

- run generation;
- provide a web framework or router;
- enforce authentication;
- import OpenAPI definitions;
- implement application business logic.

Use the CLI and plugins to project the contract into those surfaces.

## Related documentation

- [Migration guide](../../MIGRATION.md)
- [Getting started](../../docs/getting-started.md)
- [CLI](../cli/README.md)
- [Generated types and validators](../types/README.md)
- [Project vision](../../VISION.md)

## License

Apache 2.0 © Dennis Wentzien 2026
