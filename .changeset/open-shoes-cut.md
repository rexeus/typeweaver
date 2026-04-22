---
"@rexeus/typeweaver-openapi": minor
"@rexeus/typeweaver-zod-to-json-schema": minor
"@rexeus/typeweaver": patch
---

Add an OpenAPI 3.1 generation plugin and a dedicated Zod-to-JSON-Schema
package for schema export.

This makes it easier to generate OpenAPI artifacts from Typeweaver specs
for downstream tooling and integrations.

OpenAPI generation now also merges multiple responses that share the same
status code into a single valid response entry and emits warnings when
variant-specific headers cannot be represented safely.
