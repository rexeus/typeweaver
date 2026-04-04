---
"@rexeus/typeweaver-aws-cdk": patch
"@rexeus/typeweaver-clients": patch
"@rexeus/typeweaver-server": patch
"@rexeus/typeweaver-types": patch
"@rexeus/typeweaver-core": patch
"@rexeus/typeweaver-hono": patch
"@rexeus/typeweaver": patch
"@rexeus/typeweaver-gen": patch
---

Unify generator build mechanics behind shared tsdown helpers, enforce plugin
dependency ordering, simplify the precompiled `types` lib build path, and switch
the CLI spec bundler from `tsdown` to direct `rolldown` usage.
