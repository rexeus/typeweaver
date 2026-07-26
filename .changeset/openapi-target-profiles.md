---
"@rexeus/typeweaver-openapi": minor
---

Replace the hard-coded OpenAPI 3.1.1 output with explicit `3.1.2` and `3.2.0` target profiles,
defaulting to 3.1.2. Project generator-neutral metadata, tags, deprecation, security schemes, and
effective operation security from `NormalizedSpec`.

Remove API identity from OpenAPI plugin options and expose representability loss through stable
`TW-PLUGIN-OPENAPI-*` issues returned by the side-effect-free plugin validation hook.
