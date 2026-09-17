# Typed HTTP request boundaries

Typeweaver now models three distinct representations of request path, query, and header values:

1. adapters produce raw HTTP strings in `IRawHttpRequest`;
2. generated validators return readonly operation-specific `IHttpRequest` values using Zod output
   types;
3. generated clients accept domain scalars and serialize them back to HTTP text.

Operation-specific `IRaw<OperationId>Request` aliases derive from `IRawHttpRequest` and specialize
only the router-guaranteed path parameters. Query and header stay open transport records with
lowercase/runtime keys, undeclared keys, and `string | readonly string[]` values, because adapters
emit exactly what was on the wire and the validated schema cannot promise casing or key membership.
`method` stays `HttpMethod` because a HEAD request may fall back to a GET route, and the body stays
optional `unknown`. A handler that receives a raw request must narrow repeated values and may not
assume the validated output shape.

## Authoring schemas

Each path, query, or request-header field must accept its raw HTTP string representation and produce
a client-serializable scalar. Query and header array schemas may produce readonly scalar arrays. Use
public Zod input/output behavior:

```ts
const request = {
  param: z.object({ metricId: z.coerce.number() }),
  query: z.object({
    enabled: z.stringbool().optional(),
    samples: z.array(z.coerce.number()).optional(),
    at: z
      .string()
      .transform(value => new Date(value))
      .optional(),
  }),
  header: z.object({
    "X-Retry": z.coerce.number().optional(),
  }),
};
```

Prefer `z.stringbool()` for textual booleans: `"false"` and `"0"` become `false`.
`z.coerce.boolean()` is unchanged and follows JavaScript truthiness, so any non-empty input string,
including `"false"`, becomes `true`.

Repeated query keys are preserved in order. An array schema receives a singleton array for one raw
value; a scalar schema rejects repeated raw values. Header names are matched case-insensitively to
the schema's declared casing. Typeweaver does not split scalar header values on commas. Header array
schemas continue to use the comma-separated list representation.

Acceptance is decided by a field's output kind and transport cardinality, not by its schema class. A
field is accepted when its output is a client scalar or readonly scalar array and its raw transport
input can deliver that shape. Transparent public Zod wrappers are unwrapped by both the authoring
check and the runtime normalizer: optional, exact optional, default, catch, readonly, nonoptional,
success, prefault, and a pipe whose input side is an array. Schemas that fail output classification
or whose input/output cardinality disagrees are rejected at `defineOperation` instead of being
accepted with a contract the runtime cannot honor. That covers opaque transforms, nullable outputs,
mixed array/scalar unions, and lazy schemas whose array transport cannot be identified, while
scalar-valued transforms, lazy schemas, and unions with a client scalar output may still be
accepted. Array elements are inspected, so `z.array(z.any())`, `z.array(z.unknown())`,
`z.array(z.never())`, nested arrays, object elements, and nullish elements are rejected for both
object fields and record values.

A bare `unknown`/`any` pipe input delegates raw acceptance to the downstream schema:
`z.unknown().pipe(z.string())`, `z.unknown().pipe(z.coerce.number())`, and their `z.any()`
equivalents are valid, while `z.unknown().pipe(z.number())` and `z.any().pipe(z.number())` are
rejected because the downstream schema does not accept a raw string. Every `z.preprocess`/transform
pipe input is opaque and rejected at `defineOperation`, even when a particular callback would coerce
safely. Ordinary typed string transforms (`z.string().transform(...)`) and array-input pipes remain
valid because their input schema proves raw acceptance.

Open object containers are rejected at `defineOperation`: `z.looseObject`, `.loose()`,
`.passthrough()`, and `.catchall(...)` with a non-`never` value are not truthful request contracts
because the runtime validator strips unknown keys. Use `z.record(...)` for undeclared keys; default
strip objects, `z.strictObject`, `.catchall(z.never())`, and `z.record(...)` remain supported.

Request headers are parsed from raw strings and may coerce or produce domain scalars, arrays, and
records; they use the separate broad `HttpRequestHeaderSchema`. Response headers keep the stack-base
transport-safe `HttpHeaderSchema` contract (`string`/`string[]` only), unchanged by this work. A
generated request validator returns the operation's declared method (so a HEAD request routed to a
GET operation reports `HttpMethod.GET`) and preserves the concrete request `path` unchanged rather
than re-deriving path parameters from it.

