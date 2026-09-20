---
"@rexeus/typeweaver": minor
"@rexeus/typeweaver-gen": minor
"@rexeus/typeweaver-effect": minor
"@rexeus/typeweaver-clients": minor
"@rexeus/typeweaver-command": minor
"@rexeus/typeweaver-types": minor
"@rexeus/typeweaver-server": minor
"@rexeus/typeweaver-hono": minor
"@rexeus/typeweaver-openapi": minor
"@rexeus/typeweaver-aws-cdk": minor
---

Complete the native Effect 4 migration on the exact `4.0.0-rc.116` runtime and peer pin. The CLI
programmatic API, generator lifecycle, first-party plugins, and Effect adapter now share one Effect
identity. Core authoring and plain generated client, Fetch-native server, and Hono consumption remain
Effect-optional. Migration guidance covers the `Context.Service`, `Result`, `Cause`, Schema, and native
CLI changes, plus the pinned source-reference and `@effect/tsgo` diagnostics gates.
