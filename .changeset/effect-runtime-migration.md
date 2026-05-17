---
"@rexeus/typeweaver": major
"@rexeus/typeweaver-core": major
"@rexeus/typeweaver-gen": major
"@rexeus/typeweaver-types": major
"@rexeus/typeweaver-clients": major
"@rexeus/typeweaver-aws-cdk": major
"@rexeus/typeweaver-hono": major
"@rexeus/typeweaver-server": major
"@rexeus/typeweaver-openapi": major
"@rexeus/typeweaver-zod-to-ts": major
---

Migrate the runtime, plugin API, and CLI to Effect.

The plugin API moves from class-based `BasePlugin` extension to V2 records returned by
`definePlugin(...)` and `definePluginWithLibCopy(...)`. Lifecycle stages return
`Effect<void, PluginExecutionError>` instead of `Promise<void> | void`. Every error surface is now
a `Data.TaggedError` (21 tagged errors across the packages). The CLI is built on `@effect/cli`,
with friendly single-line error formatting and structured log lines.

The spec authoring API (`defineSpec`, `defineOperation`, `defineResponse`) and Zod schemas are
unchanged — existing specs keep working byte-for-byte.

- `@rexeus/typeweaver-core` re-exports the new `DuplicateResponseNameError` tagged error; no behavior change.

Breaking changes are documented in [MIGRATION.md](../MIGRATION.md#migrating-from-012x-to-013x).
Background on the design decisions:

- ADR 0003 — Effect-native plugin API (V2)
- ADR 0004 — FileSystem service adoption
- ADR 0005 — Effect.Service patterns
- ADR 0006 — CLI error and log formatting
- ADR 0007 — Generator per-call isolation
