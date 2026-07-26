# ADR 0009: Generator-Neutral API Metadata and Security Contract

## Status

Accepted

## Context

TypeWeaver previously accepted only a resource map at the spec boundary. Human-facing API metadata
was supplied separately to the OpenAPI plugin, and security schemes were intentionally unsupported.
That made the OpenAPI projection the accidental owner of information that clients, servers, command
surfaces, and documentation generators also need.

Issue #169 requires one generator-neutral source of truth. The contract must describe security
without enforcing authentication, preserve OpenAPI-compatible AND/OR semantics without using OpenAPI
as the core vocabulary, and distinguish inheritance from an explicitly public operation. It must
also remain deterministic and statically useful to TypeScript consumers.

## Decision

### API metadata

`defineSpec` requires a `metadata` object:

```ts
export type ApiTagDefinition = {
  readonly name: string;
  readonly description?: string;
};

export type ApiMetadataDefinition = {
  readonly title: string;
  readonly version: string;
  readonly description?: string;
  readonly tags?: readonly ApiTagDefinition[];
};
```

`title` and `version` are required because every public projection needs a truthful identity.
Reusable tag definitions live at spec level. Resources and operations reference tags by name:

```ts
export const spec = defineSpec({
  metadata: {
    title: "Todo API",
    version: "1.0.0",
    description: "Manage todos",
    tags: [{ name: "todos", description: "Todo operations" }],
  },
  resources: {
    todo: {
      description: "Todo lifecycle",
      tags: ["todos"],
      operations: [listTodos],
    },
  },
});

export const listTodos = defineOperation({
  // existing fields
  description: "Lists visible todos",
  deprecated: false,
  tags: ["todos"],
});
```

Resource tags are inherited by operations. Normalization produces a deterministic, de-duplicated
operation tag list in resource-then-operation order. Unknown tag references are invalid.

### Security schemes

Security schemes are a readonly array so duplicate names remain observable and rejectable:

```ts
export type SecuritySchemeDefinition =
  | {
      readonly name: string;
      readonly kind: "http";
      readonly scheme: "basic" | "bearer";
      readonly bearerFormat?: string;
      readonly description?: string;
    }
  | {
      readonly name: string;
      readonly kind: "apiKey";
      readonly credentialName: string;
      readonly location: "header" | "query" | "cookie";
      readonly description?: string;
    }
  | {
      readonly name: string;
      readonly kind: "oauth2";
      readonly flows: OAuth2FlowsDefinition;
      readonly description?: string;
    }
  | {
      readonly name: string;
      readonly kind: "openIdConnect";
      readonly discoveryUrl: string;
      readonly description?: string;
    };
```

OAuth2 supports the standard implicit, password, client-credentials, and authorization-code flows.
Flow URLs use neutral `authorizationUrl`, `tokenUrl`, and `refreshUrl` terms because they describe
the protocol itself, not an output format. Each flow owns a readonly scope-description map.

Scheme names must be unique and non-empty. OAuth2 must declare at least one flow. OAuth2 and OpenID
Connect URLs must be absolute HTTP or HTTPS URLs. API-key credential names must be non-empty.

### Requirements and inheritance

A security requirement is a readonly record from scheme name to required scopes:

```ts
export type SecurityRequirement = Readonly<Record<string, readonly string[]>>;

export type SecurityRequirements = readonly SecurityRequirement[];
```

Entries inside one requirement object are ANDed. Multiple objects in the array are alternatives and
therefore ORed. An empty scope array means the named scheme is required without named scopes. OAuth2
scopes must exist in that scheme's declared flows. HTTP and API-key requirements must use an empty
scope array. OpenID Connect scopes may be discovered externally and are not restricted to a
checked-in list.

The same optional `security` field exists at spec, resource, and operation level:

| Declaration at current level | Meaning                                          |
| ---------------------------- | ------------------------------------------------ |
| omitted / `undefined`        | inherit the nearest ancestor declaration         |
| `[]`                         | explicitly public; do not inherit                |
| non-empty array              | replace the inherited requirements at this level |

The complete resolution table is:

| Spec      | Resource  | Operation | Effective operation security | Source      |
| --------- | --------- | --------- | ---------------------------- | ----------- |
| omitted   | omitted   | omitted   | `[]`                         | `none`      |
| non-empty | omitted   | omitted   | spec value                   | `spec`      |
| non-empty | `[]`      | omitted   | `[]`                         | `resource`  |
| non-empty | non-empty | omitted   | resource value               | `resource`  |
| any       | any       | `[]`      | `[]`                         | `operation` |
| any       | any       | non-empty | operation value              | `operation` |

