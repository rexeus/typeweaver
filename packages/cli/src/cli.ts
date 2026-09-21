import { Effect, Layer, References } from "effect";
import { CliOutput, Command } from "effect/unstable/cli";
import { cli } from "./cliCommands.js";
import { cliPackageVersion } from "./cliMetadata.js";
import { ProductionLayer, VerboseLayer } from "./effectRuntime.js";
import { formatErrorForCli } from "./formatErrorForCli.js";
import { nodePlatformLayer, runNodeMain } from "./nodePlatform.js";
import { isOnlyValidationErrorCause } from "./validationErrorFilter.js";

// The chosen Layer is fixed at program-construction time — there is no
// per-command Layer swap. We detect `--verbose` here so the right runtime is
// provided before the command parser ever runs. The option is also declared on
// `generate` so it shows up in `--help` and gets parsed cleanly (the flag is
// benign to the handler).
// Commander's historical `-V` alias is not a built-in global flag, so
// normalize that public compatibility flag before parsing.
const cliArgs = process.argv
  .slice(2)
  .filter(arg => arg !== "--")
  .map(arg => (arg === "-V" ? "--version" : arg));
const isVerbose = cliArgs.some(arg => arg === "--verbose");
const isJson = cliArgs.some(arg => arg === "--json");
const isReadOnlyDiagnostic = cliArgs.some(
  arg => arg === "validate" || arg === "doctor"
);
const runtimeLayer = isVerbose ? VerboseLayer : ProductionLayer;
const cliOutputFormatter: CliOutput.Formatter = {
  ...CliOutput.defaultFormatter({ colors: false }),
  formatVersion: (_name, version) => `${version}\n`,
};

// `effect/unstable/cli` reads process streams through the `Stdio` service and
// parses argv through `Command.runWith`; these Node layers close the CLI
// `Environment` requirement alongside the service runtime's FileSystem. The
// spawner layer reuses that FileSystem and receives its Path internally.
const cliEnvironment = Layer.mergeAll(
  nodePlatformLayer,
  CliOutput.layer(cliOutputFormatter)
);

const commandProgram = Command.runWith(cli, {
  version: cliPackageVersion,
  // Native parser diagnostics render parse failures and help exactly once.
  // Domain failures continue through the boundary below.
  renderErrors: true,
})(cliArgs);
const programWithErrorBoundary = commandProgram.pipe(
  Effect.tapCause(cause => {
    if (isOnlyValidationErrorCause(cause)) {
      return Effect.void;
    }

    // Final runtime edge: stderr rendering must preserve the original Cause.
    // A console failure is a broken process invariant, not recoverable I/O.
    return Effect.sync(() => {
      console.error(formatErrorForCli(cause));
    });
  })
);
const program = (
  isJson || isReadOnlyDiagnostic
    ? programWithErrorBoundary.pipe(
        Effect.provideService(References.MinimumLogLevel, "None")
      )
    : programWithErrorBoundary
).pipe(Effect.provide(Layer.provideMerge(cliEnvironment, runtimeLayer)));

runNodeMain(program, {
  disableErrorReporting: true,
});
