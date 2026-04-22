---
"@rexeus/typeweaver-aws-cdk": patch
"@rexeus/typeweaver-clients": patch
"@rexeus/typeweaver-server": patch
"@rexeus/typeweaver-types": patch
"@rexeus/typeweaver-hono": patch
"@rexeus/typeweaver-gen": patch
---

- Normalize generated file names to PascalCase across generators and outputs for more consistent imports.
- Improve generated response helpers so they only require defined header and body inputs, including coverage for body-only and empty responses.
- Unify oversized request body handling across Node, Bun, and Deno with a shared server body limit policy and 413 integration coverage.
