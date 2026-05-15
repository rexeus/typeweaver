---
"@rexeus/typeweaver-zod-to-json-schema": minor
"@rexeus/typeweaver-clients": minor
"@rexeus/typeweaver-openapi": minor
"@rexeus/typeweaver-server": minor
"@rexeus/typeweaver-types": minor
"@rexeus/typeweaver": minor
"@rexeus/typeweaver-gen": minor
---

Add first-class normalized body media metadata and use it for OpenAPI content generation.

The normalized generator contract now wraps request and response body schemas with
the effective media type, media source, and transport semantics. Generator authors
should read `body.schema` for the original Zod schema and use `body.mediaType` /
`body.transport` when producing wire-format-specific output.

OpenAPI generation now uses the normalized media type for request and response
`content` entries, emits binary schemas for raw `application/octet-stream`
bodies, preserves custom media types, and merges duplicate response variants per
media type using `anyOf` where schemas overlap.

Response header merging is now case-insensitive, so equivalent header names with
different casing are merged without dropping schemas or descriptions.

BREAKING CHANGE: `@rexeus/typeweaver-gen` normalized request and response body
values are no longer bare Zod schemas. They are normalized body objects containing
`schema`, `mediaType`, `mediaTypeSource`, and `transport`.
