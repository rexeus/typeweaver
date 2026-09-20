import { Effect, Layer, References } from "effect";
import { CliOutput, Command, Flag } from "effect/unstable/cli";
import {
  cliPackageVersion,
  cliZodVersion,
  pluginScaffoldTemplateDirectory,
  projectInitTemplateDirectory,
} from "./cliMetadata.js";
import {
  runAddPlugin,
  runDoctor,
  runGenerate,
  runInit,
  runValidate,
} from "./commands.js";
import { ProductionLayer, VerboseLayer } from "./effectRuntime.js";
import { formatErrorForCli } from "./formatErrorForCli.js";
import { nodePlatformLayer, runNodeMain } from "./nodePlatform.js";
import { isOnlyValidationErrorCause } from "./validationErrorFilter.js";

const inputOption = Flag.String("input").pipe(
  Flag.withAlias("i"),
  Flag.withDescription("path to spec entrypoint file"),
  Flag.optional
);

const outputOption = Flag.String("output").pipe(
  Flag.withAlias("o"),
  Flag.withDescription("output directory for generated files"),
  Flag.optional
);

const configOption = Flag.String("config").pipe(
  Flag.withAlias("c"),
  Flag.withDescription("path to a .js, .mjs, or .cjs configuration file"),
  Flag.optional
);

const pluginsOption = Flag.String("plugins").pipe(
  Flag.withAlias("p"),
  Flag.withDescription("comma-separated list of plugins to use"),
  Flag.optional
);

// `--format` / `--no-format` are modeled as separate flags and the effective
// value is computed in the handler: whichever is explicitly present takes
// precedence, and the default stays `true` when neither is passed.
const formatOption = Flag.Boolean("format").pipe(
  Flag.withDescription("format generated code with oxfmt (default: true)"),
  Flag.optional
);

const noFormatOption = Flag.Boolean("no-format").pipe(
  Flag.withDescription(
    "disable code formatting (takes precedence if both --format and --no-format are passed)"
  ),
  Flag.optional
);

const cleanOption = Flag.Boolean("clean").pipe(
  Flag.withDescription(
    "clean output directory before generation (default: true)"
  ),
  Flag.optional
);

const noCleanOption = Flag.Boolean("no-clean").pipe(
  Flag.withDescription(
    "disable cleaning output directory (takes precedence if both --clean and --no-clean are passed)"
  ),
  Flag.optional
);

const checkOption = Flag.Boolean("check").pipe(
  Flag.withDescription(
    "generate into isolation and report drift against committed output without writing it"
  ),
  Flag.optional
);

const verboseOption = Flag.Boolean("verbose").pipe(
  Flag.withDescription(
    "enable debug-level logging (effect spans, plugin attempts, lock acquire/release)"
  ),
  Flag.optional
);

const pluginNameOption = Flag.String("name").pipe(
  Flag.withAlias("n"),
  Flag.withDescription("lowercase kebab-case plugin name")
);

const pluginTargetOption = Flag.String("target").pipe(
  Flag.withAlias("t"),
  Flag.withDescription("new directory that will receive the plugin scaffold")
);

const initTargetOption = Flag.String("target").pipe(
  Flag.withAlias("t"),
  Flag.withDescription("project directory to create or update explicitly")
);

const forceOption = Flag.Boolean("force").pipe(
  Flag.withDescription(
    "overwrite conflicting starter files in a non-empty target"
  ),
  Flag.optional
);

const dryRunOption = Flag.Boolean("dry-run").pipe(
  Flag.withDescription("plan the project without writing files"),
  Flag.optional
);

const configFormatOption = Flag.Literals("config-format", [
  "mjs",
  "cjs",
  "js",
]).pipe(
  Flag.withDescription("module format for the generated configuration"),
  Flag.optional
);

const jsonOption = Flag.Boolean("json").pipe(
  Flag.withDescription("emit a stable machine-readable JSON report"),
  Flag.optional
);

const strictOption = Flag.Boolean("strict").pipe(
  Flag.withDescription("fail validation when warnings are present"),
  Flag.optional
);

const failOnOption = Flag.Literals("fail-on", [
  "error",
  "warning",
  "info",
]).pipe(
  Flag.withDescription("lowest issue severity that exits non-zero"),
  Flag.optional
);

const deepOption = Flag.Boolean("deep").pipe(
  Flag.withDescription(
    "bundle, normalize, and validate the spec without writing project output"
  ),
  Flag.optional
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
    check: checkOption,
    verbose: verboseOption,
  },
  runGenerate
).pipe(
  Command.withDescription(
    "Generate types, validators, and clients from an API spec"
  )
);

const initCommand = Command.make(
  "init",
  {
    target: initTargetOption,
    force: forceOption,
    "dry-run": dryRunOption,
    "config-format": configFormatOption,
    json: jsonOption,
  },
  args =>
    runInit(args, {
      currentWorkingDirectory: process.cwd(),
      templateDir: projectInitTemplateDirectory,
      typeweaverVersion: cliPackageVersion,
      zodVersion: cliZodVersion,
    })
).pipe(
  Command.withDescription(
    "Create an atomic TypeWeaver Todo starter in an explicit target"
  )
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

const doctorCommand = Command.make(
  "doctor",
  {
    input: inputOption,
    output: outputOption,
    config: configOption,
    plugins: pluginsOption,
    deep: deepOption,
    json: jsonOption,
  },
  runDoctor
).pipe(
  Command.withDescription(
    "Diagnose the runtime, project configuration, plugins, and output safety"
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
    doctorCommand,
    addCommand,
  ])
);

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
// spawner layer needs FileSystem and Path, so the base layers are provided
// into it instead of staying as open inputs.
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
).pipe(Effect.provide(Layer.merge(runtimeLayer, cliEnvironment)));

runNodeMain(program, {
  disableErrorReporting: true,
});
