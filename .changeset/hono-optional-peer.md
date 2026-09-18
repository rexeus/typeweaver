---
"@rexeus/typeweaver-hono": patch
---

Mark the generated Hono projection's `hono` peer dependency optional via `peerDependenciesMeta`. The
generator plugin does not require Hono to execute; only the generated Hono output imports it, so a
CLI-only consumer no longer needs Hono installed to satisfy strict peer checks. The `effect`,
`@rexeus/typeweaver-gen`, and `@rexeus/typeweaver-core` peers remain required, and consumers who
select the `hono` projection must still install `hono` themselves.
