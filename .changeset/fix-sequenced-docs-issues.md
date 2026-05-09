---
"@rexeus/typeweaver-core": patch
"@rexeus/typeweaver-gen": patch
"@rexeus/typeweaver-types": patch
"@rexeus/typeweaver-clients": patch
"@rexeus/typeweaver-server": patch
"@rexeus/typeweaver-hono": patch
"@rexeus/typeweaver-aws-cdk": patch
---

Fix generated literal request headers, align typed response header optionality with runtime behavior, emit sanitized generated JSDoc, and validate transformed thrown typed HTTP responses after `handleHttpResponseErrors`. Clarify custom unknown error reporting semantics.
