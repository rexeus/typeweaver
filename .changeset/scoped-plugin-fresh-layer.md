---
"@rexeus/typeweaver-gen": patch
---

Build every `defineScopedPlugin` Layer with a private memo map for each generation. A host runtime
that already built the same Layer value no longer hands its shared instance to the plugin, its
Layer, or its hooks, so each generation acquires and releases its own resources.
