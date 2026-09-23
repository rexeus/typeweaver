# ADR 0006: CLI error and log formatting

## Status

Accepted; supersedes the historical `@effect/cli` and legacy runtime guidance.

## Context

TypeWeaver's CLI runs on Effect 4.0.0-rc.116 and the native `effect/unstable/cli` parser. Parse
failures and help are user-facing output, while generation failures must preserve typed failures and
defects without leaking a FiberFailure trace.

## Decision

- `Command.runWith` uses the RC.116 parser with `renderErrors: true`. The native parser renders help
  and parse diagnostics exactly once; TypeWeaver does not scan argv or reparse unknown options.
- `CliOutput.Formatter` supplies the stable non-colour version and error formatting used by the
  process contract. Domain failures pass through `formatErrorForCli` at the final runtime boundary.
- `validationErrorFilter` suppresses only failures already rendered by the native parser. It does
  not suppress domain errors, defects, or causes that still need an application message.
- CLI logging remains one logger boundary. Normal messages use stdout and warning/error messages use
  stderr; `--verbose` selects the debug-capable layer.
- Node startup uses the Effect 4 `@effect/platform-node-shared` runtime and layers and disables the
  platform's duplicate error reporter. No `@effect/cli` or `@effect/platform` package API is part of
  the current contract.

## Consequences

Native parser wording and help layout are the source of truth. Tests assert one parse error, its
help boundary, and the absence of duplicate application rendering. Application error formatting
remains separate so typed generation failures stay concise and actionable.

## References

- `packages/cli/src/cli.ts`
- `packages/cli/src/validationErrorFilter.ts`
- `packages/cli/__test__/cli.process/`
- [Effect 4 baseline](./0008-effect-4-baseline.md)
