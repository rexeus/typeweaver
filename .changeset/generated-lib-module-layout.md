---
"@rexeus/typeweaver-server": patch
"@rexeus/typeweaver-hono": patch
"@rexeus/typeweaver-clients": patch
"@rexeus/typeweaver-types": patch
---

Regeneration copies the runtime support code into more, smaller modules under `lib/server`,
`lib/hono`, `lib/clients`, and `lib/types`. The generated `index.ts` barrels export the same names;
import from them rather than from individual support modules, and expect added files in committed
generated output.
