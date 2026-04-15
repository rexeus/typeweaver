---
"@rexeus/typeweaver": minor
"@rexeus/typeweaver-gen": minor
"@rexeus/typeweaver-types": minor
"@rexeus/typeweaver-clients": minor
"@rexeus/typeweaver-server": minor
"@rexeus/typeweaver-hono": minor
"@rexeus/typeweaver-aws-cdk": minor
---

Separate generated output by plugin namespace instead of mixing all
generated resource files in a single directory.

Generated files now live under plugin-specific paths such as
`generated/types/*`, `generated/clients/*`, `generated/server/*`,
`generated/hono/*`, and `generated/aws-cdk/*`.
