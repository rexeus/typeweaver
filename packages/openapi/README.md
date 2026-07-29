# `@rexeus/typeweaver-openapi`

> Project a validated TypeWeaver contract into a deterministic OpenAPI 3.1.2 or 3.2.0 document—and
> receive structured diagnostics wherever the target cannot preserve the source exactly.

[![npm version](https://img.shields.io/npm/v/@rexeus/typeweaver-openapi.svg)](https://www.npmjs.com/package/@rexeus/typeweaver-openapi)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](../../LICENSE)

## Choose this projection when

Use `openapi` when API documentation, gateways, client generators, contract tests, or governance
tooling need a standards-based view of the same contract your TypeScript code uses.

The OpenAPI document is a projection, not a second source of truth. API identity, descriptions,
tags, operations, schemas, responses, and security declarations remain in the TypeWeaver contract.

## Generate a document

The first-party plugin ships with the TypeWeaver CLI:

```bash
pnpm add -D @rexeus/typeweaver
pnpm add @rexeus/typeweaver-core zod
```

Select it in `typeweaver.config.mjs`:

```js
export default {
  input: "./api/spec/index.ts",
  output: "./api/generated",
  plugins: [
    [
      "openapi",
      {
        target: "3.1.2",
        servers: [{ url: "https://api.example.com" }],
        outputPath: "openapi/openapi.json",
      },
    ],
  ],
};
```

<!-- docs-example: openapi-options -->

The plugin options and side-effect-free builder call are typechecked in the
[OpenAPI fixture](../cli/examples/documentation/openapi-options.ts).

Then validate and generate:

```bash
pnpm typeweaver validate --config ./typeweaver.config.mjs
pnpm typeweaver generate --config ./typeweaver.config.mjs
```

All plugin options are optional:

| Option       | Default                  | Meaning                                               |
| ------------ | ------------------------ | ----------------------------------------------------- |
| `target`     | `"3.1.2"`                | OpenAPI compatibility profile: `"3.1.2"` or `"3.2.0"` |
| `servers`    | omitted                  | Root OpenAPI server declarations                      |
| `outputPath` | `"openapi/openapi.json"` | Path relative to the configured generation output     |

The API title, version, summary, description, terms of service, reusable tags, and security schemes
come from `defineSpec({ metadata: ... })`. They are contract data, not plugin configuration.

## Choose the target deliberately

| Target  | Use it when                                                       | Schema dialect            |
| ------- | ----------------------------------------------------------------- | ------------------------- |
| `3.1.2` | downstream tooling needs the safest current compatibility profile | JSON Schema Draft 2020-12 |
| `3.2.0` | every consumer explicitly supports OpenAPI 3.2                    | JSON Schema Draft 2020-12 |

`3.1.2` is the default. OpenAPI 3.1.1 is not emitted as a separate profile. Select `target: "3.2.0"`
only when every downstream consumer explicitly supports it.

The 3.2 profile does not manufacture 3.2-only fields that have no TypeWeaver source. Both profiles
project the same normalized contract.

## Support matrix

### Supported

The document can represent:

- API identity and reusable tag definitions;
- operation summaries, descriptions, tags, and deprecation;
- path, query, and header parameters;
- request and response bodies;
- canonical and inline responses;
- HTTP Basic, Bearer, API key, OAuth 2, and OpenID Connect security schemes;
- inherited, overridden, and explicitly public security requirements;
- supported Zod schemas as JSON Schema Draft 2020-12;
- optional server URLs supplied by the projection configuration.

Security declarations remain descriptive. This plugin does not create an identity provider or
enforce authorization.

### Lossy with diagnostics

Some TypeScript or Zod constructs cannot be represented faithfully in OpenAPI. TypeWeaver still
builds the best deterministic document it can, but validation emits a structured issue with a stable
`TW-PLUGIN-OPENAPI-*` code.

Typical examples include:

| Source shape                                                      | Projection behavior                                                  |
| ----------------------------------------------------------------- | -------------------------------------------------------------------- |
| a parameter container that is not a finite named object           | cannot become an OpenAPI parameter list                              |
| catch-all parameter properties                                    | named fields project; catch-all entries do not                       |
| a missing or unused path-parameter schema                         | best available path definition is emitted                            |
| unsupported Zod behavior such as transforms or custom refinements | JSON Schema is broadened and the loss is reported                    |
| one resource description spread across multiple OpenAPI paths     | resource-level description is omitted; operation descriptions remain |

Run validation before generation and treat warnings according to your delivery policy:

```bash
# Fail CI on projection warnings as well as errors
pnpm typeweaver validate --strict

# Consume the versioned report in automation
pnpm typeweaver validate --json > typeweaver-validation.json
```

Diagnostics include the affected contract location and OpenAPI document path when available.

### Out of scope

- TypeWeaver does not import OpenAPI documents.
- TypeWeaver does not provide bidirectional Zod/OpenAPI/Effect Schema round-tripping.
- Callbacks, webhooks, links, arbitrary OpenAPI extensions, and 3.2-specific additions without a
  generator-neutral TypeWeaver source are not generated.
- Authentication providers and authorization enforcement are not generated. Security declarations
  describe the contract only.
- Arbitrary `Authorization` headers are not guessed into security schemes. Declare security once in
  `defineSpec`.

## Duplicate response status codes

TypeWeaver response names are richer than an OpenAPI response map, which has one entry per status
code. When several declared responses share a status, the projection merges them deterministically:

- descriptions identify the contributing response variants;
- distinct body schemas become `anyOf` entries;
- headers are merged by emitted name;
- a header stays required only when every contributing variant requires it.

This preserves the strongest representable document while the generated TypeScript surfaces retain
their named response union.

## Build a document in memory

Tooling that already owns a `NormalizedSpec` can use the side-effect-free builder directly:

```bash
pnpm add @rexeus/typeweaver-openapi @rexeus/typeweaver-gen effect zod
```

```ts
import { buildOpenApiDocument } from "@rexeus/typeweaver-openapi";

const result = buildOpenApiDocument(normalizedSpec, {
  target: "3.1.2",
  servers: [{ url: "https://api.example.com" }],
});

console.log(result.document);

for (const warning of result.warnings) {
  console.warn(warning.code, warning.documentPath, warning.message);
}
```

The builder does not write files. Representability problems are returned in `warnings`; the
generator plugin maps them to TypeWeaver issues during its write-free validation phase.

## Related documentation

- [Migration guide](../../MIGRATION.md)
- [Getting started](../../docs/getting-started.md)
- [Contract authoring](../core/README.md)
- [Zod to JSON Schema](../zod-to-json-schema/README.md)
- [CLI validation and reports](../cli/README.md)
- [Plugin authoring](../../docs/plugin-authoring.md)

## License

Apache 2.0 © Dennis Wentzien 2026
