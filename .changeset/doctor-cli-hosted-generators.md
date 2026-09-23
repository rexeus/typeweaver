---
"@rexeus/typeweaver": patch
---

Stop `typeweaver doctor` from failing `TW-DOCTOR-011` for the CLI-hosted `hono`, `openapi`, and
`command` generators. The CLI loads them from its own dependencies and runs them on its exact
`effect@4.0.0-rc.116`, and their generated output does not import Effect. A project that configures
them without declaring Effect is now skipped, and one on another Effect version gets a warning, as
with plain projections. The `effect` projection and custom plugins still fail unless the project
resolves its own `effect@4.0.0-rc.116`.
