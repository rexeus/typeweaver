# ADR 0010: Effect 4 Workspace Compatibility (Superseded)

## Status

**Superseded by [ADR 0008](./0008-effect-4-baseline.md).**

## Historical context

This ADR recorded an interim `effect@4.0.0-rc.115` process-isolated CLI experiment while
TypeWeaver's native implementation still used Effect 3. That experiment was deliberately limited to
the binary CLI, Effect-neutral config/spec modules, and plain generated projections. It did not
establish compatibility for the CLI programmatic API, generator/plugin lifecycle, first-party plugin
imports, or the adapter.

The experiment is no longer the repository contract. Its `rc.115` evidence, Effect 3 peer range, and
process-isolation-only classification must not be used for current implementation or documentation.

## Current status

TypeWeaver now has a native Effect 4 baseline at the exact `4.0.0-rc.116` pin and source commit
`d62dd0d65252e5d3635538f0e41adc7c08aa9beb`. The CLI programmatic API, `@rexeus/typeweaver-gen`,
first-party plugins, and `@rexeus/typeweaver-effect` require that one Effect identity. Core
authoring and generated plain client, Fetch-native server, and Hono output remain Effect-optional.

Use [ADR 0008](./0008-effect-4-baseline.md), `config/effect-baseline.json`, and the active
[Effect guide](../../.agents/skills/effect-ts/references/typeweaver-effect-4.md) for the current
contract, migration differences (`Context.Service`, `Result`, `Cause`, Schema, and native CLI), and
diagnostics gate.
