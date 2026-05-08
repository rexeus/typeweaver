---
"@rexeus/typeweaver-zod-to-ts": patch
"@rexeus/typeweaver-clients": patch
"@rexeus/typeweaver-server": patch
"@rexeus/typeweaver-types": patch
"@rexeus/typeweaver-core": patch
"@rexeus/typeweaver-hono": patch
"@rexeus/typeweaver": patch
"@rexeus/typeweaver-gen": patch
---

Harden runtime, generator, client, CLI, and build-boundary contracts across Typeweaver.

This release strengthens fail-closed behavior for malformed requests, malformed responses,
ambiguous headers, unsafe path values, stale dynamic imports, and shared build lifecycle hooks.
It also expands the generated-runtime and generator contract suites so these edge cases remain
locked through public behavior tests.

Notable fixes include:

- `@rexeus/typeweaver-core`: reject malformed typed-response shapes and preserve default error
  descriptor fields when callers add extra response body data.
- `@rexeus/typeweaver-gen`: reject leading-digit generated identifiers and validate inline
  derived response metadata like canonical derived responses.
- `@rexeus/typeweaver-types`: reject malformed array request parts and return safe validation
  failures for hostile response status values while preserving diagnostics.
- `@rexeus/typeweaver-clients`: validate base URLs and path parameters before requests reach the
  fetch boundary, including generated file-client transport paths.
- `@rexeus/typeweaver-server` and `@rexeus/typeweaver-hono`: fail closed on malformed JSON,
  response-validation handler failures, unsafe headers, and response normalization edge cases.
- `@rexeus/typeweaver`: harden CLI config/plugin/spec loading, stale dynamic imports, generated
  index files, and shared `tsdown` post-build `onSuccess` handling.
- `@rexeus/typeweaver-zod-to-ts`: improve TypeScript output for bigint literals, multi-value
  literals, enum values, variadic tuples, defaults, and optional/default interactions.
