import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { TypeweaverConfig } from "@rexeus/typeweaver-gen";
import { Command } from "commander";
import { getResolvedConfigPath, loadConfig } from "./configLoader.js";
import { Generator } from "./generators/Generator.js";
import { resolveGenerateOptions } from "./resolveGenerateOptions.js";
import type { CommandOptions as CommanderOptions } from "commander";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const packageJson = JSON.parse(
  fs.readFileSync(path.join(moduleDir, "../package.json"), "utf-8")
) as {
  readonly version: string;
  readonly name: string;
  readonly description: string;
};

type CommandOptions = CommanderOptions & {
  input?: string;
  output?: string;
  config?: string;
  plugins?: string;
  format?: boolean;
  clean?: boolean;
};

const program = new Command();
const execDir = process.cwd();

program
  .name("@rexeus/typeweaver")
  .description("Type-safe API framework with code generation for TypeScript")
  .version(packageJson.version);

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
  .option("--clean", "clean output directory before generation (default: true)")
  .option("--no-clean", "disable cleaning output directory")
  .action(async (options: CommandOptions) => {
    let config: Partial<TypeweaverConfig> = {};

    // Load configuration file if provided
    if (options.config) {
      const configPath = getResolvedConfigPath(options.config, execDir);

      try {
        config = await loadConfig(configPath);
        console.info(`Loaded configuration from ${configPath}`);
      } catch (error) {
        console.error(`Failed to load configuration file: ${options.config}`);
        console.error(error);
        process.exit(1);
      }
    }

    const resolvedGenerateOptions = resolveGenerateOptions(
      options,
      config,
      execDir
    );

    // Run generation
    const generator = new Generator();
    return generator.generate(
      resolvedGenerateOptions.inputPath,
      resolvedGenerateOptions.outputDir,
      resolvedGenerateOptions.config,
      execDir
    );
  });

// Add future commands placeholder
program
  .command("init")
  .description("Initialize a new typeweaver project (coming soon)")
  .action(() => {
    console.log("The init command is coming soon!");
  });

program.parse(process.argv);
