---
"@rexeus/typeweaver": patch
---

Pre-compile Zod definition files to `.js` + `.d.ts` stubs before tsc

Definition files containing Zod schemas are now transpiled ahead of the TypeScript
compiler pass. This prevents tsc from hitting OOM on Zod v4's deeply recursive type
inference. The generated `.d.ts` stubs use `any` internally — the public API remains
fully typed through the validator and consumer layers.
