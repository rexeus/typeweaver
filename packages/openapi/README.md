# @rexeus/typeweaver-openapi

Deterministic, validated OpenAPI 3.1.2 and 3.2.0 projection for TypeWeaver normalized specs.

`3.1.2` is the default compatibility profile. Select `target: "3.2.0"` when every downstream tool
explicitly supports OpenAPI 3.2.

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
        target: "3.2.0",
        servers: [{ url: "https://api.example.com" }],
        outputPath: "openapi/openapi.json",
      },
    ],
  ],
};
```

All options are optional. The defaults are `target: "3.1.2"`, no `servers`, and
`outputPath: "openapi/openapi.json"`. API title, version, description, and reusable tag definitions
come from the generator-neutral `defineSpec({ metadata: ... })` contract, not plugin options.

## Document builder

```ts
import { buildOpenApiDocument } from "@rexeus/typeweaver-openapi";

const result = buildOpenApiDocument(normalizedSpec, {
  target: "3.2.0",
});

console.log(result.document);
console.log(result.warnings);
```

<!-- docs-example: openapi-options -->

Plugin options and the side-effect-free builder call are typechecked in the
[OpenAPI options fixture](../cli/examples/documentation/openapi-options.ts).

The builder has no filesystem side effects. It returns the OpenAPI document and deterministic
warnings for schemas or Typeweaver constructs that cannot be represented exactly.

## Profile support

| Target  | Selection                | Validation                                                                                  | Emitted vocabulary                                                   |
| ------- | ------------------------ | ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `3.1.2` | Default                  | Official OpenAPI 3.1 schema plus Spectral's OAS rules against the generated project fixture | OpenAPI 3.1.2 with JSON Schema Draft 2020-12                         |
| `3.2.0` | `target: "3.2.0"` opt-in | Independent version-aware validation against the official OpenAPI 3.2 schema                | OpenAPI 3.2.0 using the feature subset shared with the 3.1.2 profile |

Both profiles project the same TypeWeaver contract. The 3.1.2 profile never emits 3.2-only fields.
The current 3.2.0 profile changes the declared OpenAPI version but intentionally does not invent
3.2-only data that has no TypeWeaver contract source.

OpenAPI 3.1.1 output is replaced by the 3.1.2 compatibility default. Remove `info` from plugin or
builder options, move that identity into spec metadata, and use `target` only when selecting 3.2.0.
See the
[migration guide](../../MIGRATION.md#5-openapi-target-profiles-and-spec-owned-identity-breaking).

## Support matrix

### Supported

| TypeWeaver contract feature                        | OpenAPI projection                                                                             |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| metadata title, version, and description           | root `info`                                                                                    |
| reusable tag names and descriptions                | root `tags`                                                                                    |
| operation summary, description, tags, deprecation  | Operation Object fields                                                                        |
| HTTP basic and bearer security                     | `components.securitySchemes` with optional bearer format                                       |
| API keys in headers, query parameters, and cookies | `components.securitySchemes` type `apiKey`                                                     |
| OAuth2 flows and declared scopes                   | `components.securitySchemes` type `oauth2`                                                     |
| OpenID Connect discovery URLs                      | `components.securitySchemes` type `openIdConnect`                                              |
| inherited or overridden security requirements      | root and operation `security`; AND within an object, OR between array entries                  |
| explicitly public operations                       | operation `security: []`                                                                       |
| path, query, and header parameters                 | ordered Parameter Objects                                                                      |
| request and response bodies                        | media-type content with schemas under `components.schemas`                                     |
| canonical and inline responses                     | response components/references; duplicate inline status variants merge deterministically       |
| server URLs and variables                          | root `servers`, supplied as a projection option                                                |
| supported Zod-to-JSON-Schema constructs            | JSON Schema Draft 2020-12; reusable schemas use deterministic component names and local `$ref` |

### Lossy with diagnostics

These cases still produce the best deterministic document available. The builder returns a warning,
and the plugin's side-effect-free `validate` hook maps it to a stable `TW-PLUGIN-OPENAPI-*` issue
without writing files.

| Contract or schema shape                             | Projection behavior                                      | Stable issue                |
| ---------------------------------------------------- | -------------------------------------------------------- | --------------------------- |
| resource description spanning multiple paths         | description is omitted; operation descriptions remain    | `TW-PLUGIN-OPENAPI-010`     |
| non-finite path/query/header parameter container     | container cannot become a finite parameter list          | `TW-PLUGIN-OPENAPI-001`     |
| parameter object with additional properties          | named properties project; catch-all entries do not       | `TW-PLUGIN-OPENAPI-002`     |
| missing or unused path-parameter schema              | best available path parameter list is emitted            | `TW-PLUGIN-OPENAPI-003/004` |
| missing or duplicated canonical response declaration | available response shape is retained deterministically   | `TW-PLUGIN-OPENAPI-005/006` |
| unsupported schema, check, or conversion failure     | JSON Schema is broadened only as reported by the warning | `TW-PLUGIN-OPENAPI-007–009` |

### Out of scope

- TypeWeaver does not import OpenAPI documents.
- TypeWeaver does not provide bidirectional Zod/OpenAPI/Effect Schema round-tripping.
- Callbacks, webhooks, links, arbitrary OpenAPI extensions, and 3.2-specific additions without a
  generator-neutral TypeWeaver source are not generated.
- Authentication providers and authorization enforcement are not generated. Security declarations
  describe the contract only.
- Arbitrary `Authorization` headers are not guessed into security schemes. Declare security once in
  `defineSpec`.

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
- If multiple distinct body schema `$ref`s are present, the merged response uses `anyOf`.
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

## Warning model

`buildOpenApiDocument` is deterministic and non-throwing for representability issues: it emits the
best OpenAPI document it can and returns warnings beside the document. `openApiPlugin().validate`
maps those warnings to structured issues; `generate` writes only the document and does not duplicate
validation results as ad-hoc log text.

- Schema-conversion warnings have `origin: "schema-conversion"` and reuse
  `OpenApiSchemaConversionWarningCode` from the Zod-to-JSON-Schema converter: `unsupported-schema`,
  `unsupported-check`, or `conversion-error`.
- Builder diagnostics have `origin: "openapi-builder"` and use `OpenApiDiagnosticWarningCode`:
  `unrepresentable-parameter-container`, `unrepresentable-parameter-additional-properties`,
  `missing-path-parameter-schema`, `unused-path-parameter-schema`, `missing-canonical-response`,
  `duplicate-canonical-response`, or `unrepresentable-resource-description`.
- `OPENAPI_WARNING_ISSUE_REGISTRY` maps every exported warning code exhaustively to stable
  `TW-PLUGIN-OPENAPI-001` through `TW-PLUGIN-OPENAPI-010` codes.
- `schemaPath` is the JSON Pointer inside the converted JSON Schema where a schema-conversion
  warning originated. `documentPath` is the JSON Pointer to the emitted OpenAPI document location
  affected by the warning.
- `location` carries Typeweaver context such as resource, operation, method, source path, normalized
  OpenAPI path, document part, parameter, response, and status code when available.
