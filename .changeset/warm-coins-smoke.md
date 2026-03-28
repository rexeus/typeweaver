---
"@rexeus/typeweaver-clients": minor
"@rexeus/typeweaver-server": minor
"@rexeus/typeweaver-types": minor
"@rexeus/typeweaver-core": minor
"@rexeus/typeweaver-hono": minor
"@rexeus/typeweaver": minor
---

Replace generated response classes with tagged plain objects across the core,
types, clients, server, and hono packages.
Generated clients now return the full response union instead of throwing typed
error responses, and generated server and hono routers now validate responses
before sending them, stripping extra fields from valid bodies.
This release also renames `handleValidationErrors` to
`handleRequestValidationErrors` and adds configurable response validation error
handling for generated routers.
