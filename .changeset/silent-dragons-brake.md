---
"@rexeus/typeweaver-zod-to-ts": minor
"@rexeus/typeweaver-aws-cdk": minor
"@rexeus/typeweaver-clients": minor
"@rexeus/typeweaver-server": minor
"@rexeus/typeweaver-types": minor
"@rexeus/typeweaver-core": minor
"@rexeus/typeweaver-hono": minor
"@rexeus/typeweaver": minor
"@rexeus/typeweaver-gen": minor
---

Switch typeweaver to the new functional spec-entrypoint architecture.
This removes the legacy filesystem- and class-based definition flow in favor of
`defineSpec`, `defineOperation`, `defineResponse`, and `defineDerivedResponse`,
and updates the CLI, generators, runtime defaults, and generated outputs to use
the new normalized spec pipeline.
### Breaking changes
- Remove legacy `Http*Definition` classes
- Remove filesystem-based definition discovery
- Require a spec entrypoint file for CLI generation
- Update generated runtime/output structure and centralized default errors
