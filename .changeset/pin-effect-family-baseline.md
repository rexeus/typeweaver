---
"@rexeus/typeweaver": patch
"@rexeus/typeweaver-gen": patch
---

Pin the published `@effect/*` dependencies, including a direct `@effect/platform-node-shared` pin, to
the versions verified against the Effect 3.22.0 baseline. Fresh packed consumers now resolve a
peer-coherent Effect family instead of newer patch releases whose peers require a newer Effect
version.
