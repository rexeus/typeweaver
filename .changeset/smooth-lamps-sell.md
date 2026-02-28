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

Widen `RequestHandler` constraint in `TypeweaverApp.route()` from bare `RequestHandler` to
`RequestHandler<any, any, any>` to resolve contravariance error under `strictFunctionTypes`
