# ADR 0006: CLI Error and Log Formatting

## Status

Accepted

## Context

By default, an Effect runtime emits two kinds of output that are unsuitable for a developer-facing
CLI:

1. **FiberFailure traces** — when an Effect fails at the runtime boundary, the default reporter
   prints a multi-line fiber trace with stack frames, cause chains, and runtime metadata. Useful for
   debugging Effect itself; noisy when a user mistyped a CLI flag.
2. **Structured log lines** — `Effect.logInfo("Bundling spec...")` produces
   `timestamp=2026-05-16T10:23:14.123Z level=INFO fiber=#0 message="Bundling..."` in the default
   format. A CLI user wants `Bundling spec from '...'`, not a logfmt record.

The Task #9 migration to `@effect/cli` made the CLI's user-facing surface load-bearing: `--help`,
validation errors, and runtime failures all flow through the same pipeline that the spec generation
logic uses. A single unhandled `Cause` would print thirty lines where one was wanted.

## Decision

Three components shape the CLI's user-facing output.

### `formatErrorForCli`

`packages/cli/src/formatErrorForCli.ts` translates any failure into a single user-facing line:

- Tagged errors (`Data.TaggedError` instances throughout the codebase) are rendered via their
  `message` getter.
- Plain `Error` instances render their `message`.
- `Cause` values are unwrapped to their first defect or failure.
- Unknown causes render via `String(cause)`.

The function returns `string`; the caller prints it and chooses the exit code.

### `CliLoggerLayer`

`packages/cli/src/cliLogger.ts` replaces the default Effect logger with one that:

- Drops timestamps and fiber identifiers from log lines.
- Prefixes warnings with `[WARN]` and errors with `[ERROR]`.
- Writes to `stdout` for info-level lines and `stderr` for warnings/errors.

The layer is included in `ProductionLayer` so every Effect emitted from the CLI uses the friendly
format.

### `NodeRuntime.runMain` configuration

The CLI entrypoint (`packages/cli/src/cli.ts`) calls
`NodeRuntime.runMain(effect, { disablePrettyLogger: true, disableErrorReporting: true })`. Both
flags suppress the platform's default formatters so the only output the user sees comes from
`CliLoggerLayer` (for logs) and the CLI's own `formatErrorForCli` pipeline (for failures).

### `validationErrorFilter`

`@effect/cli` already renders its own usage and help output when a flag is invalid; the failure it
raises (`ValidationError`) is decorative. The CLI pipes its failure stream through
`Effect.tapErrorCause` with the filter in `packages/cli/src/validationErrorFilter.ts`. The filter
detects already-rendered `ValidationError`s and short-circuits before `formatErrorForCli` runs,
preventing double-print.

## Consequences

### Positive

- Users see a single-line error message tailored to the failure:
  `Failed to bundle spec entrypoint '/path/to/spec.ts': Cannot find module '...'.` instead of a
  fiber stack trace.
- Log lines read like a CLI tool: `Bundling spec from '...' to '...'`, `Generation complete!`,
  `Generated files: 42`.
- `@effect/cli`'s help and usage output passes through untouched. The filter recognizes
  `ValidationError`'s already-rendered shape and skips the formatter.
- Tests use `withCapturedLogs` (`packages/cli/__test__/helpers/`) to assert on log output at the
  Effect-logger boundary, not via `console.spy` — keeping the assertions independent of `console`'s
  real implementation.

### Negative

- Diagnostic detail is lost from the default output. Users who need a full trace must opt in (a
  future `--verbose` flag could re-enable the platform's default formatters). The Trade-off is
  documented in `packages/cli/src/cli.ts`.
- Three layers of formatting interact (logger, error formatter, validation filter). A regression in
  any one can surface as silent output or a duplicated print. The test suite covers each
  independently: `cliLogger.test.ts`, `formatErrorForCli.test.ts`, `validationErrorFilter.test.ts`,
  `effectRuntime.cliLogger.test.ts`.

## Reference Files

- `packages/cli/src/cli.ts` — `NodeRuntime.runMain` configuration
- `packages/cli/src/formatErrorForCli.ts` — failure rendering
- `packages/cli/src/cliLogger.ts` — `CliLoggerLayer`
- `packages/cli/src/validationErrorFilter.ts` — help/usage suppression
- `packages/cli/__test__/cliLogger.test.ts`, `packages/cli/__test__/formatErrorForCli.test.ts`,
  `packages/cli/__test__/validationErrorFilter.test.ts`,
  `packages/cli/__test__/effectRuntime.cliLogger.test.ts`
