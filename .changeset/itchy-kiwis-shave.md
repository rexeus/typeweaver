---
"@rexeus/typeweaver-zod-to-ts": minor
---

Support more Zod v4 wrapper and utility types in `zod-to-ts`.

This reduces `unknown` fallbacks in generated TypeScript for common
schemas such as `readonly`, `nonoptional`, `pipe`, `catch`, and `file`.