Normalization represents the resolved result explicitly:

```ts
export type NormalizedSecurity = {
  readonly requirements: SecurityRequirements;
  readonly source: "none" | "spec" | "resource" | "operation";
};
```

`NormalizedSpec`, `NormalizedResource`, and `NormalizedOperation` each carry a resolved
`NormalizedSecurity`. A zero-length requirement list with source `resource` or `operation` is an
explicit public override; source `none` means no ancestor declared security. This preserves enough
source truth for diagnostics while allowing generators to consume one effective value.

### Validation

Normalization rejects:

- duplicate scheme or tag names;
- unknown tag and security-requirement references;
- empty scheme names or API-key credential names;
- missing OAuth2 flows, invalid OAuth2 scopes, or scopes on HTTP/API-key schemes;
- malformed or non-HTTP(S) OAuth2 and OpenID Connect URLs; and
- an authored `Authorization` request header that rejects representative credentials required by an
  effective HTTP basic or bearer scheme.

An explicitly authored `Authorization` header is otherwise allowed. This lets a spec add validation
or documentation without creating a parallel security source. The normalizer never invents auth
headers and never enforces authentication.

### OpenAPI projection

The mapping is lossless for the accepted vocabulary:

| TypeWeaver contract                    | OpenAPI projection                       |
| -------------------------------------- | ---------------------------------------- |
| spec metadata                          | `info` and root `tags`                   |
| HTTP basic/bearer                      | `components.securitySchemes` type `http` |
| API key                                | type `apiKey`, mapped name and location  |
| OAuth2 flows                           | type `oauth2` and corresponding flows    |
| OpenID Connect discovery URL           | type `openIdConnect`                     |
| normalized operation requirements      | operation `security`                     |
| explicit public operation              | operation `security: []`                 |
| operation description/deprecation/tags | matching operation fields                |

OpenAPI plugin options no longer own API identity. They may control projection concerns such as
target profile, servers, and output path. Any temporary compatibility option must be documented and
must not silently override the authored contract.

### Client and server implications

Generated clients may use scheme names and locations to expose credential configuration, but that
surface belongs to Plan 003. Fetch/Hono server generators may expose the normalized metadata to
middleware or application code, but this ADR does not add authentication or authorization
enforcement. A generator must consume normalized security rather than reinterpret authoring
inheritance.

### Migration

Existing specs add required metadata:

```ts
// Before
defineSpec({ resources });

// After
defineSpec({
  metadata: { title: "My API", version: "1.0.0" },
  resources,
});
```

OpenAPI users move title, version, description, and reusable tag definitions from plugin options to
the spec. Security declarations are additive unless a consumer chooses to adopt them. The concrete
pre-1.0 migration and Changesets ship with the implementation.

## Non-Goals

- Authentication providers, credential storage, authorization enforcement, roles, and policy
  engines.
- OpenAPI-only annotations, an OpenAPI importer, or bidirectional round-tripping.
- Automatic inference of security from arbitrary request-header schemas.
- A native Effect `HttpApi` backend or Effect Schema as a second contract authority.
- Custom security schemes whose semantics cannot be projected consistently to both accepted OpenAPI
  targets.

## Consequences

- Every generator receives the same validated metadata and effective security.
- Required spec metadata is a deliberate pre-1.0 breaking change with a mechanical migration.
- Explicit source tracking prevents public overrides from collapsing into accidental absence.
- The accepted scheme vocabulary maps to OpenAPI 3.1.2 and 3.2.0 without core-model loss.
- Future generators must consume the normalized form and must not independently implement
  inheritance.

## Reference Files

- Authoring contract: `packages/core/src/ApiMetadata.ts`, `packages/core/src/SecurityDefinition.ts`,
  `packages/core/src/defineSpec.ts`, and `packages/core/src/defineOperation.ts`
- Normalized contract: `packages/gen/src/NormalizedSpec.ts` and `packages/gen/src/normalizeSpec.ts`
- OpenAPI projection: `packages/openapi/src/`
- Product contract: `GOAL.md` and `plans/002-contract-and-openapi-maturity.md`
