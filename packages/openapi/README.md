# @rexeus/typeweaver-openapi

Pure OpenAPI 3.1.1 document builder for Typeweaver normalized specs.

## Generator plugin

Use the `openapi` plugin to emit `openapi/openapi.json` during Typeweaver generation:

```js
export default {
  input: "./api/spec/index.ts",
  output: "./api/generated",
  plugins: [
    [
      "openapi",
      {
        info: { title: "Todo API", version: "1.0.0" },
        servers: [{ url: "https://api.example.com" }],
        outputPath: "openapi/openapi.json",
      },
    ],
  ],
};
```

All options are optional. Defaults are `info: { title: "Typeweaver API", version: "0.0.0" }`, no
servers, and `outputPath: "openapi/openapi.json"`. Build warnings are printed to stderr and are not
embedded in the OpenAPI document.

## Document builder

```ts
import { buildOpenApiDocument } from "@rexeus/typeweaver-openapi";

const result = buildOpenApiDocument(normalizedSpec, {
  info: { title: "Todo API", version: "1.0.0" },
});

console.log(result.document);
console.log(result.warnings);
```

The builder has no filesystem side effects. It returns the OpenAPI document and deterministic
warnings for schemas or Typeweaver constructs that cannot be represented exactly.

## Schema dialect and normalization

Emitted OpenAPI documents set `jsonSchemaDialect` to JSON Schema Draft 2020-12. To improve validator
and tooling compatibility, JSON Schema `const` values are emitted as single-value `enum` arrays;
this preserves the same accepted value semantics.

Request and response body schemas are registered under `components.schemas` and body content uses
`$ref` entries. Reused Zod schema objects share one component schema; separate schemas that request
the same component name receive deterministic `_2`, `_3`, ... suffixes.

## Duplicate response statuses

When an operation declares multiple responses with the same HTTP status, the builder merges them
into one inline OpenAPI response. The merged response description lists each variant as
`<ResponseName>: <description>`, separated by blank lines.

- If no variant has a body schema, the merged response omits `content`.
- If exactly one distinct body schema `$ref` is present, the merged response uses that `$ref`
  directly.
- If multiple distinct body schema `$ref`s are present, the merged response uses `oneOf`.
- Headers merge by emitted header name and are included when present in at least one variant.
- A merged header is `required: true` only when the header appears in every response variant and is
  required in every variant; otherwise it is `required: false`.
- If a merged header has one distinct schema form, that schema is used directly.
- If a merged header has multiple distinct schema forms, the header schema uses `anyOf`.
- If every header-bearing variant has the same non-empty header description, that description is
  kept.
- If header descriptions differ, the description is exactly
  `Header description merged from response variants:` followed by bullet lines for variants with
  descriptions, such as `- ValidationError: Correlation ID for validation failures.`
- If no variant describes the header, the merged header omits `description`.

Security schemes are not inferred yet. The current plugin does not derive
`components.securitySchemes` or operation `security` from `Authorization` headers; consumers that
need those fields can post-process the generated document for now.

## Warning model

`buildOpenApiDocument` is deterministic and non-throwing for representability issues: it emits the
best OpenAPI document it can and returns warnings beside the document.

- Schema-conversion warnings have `origin: "schema-conversion"` and reuse
  `OpenApiSchemaConversionWarningCode` from the Zod-to-JSON-Schema converter: `unsupported-schema`,
  `unsupported-check`, or `conversion-error`.
- Builder diagnostics have `origin: "openapi-builder"` and use `OpenApiDiagnosticWarningCode`:
  `unrepresentable-parameter-container`, `unrepresentable-parameter-additional-properties`,
  `missing-path-parameter-schema`, `unused-path-parameter-schema`, or `missing-canonical-response`.
- `schemaPath` is the JSON Pointer inside the converted JSON Schema where a schema-conversion
  warning originated. `documentPath` is the JSON Pointer to the emitted OpenAPI document location
  affected by the warning.
- `location` carries Typeweaver context such as resource, operation, method, source path, normalized
  OpenAPI path, document part, parameter, response, and status code when available.
