import { Command, Option } from "commander";
import { handleDoctorCommand } from "./commands/doctor.js";
import { handleGenerateCommand } from "./commands/generate.js";
import { handleInitCommand } from "./commands/init.js";
import { handleMigrateCommand } from "./commands/migrate.js";
import { handleValidateCommand } from "./commands/validate.js";
import { getCliVersion } from "./version.js";
import type { DoctorCommandOptions } from "./commands/doctor.js";
import type { GenerateCommandOptions } from "./commands/generate.js";
import type { InitCommandOptions } from "./commands/init.js";
import type { MigrateCommandOptions } from "./commands/migrate.js";
import type { ValidateCommandOptions } from "./commands/validate.js";

export const createCli = (): Command => {
  const program = new Command();

  program
    .name("@rexeus/typeweaver")
    .description("Type-safe API framework with code generation for TypeScript")
    .version(getCliVersion())
    .addOption(
      new Option("--verbose", "show debug diagnostics").conflicts("quiet")
    )
    .addOption(
      new Option("--quiet", "suppress non-error output").conflicts("verbose")
    )
    .option("--no-color", "disable ANSI colors in CLI output");

  program
    .command("doctor")
    .description(
      "Run read-only setup diagnostics for the current Typeweaver project"
    )
    .option(
      "-c, --config <configFile>",
      "path to a .js, .mjs, or .cjs configuration file"
    )
    .option(
      "--deep",
      "run deeper spec bundle/import checks in a temp directory"
    )
    .action(async (_options, command) => {
      await handleDoctorCommand(
        command.optsWithGlobals() as DoctorCommandOptions
      );
    });

  program
    .command("generate")
    .description("Generate types, validators, and clients from an API spec")
    .option("-i, --input <inputPath>", "path to spec entrypoint file")
    .option("-o, --output <outputDir>", "output directory for generated files")
    .option(
      "-c, --config <configFile>",
      "path to a .js, .mjs, or .cjs configuration file"
    )
    .option("-p, --plugins <plugins>", "comma-separated list of plugins to use")
    .option("--format", "format generated code with oxfmt (default: true)")
    .option("--no-format", "disable code formatting")
    .option(
      "--clean",
      "clean output directory before generation (default: true)"
    )
    .option("--no-clean", "disable cleaning output directory")
    .option("-w, --watch", "watch for changes and regenerate automatically")
    .option("--dry-run", "run generation without mutating the output directory")
    .action(async (_options, command) => {
      await handleGenerateCommand(
        command.optsWithGlobals() as GenerateCommandOptions
      );
    });

  program
    .command("validate")
    .description("Validate a spec entrypoint without writing generated output")
    .option("-i, --input <inputPath>", "path to spec entrypoint file")
    .option(
      "-c, --config <configFile>",
      "path to a .js, .mjs, or .cjs configuration file"
    )
    .option("--strict", "treat warnings as errors")
    .option(
      "--fail-on <severity>",
      "exit non-zero when any issue of this severity or higher is emitted (error|warning|info)"
    )
    .option(
      "--disable <codes>",
      "comma-separated issue codes to silence (e.g. TW-STYLE-001,TW-STYLE-002)"
    )
    .option(
      "--enable <codes>",
      "comma-separated issue codes that default to disabled but should run"
    )
    .option("--plugins", "run plugin-contributed validators (default)")
    .option("--no-plugins", "skip plugin-contributed validators")
    .option("--json", "emit a machine-readable ValidationReport on stdout")
    .action(async (_options, command) => {
      await handleValidateCommand(
        command.optsWithGlobals() as ValidateCommandOptions
      );
    });

  program
    .command("init")
    .description("Create a starter spec and config in the current project")
    .option("-o, --output <outputDir>", "output directory for generated files")
    .option(
      "-p, --plugins <plugins>",
      "comma-separated list of plugins to add to the generated config"
    )
    .option("-f, --force", "overwrite starter files if they already exist")
    .option(
      "--config-format <format>",
      "config file format: mjs, cjs, or js (default: mjs)"
    )
    .action(async (_options, command) => {
      await handleInitCommand(command.optsWithGlobals() as InitCommandOptions);
    });

  program
    .command("migrate")
    .description(
      "Show read-only migration guidance for older Typeweaver projects"
    )
    .option("--from <version>", "override the detected Typeweaver version")
    .action(async (_options, command) => {
      await handleMigrateCommand(
        command.optsWithGlobals() as MigrateCommandOptions
      );
    });

  return program;
};
