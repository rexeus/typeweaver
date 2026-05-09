---
"@rexeus/typeweaver-hono": patch
---

Make malformed request-body parsing configurable for generated Hono routers while preserving the default sanitized 400 Bad Request response.

The Hono runtime defines and exports the body parse error class as `HonoBodyParseError` so generated root barrels can coexist with server runtime exports without ambiguity.
