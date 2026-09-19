# ADR 0010: Effect 4 Workspace Compatibility

## Status

Accepted. This ADR supplements [ADR 0008](./0008-effect-v3-baseline.md) and does not supersede it.
ADR 0008 remains the version authority; this ADR records what an Effect 4 workspace can use today.

## Context

Which TypeWeaver surfaces can an Effect 4 application use? Research against the pinned Effect 3.22.0
baseline and `effect@4.0.0-rc.115` showed that Effect 3 and Effect 4 values are not mutually
executable: each runtime rejects the other major's values, and lifecycle types are not mutually
assignable.

Three facts shape the decision:

- `config/effect-baseline.json` still pins development to Effect 3.22.0 and the public peer range to
  `>=3.22.0 <4`.
- The binary CLI runs as an isolated OS process and bundles its own Effect 3 runtime. It does not
  load the application's Effect values.
- `@rexeus/typeweaver-gen`, first-party plugins, the CLI programmatic API, and the
  `@rexeus/typeweaver-effect` adapter expose Effect in their public boundary. Running them beside an
  Effect 4 application would cross that boundary with incompatible values.

Effect 4 is still a release candidate (`4.0.0-rc.115` at the time of writing). No stable release,
aligned platform family, or stable Effect CLI exists yet.

## Decision

An Effect 4 workspace can run the **binary CLI** as a process-isolated child process with
Effect-neutral inputs and built-in plain generated projections. Every Effect-native surface stays on
Effect 3 until a later, separately approved native Effect 4 line.

### Compatibility matrix

| Surface                                                                                        | Effect 4 workspace | Reason                                                                                            |
| ---------------------------------------------------------------------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------- |
| Core authoring (`@rexeus/typeweaver-core`)                                                     | Supported          | Zod-based authoring has no Effect peer.                                                           |
| Binary CLI generation                                                                          | Supported          | `process-isolated`: the CLI bundles its own Effect 3 runtime and emits Effect-independent output. |
| CLI programmatic API (`@rexeus/typeweaver`)                                                    | Not supported      | `Generator` and `effectRuntime` expose Effect 3 values on their public boundary.                  |
| `@rexeus/typeweaver-gen` (plugin authoring)                                                    | Not supported      | The plugin lifecycle ABI returns Effect 3 values.                                                 |
| Plain generated output (`types`, `clients`, `server`, `hono`, `command`, `openapi`, `aws-cdk`) | Supported          | Every advertised plain projection was exercised; the generated modules do not import Effect.      |
| First-party plugin direct imports                                                              | Not supported      | `@rexeus/typeweaver-clients`, `-server`, `-effect`, and peers resolve against Effect 3.           |
| Effect adapter (`@rexeus/typeweaver-effect`)                                                   | Not supported      | Generated handlers and the managed runtime must share the application's single Effect identity.   |

The supported plain generated outputs import only the generated packages and their runtime
dependencies; they do not import Effect, `@rexeus/typeweaver-gen`, or the Effect adapter.

### Requirements

1. **Effect-neutral inputs, verified by the consumer.** The config module and spec entrypoint
   consumed by the isolated binary CLI must be Effect-neutral: they may import
   `@rexeus/typeweaver-core` and Zod, but not `effect`, `@rexeus/typeweaver-gen`, or any first-party
   Effect plugin. `typeweaver doctor` cannot inspect those modules, so its warning for the exact pin
   is explicitly conditional on that requirement.
2. **No crossing Effect values.** The application and the isolated CLI process must not exchange
   Effect values, Layers, runtimes, or managed runtimes in either direction.
3. **The exact RC pin is evidence, not a promise.** The packed evidence witnesses `4.0.0-rc.115`
   specifically. Every other Effect 4 release candidate or stable version is UNVERIFIED: TypeWeaver
   does not claim generic Effect 4 support, does not promise a range, and does not widen the
   published peer range.
4. **pnpm specific.** The packed evidence uses pnpm with strict peer dependencies and isolated
   `node_modules`. Other package managers are not proven for this isolated CLI path.
5. **A native Effect 4 line is blocked.** Migrating gen, first-party plugins, the CLI programmatic
   API, and the adapter to Effect 4 waits for stable aligned upstream releases and a separately
   approved superseding ADR.

## Consequences

- An Effect 4 application can adopt the binary CLI as build tooling and generate plain clients,
  servers, and documents without an unresolved peer contract.
- Effect-native authoring and the adapter remain Effect 3-only, so TypeWeaver makes no misleading
  compatibility claim about them.
- `typeweaver doctor` resolves the Effect declaration at the project boundary (never a parent tree
  or the CLI's own runtime). It reports it as `TW-DOCTOR-011` separately from the CLI's bundled
  runtime (`TW-DOCTOR-008`): a project that does not declare Effect is skipped only when no
  Effect-native or custom plugin is configured; an undeclared project that selects the `effect`
  projection or a custom plugin fails, because those surfaces need a project-owned Effect runtime.
  The exact `4.0.0-rc.115` pin gets a conditional warning, every other Effect 4 version is marked
  UNVERIFIED, and Effect-native surfaces pass only with a declared, supported stable Effect 3
  runtime. It never claims the generated output proves the whole workspace is Effect-free.
- When a stable Effect 4 release arrives, revisit the matrix, peer ranges, doctor outcomes, and this
  ADR together.

## Reference files

- Version authority: [`config/effect-baseline.json`](../../config/effect-baseline.json)
- Baseline ADR: [ADR 0008](./0008-effect-v3-baseline.md)
- Packed evidence: `scripts/test-packed-consumers.mjs`
- Doctor classifier: `packages/cli/src/services/effectCompatibility.ts`
