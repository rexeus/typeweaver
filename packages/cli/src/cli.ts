import { Command, Options } from "@effect/cli";
import { NodeRuntime } from "@effect/platform-node";
import { Effect, Logger, LogLevel } from "effect";
import {
  cliPackageVersion,
  pluginScaffoldTemplateDirectory,
} from "./cliMetadata.js";
import { ProductionLayer, VerboseLayer } from "./effectRuntime.js";
import { formatErrorForCli } from "./formatErrorForCli.js";
import { runAddPlugin } from "./runAddPlugin.js";
import { runGenerate } from "./runGenerate.js";
import { runValidate } from "./runValidate.js";
import { isOnlyValidationErrorCause } from "./validationErrorFilter.js";

const inputOption = Options.text("input").pipe(
  Options.withAlias("i"),
  Options.withDescription("path to spec entrypoint file"),
  Options.optional
);

const outputOption = Options.text("output").pipe(
  Options.withAlias("o"),
  Options.withDescription("output directory for generated files"),
  Options.optional
);

const configOption = Options.text("config").pipe(
  Options.withAlias("c"),
  Options.withDescription("path to a .js, .mjs, or .cjs configuration file"),
  Options.optional
);

const pluginsOption = Options.text("plugins").pipe(
  Options.withAlias("p"),
  Options.withDescription("comma-separated list of plugins to use"),
  Options.optional
);

// `Options.boolean(name, { negationNames })` has a known bug in
// @effect/cli@0.75.x where the inner `withDefault(!ifPresent)` short-circuits
// the outer `withDefault`. Model `--format` / `--no-format` as two flags and
// compute the effective value in the handler instead.
const formatOption = Options.boolean("format", { ifPresent: true }).pipe(
  Options.withDescription("format generated code with oxfmt (default: true)"),
  Options.optional
);

const noFormatOption = Options.boolean("no-format", { ifPresent: true }).pipe(
  Options.withDescription(
    "disable code formatting (takes precedence if both --format and --no-format are passed)"
  ),
  Options.optional
);

const cleanOption = Options.boolean("clean", { ifPresent: true }).pipe(
  Options.withDescription(
    "clean output directory before generation (default: true)"
  ),
  Options.optional
);

const noCleanOption = Options.boolean("no-clean", { ifPresent: true }).pipe(
  Options.withDescription(
    "disable cleaning output directory (takes precedence if both --clean and --no-clean are passed)"
  ),
  Options.optional
);

const verboseOption = Options.boolean("verbose", { ifPresent: true }).pipe(
  Options.withDescription(
    "enable debug-level logging (effect spans, plugin attempts, lock acquire/release)"
  ),
  Options.optional
);

const pluginNameOption = Options.text("name").pipe(
  Options.withAlias("n"),
  Options.withDescription("lowercase kebab-case plugin name")
);

const pluginTargetOption = Options.text("target").pipe(
  Options.withAlias("t"),
  Options.withDescription("new directory that will receive the plugin scaffold")
);

const jsonOption = Options.boolean("json", { ifPresent: true }).pipe(
  Options.withDescription("emit a stable machine-readable JSON report"),
  Options.optional
);

const strictOption = Options.boolean("strict", { ifPresent: true }).pipe(
  Options.withDescription("fail validation when warnings are present"),
  Options.optional
);

const failOnOption = Options.choice("fail-on", [
  "error",
  "warning",
  "info",
]).pipe(
  Options.withDescription("lowest issue severity that exits non-zero"),
  Options.optional
);

const generateCommand = Command.make(
  "generate",
  {
    input: inputOption,
    output: outputOption,
    config: configOption,
    plugins: pluginsOption,
    format: formatOption,
    "no-format": noFormatOption,
    clean: cleanOption,
    "no-clean": noCleanOption,
    verbose: verboseOption,
  },
  runGenerate
).pipe(
  Command.withDescription(
    "Generate types, validators, and clients from an API spec"
  )
);

const initCommand = Command.make("init", {}, () =>
  Effect.logInfo("The init command is coming soon!")
).pipe(
  Command.withDescription("Initialize a new typeweaver project (coming soon)")
);

const validateCommand = Command.make(
  "validate",
  {
    input: inputOption,
    config: configOption,
    plugins: pluginsOption,
    strict: strictOption,
    "fail-on": failOnOption,
    json: jsonOption,
  },
  runValidate
).pipe(
  Command.withDescription(
    "Validate a spec and its plugins without writing project output"
  )
);

const addPluginCommand = Command.make(
  "plugin",
  {
    name: pluginNameOption,
    target: pluginTargetOption,
  },
  args =>
    runAddPlugin(args, {
      currentWorkingDirectory: process.cwd(),
      templateDir: pluginScaffoldTemplateDirectory,
      typeweaverVersion: cliPackageVersion,
    })
).pipe(
  Command.withDescription(
    "Create a tested TypeWeaver plugin package in a new directory"
  )
);

const addCommand = Command.make("add").pipe(
  Command.withDescription("Add a TypeWeaver developer surface"),
  Command.withSubcommands([addPluginCommand])
);

const cli = Command.make("typeweaver").pipe(
  Command.withDescription(
    "Type-safe API framework with code generation for TypeScript"
  ),
  Command.withSubcommands([
    generateCommand,
    initCommand,
    validateCommand,
    addCommand,
  ])
);

const run = Command.run(cli, {
  name: "typeweaver",
  version: cliPackageVersion,
});

// `@effect/cli` scopes options to commands, but the chosen Layer is fixed
// at program-construction time — there is no per-command Layer swap. We
// detect `--verbose` here so the right runtime is provided before
// the command parser ever runs. The option is also declared on `generate`
// so it shows up in `--help` and gets parsed cleanly (the flag is benign
// to the handler).
// @effect/cli exposes `--version` but not Commander's historical `-V` alias,
// so normalize that public compatibility flag before parsing.
const cliArgs = process.argv.map(arg => (arg === "-V" ? "--version" : arg));
const isVerbose = cliArgs.some(arg => arg === "--verbose");
const isJson = cliArgs.some(arg => arg === "--json");
const isReadOnlyDiagnostic = cliArgs.some(
  arg => arg === "validate" || arg === "doctor"
);
const runtimeLayer = isVerbose ? VerboseLayer : ProductionLayer;

const programWithErrorBoundary = run(cliArgs).pipe(
  // @effect/cli surfaces help requests and validation issues as
  // `ValidationError`. The framework already prints a friendly message and
  // sets the exit code for those — skip the custom formatter so we do not
  // double-print. All other failures (tagged domain errors, plain Error,
  // defects) are rendered via `formatErrorForCli` before bubbling up to
  // `NodeRuntime.runMain`, which exits non-zero on failure.
  Effect.tapErrorCause(cause => {
    if (isOnlyValidationErrorCause(cause)) {
      return Effect.void;
    }

    // Final runtime edge: stderr rendering must preserve the original Cause.
    // A console failure is a broken process invariant, not recoverable I/O.
    return Effect.sync(() => {
      // eslint-disable-next-line no-console
      console.error(formatErrorForCli(cause));
    });
  })
);
const program = (
  isJson || isReadOnlyDiagnostic
    ? programWithErrorBoundary.pipe(Logger.withMinimumLogLevel(LogLevel.None))
    : programWithErrorBoundary
).pipe(Effect.provide(runtimeLayer));

NodeRuntime.runMain(program, {
  disableErrorReporting: true,
  disablePrettyLogger: true,
});
