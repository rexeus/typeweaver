---
"@rexeus/typeweaver-server": patch
"@rexeus/typeweaver-types": patch
"@rexeus/typeweaver": patch
---

Fix generated code issues and stabilize CLI binary resolution

- Fix trailing comma in Response.ejs template that produced `HttpResponse<Header, Body,>` in
  generated response classes
- Widen `TypeweaverRouter` generic constraint from `RequestHandler` to
  `RequestHandler<any, any, any>` to resolve contravariance error under `strictFunctionTypes`
- Add persistent `bin/` wrapper for CLI so pnpm creates the binary symlink reliably before the first
  build
