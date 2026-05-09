---
"@rexeus/typeweaver-zod-to-ts": minor
---

Expand Zod-to-TypeScript generation for Zod v4 wrapper schemas.

`z.nonoptional()`, `z.readonly()`, `z.catch()`, `z.pipe()`, `z.nan()`, `z.file()`, and `z.success()` now emit concrete TypeScript types where possible instead of falling back to `unknown`. Object property keys that are reserved identifiers or otherwise unsafe are emitted as string literal keys.
