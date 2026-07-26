---
"@rexeus/typeweaver-core": major
"@rexeus/typeweaver-server": major
"@rexeus/typeweaver-hono": major
---

Replace the implicit `any` HTTP body default with an `unknown` boundary, narrow response bodies in
the Fetch adapters, and reject non-serializable Hono response bodies with
`HonoResponseSerializationError`.
