# @rexeus/typeweaver-openapi

Pure OpenAPI 3.1.1 document builder for Typeweaver normalized specs.

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

## Warning model

`buildOpenApiDocument` is deterministic and non-throwing for representability issues: it emits the
best OpenAPI document it can and returns warnings beside the document.

- Schema-conversion warnings have `origin: "schema-conversion"` and reuse
  `OpenApiSchemaConversionWarningCode` from the Zod-to-JSON-Schema converter: `unsupported-schema`,
  `unsupported-check`, or `conversion-error`.
- Builder diagnostics have `origin: "openapi-builder"` and use `OpenApiDiagnosticWarningCode`:
  `unrepresentable-parameter-container`, `unrepresentable-parameter-additional-properties`,
  `missing-path-parameter-schema`, `unused-path-parameter-schema`, `duplicate-response-status`, or
  `missing-canonical-response`.
- `schemaPath` is the JSON Pointer inside the converted JSON Schema where a schema-conversion
  warning originated. `documentPath` is the JSON Pointer to the emitted OpenAPI document location
  affected by the warning.
- `location` carries Typeweaver context such as resource, operation, method, source path, normalized
  OpenAPI path, document part, parameter, response, and status code when available.