Supported `z.object(...)`, optional object, and `z.record(...)` containers are parsed without
turning request defaults into open `unknown` maps. Record normalization is value-schema-aware: a
record whose value schema is an array wraps singleton query/header values, a scalar record rejects
repeated values, and a comma-delimited header string is split only when the record's value schema
requires an array. A record value schema must be a client scalar or scalar array; concrete
`z.unknown()`, `z.any()`, object, `null`, and nested-array record values are rejected at
`defineOperation`, including when wrapped by optional, default, catch, readonly, union, array, or
pipe schemas. Only the exact broad base `z.ZodType` carried by the base `RequestDefinition` escapes
classification. Schema outputs that cannot be represented exactly in OpenAPI use the existing
structured conversion warning.

### Reserved keys and record-key identity

`__proto__` is reserved in every request transport part (param, query, and header) and in every
route placeholder. Statically knowable reserved names are rejected at `defineOperation`: request
object shapes using a `__proto__` key, record key literals/enums containing `__proto__`, and
`:__proto__` route placeholders. Detectable key pipes, transforms, and preprocess schemas, as well
as non-string key inputs/outputs, are also rejected at `defineOperation`; plain `z.string()`, string
refinements and formats, string literals, and string enums are supported.

Record key schemas must preserve each raw key exactly. Zod string mutators (`.trim()`,
`.toLowerCase()`, `.toUpperCase()`) return a plain `ZodString` with an opaque overwrite check that
cannot be detected statically, so the generated validator parses every own raw record key with the
record's key schema before the container parse and reports a custom issue when the key fails
parsing, produces a non-string, changes identity, or resolves to `__proto__`. This closes
overwrites, collisions, and transformed reserved outputs at runtime. `constructor` and `toString`
are ordinary supported keys in records and path parameters. The server router also accumulates path
parameters on a prototype-free map, and generated clients reject an own `__proto__` param, query, or
header key with `RequestSerializationError` reason `reserved-key` before path, URL, or header
construction.

## Client serialization

| Domain value                   | HTTP representation                 |
| ------------------------------ | ----------------------------------- |
| `string`                       | unchanged                           |
| finite `number`                | `String(value)`                     |
| `boolean`                      | `"true"` or `"false"`               |
| `bigint`                       | base-10 string                      |
| valid `Date`                   | `toISOString()`                     |
| `undefined` query/header value | omitted                             |
| query array                    | repeated keys in source order       |
| header array                   | serialized items joined with `", "` |
| empty query array              | rejected with `empty-array`         |
| empty header array             | `""` (empty comma-list)             |
| own `__proto__` query/header   | rejected with `reserved-key`        |

An empty query array has no faithful representation: it would serialize to an absent key, so `[]` is
rejected with `RequestSerializationError` reason `empty-array`, and `undefined` is the way to omit a
key. An empty header array round-trips through the documented comma-list representation as `""`: for
an array header schema the validator normalizes `""` and a comma-only value such as `","` back to
`[]`, while scalar header schemas keep empty and comma-only strings as scalars. An own `__proto__`
param, query, or header key is rejected with `RequestSerializationError` reason `reserved-key`
before path, URL, or header construction; `constructor` and `toString` serialize normally.

A query value of `""` is structurally normalized to `[""]` for an array schema, and Zod owns its
meaning: for example `z.array(z.coerce.number())` parses `""` as `0`.

Path values are serialized before dot-segment protection and percent encoding. Invalid dates,
non-finite numbers, `null`, nested arrays, empty query arrays, objects, functions, symbols, and
other unsupported values throw `RequestSerializationError` before `fetch` is invoked.

## Validation-mode migration

Generated Server and Hono router handler types now reflect `validateRequests`:

| Configuration             | Handler request                             | `validateRequests` option |
| ------------------------- | ------------------------------------------- | ------------------------- |
| omitted or literal `true` | validated generated request                 | optional                  |
| literal `false`           | operation-specific raw request              | required as `false`       |
| dynamic `boolean`         | validated request or operation-specific raw | required as `boolean`     |

A router specialized as `false` or `boolean` must set `validateRequests` explicitly. Otherwise the
declared handler request type would not match the runtime value: an omitted option defaults to
`true`, so a raw type could receive validated output and a union type would not reflect the
configured mode. Literal `true` only accepts `true`, so a statically validated router cannot be
switched to raw requests by mistake.

Code that disables validation must narrow or validate raw strings before using them as domain
values. Middleware and pre-validation contexts always receive `IRawHttpRequest`. Code that invokes a
generated validator directly should pass `IRawHttpRequest`; successful validation returns the exact
generated Zod-output request type.

Response header contracts are unchanged and remain transport-safe (`string | string[]`).
