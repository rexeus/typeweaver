import { Command } from "effect/unstable/cli";
import {
  cliPackageVersion,
  cliZodVersion,
  pluginScaffoldTemplateDirectory,
  projectInitTemplateDirectory,
} from "./cliMetadata.js";
import {
  checkOption,
  cleanOption,
  configFormatOption,
  configOption,
  deepOption,
  dryRunOption,
  failOnOption,
  forceOption,
  formatOption,
  initTargetOption,
  inputOption,
  jsonOption,
  noCleanOption,
  noFormatOption,
  outputOption,
  pluginNameOption,
  pluginTargetOption,
  pluginsOption,
  strictOption,
  verboseOption,
} from "./cliOptions.js";
import {
  runAddPlugin,
  runDoctor,
  runGenerate,
  runInit,
  runValidate,
} from "./commands.js";

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

export const cli = Command.make("typeweaver").pipe(
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
