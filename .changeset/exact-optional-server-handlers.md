---
"@rexeus/typeweaver-server": minor
---

Erase router handler types without `any`: `TypeweaverRouter` and `RouteDefinition.handler` are
constrained by the newly exported `ErasedRequestHandler`, and `nodeAdapter` accepts
`TypeweaverApp<Record<string, unknown>>`. Hand-written handlers registered through a custom router's
`route(...)` receive `IRawHttpRequest | IValidatedHttpRequest` and must annotate or narrow their
request parameter.
