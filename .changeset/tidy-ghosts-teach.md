---
"@rexeus/typeweaver-zod-to-ts": patch
"@rexeus/typeweaver-aws-cdk": patch
"@rexeus/typeweaver-clients": patch
"@rexeus/typeweaver-server": patch
"@rexeus/typeweaver-types": patch
"@rexeus/typeweaver-core": patch
"@rexeus/typeweaver-hono": patch
"@rexeus/typeweaver": patch
"@rexeus/typeweaver-gen": patch
---

Normalize custom `headerName` option to lowercase in `requestId` middleware so that mixed-case
values like `"X-Request-Id"` match HTTP-layer-normalized headers correctly
