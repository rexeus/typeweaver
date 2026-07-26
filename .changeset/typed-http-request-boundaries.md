---
"@rexeus/typeweaver-clients": minor
"@rexeus/typeweaver-core": minor
"@rexeus/typeweaver-effect": minor
"@rexeus/typeweaver-hono": minor
"@rexeus/typeweaver-server": minor
"@rexeus/typeweaver-types": minor
---

Separate raw HTTP transport requests from validated Zod output, add compile-time request-boundary
schema checks, serialize domain scalars in generated clients, and make Server and Hono handler types
truthful for every request-validation mode.

This is a breaking pre-1.0 type change for code that consumes bare requests, calls generated
validators directly, or disables request validation. Use `IRawHttpRequest` at transport and
middleware boundaries, operation-specific generated request types after validation, and follow the
typed HTTP boundary migration guide.
