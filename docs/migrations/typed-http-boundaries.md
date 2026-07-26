# Typed HTTP request boundaries

Typeweaver now models three distinct representations of request path, query, and header values:

1. adapters produce raw HTTP strings in `IRawHttpRequest`;
2. generated validators return readonly operation-specific `IHttpRequest` values using Zod output
   types;
3. generated clients accept domain scalars and serialize them back to HTTP text.

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

Supported `z.object(...)`, optional object, and `z.record(...)` containers are parsed without
turning request defaults into open `unknown` maps. Schema outputs that cannot be represented exactly
in OpenAPI use the existing structured conversion warning.

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

Path values are serialized before dot-segment protection and percent encoding. Invalid dates,
non-finite numbers, `null`, nested arrays, objects, functions, symbols, and other unsupported values
throw `RequestSerializationError` before `fetch` is invoked.

## Validation-mode migration

Generated Server and Hono router handler types now reflect `validateRequests`:

| Configuration             | Handler request                |
| ------------------------- | ------------------------------ |
| omitted or literal `true` | validated generated request    |
| literal `false`           | operation-specific raw request |
| dynamic `boolean`         | operation-specific raw request |

Code that disables validation must narrow or validate raw strings before using them as domain
values. Middleware and pre-validation contexts always receive `IRawHttpRequest`. Code that invokes a
generated validator directly should pass `IRawHttpRequest`; successful validation returns the exact
generated Zod-output request type.

Response header contracts are unchanged and remain transport-safe (`string | string[]`).
