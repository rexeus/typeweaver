---
"@rexeus/typeweaver-clients": patch
"@rexeus/typeweaver-server": patch
"@rexeus/typeweaver-core": patch
"@rexeus/typeweaver-types": patch
---

Fix framework regressions in generated clients, server error handling, response metadata, and schema-less request generation.

Generated client commands now preserve caller-supplied headers over generated defaults. Server apps now call `onError` for unknown errors handled by custom unknown-error handlers. Response definitions created from immutable objects no longer fail before derived response cycle validation can surface typed errors. Schema-less generated request commands and validators now compile under strict TypeScript `noUnusedLocals` and `noUnusedParameters`.
