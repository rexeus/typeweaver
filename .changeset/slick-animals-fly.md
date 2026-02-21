---
"@rexeus/typeweaver-zod-to-ts": minor
"@rexeus/typeweaver-aws-cdk": minor
"@rexeus/typeweaver-clients": minor
"@rexeus/typeweaver-types": minor
"@rexeus/typeweaver-core": minor
"@rexeus/typeweaver-hono": minor
"@rexeus/typeweaver": minor
"@rexeus/typeweaver-gen": minor
---

- Replace axios with native fetch API.
- The fetchFn prop on ApiClientProps allows injecting a custom fetch implementation.
- Response header validation now correctly splits comma-delimited values per RFC 7230 when the
  schema expects an array.
