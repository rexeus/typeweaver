---
"@rexeus/typeweaver-core": minor
"@rexeus/typeweaver-gen": minor
---

Adopt `exactOptionalPropertyTypes` and align the public boundary types with schema-derived optional
values: HTTP header/query map values (`IHttpHeader`, `IHttpQuery`, `RawHttpHeaderValue`,
`RawHttpQueryValue`) and optional `NormalizedSpec` resource, operation, request, and response
properties now admit explicit `undefined`. Writes keep compiling; code that reads these values must
handle the `undefined` case.
