---
"@rexeus/typeweaver-core": minor
"@rexeus/typeweaver-server": minor
"@rexeus/typeweaver-hono": minor
---

Replace the implicit `any` HTTP body default with an `unknown` boundary, narrow response bodies in
the Fetch adapters, and reject non-serializable Hono response bodies with
`HonoResponseSerializationError`.
