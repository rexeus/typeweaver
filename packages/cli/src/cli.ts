import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { TypeweaverConfig } from "@rexeus/typeweaver-gen";
import { Command } from "commander";
import { getResolvedConfigPath, loadConfig } from "./configLoader.js";
import { FileWatcher } from "./generators/fileWatcher.js";
import { Generator } from "./generators/generator.js";
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
  watch?: boolean;
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
  .option("-w, --watch", "watch for changes and regenerate automatically")
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

    // Override with CLI options
    const inputPath = options.input ?? config.input;
    const outputDir = options.output ?? config.output;
    // Validate required options
    if (!inputPath) {
      throw new Error(
        "No input spec entrypoint provided. Use --input or specify in config file."
      );
    }
    if (!outputDir) {
      throw new Error(
        "No output directory provided. Use --output or specify in config file."
      );
    }

    // Resolve paths
    const resolvedInputPath = path.isAbsolute(inputPath)
      ? inputPath
      : path.join(execDir, inputPath);
    const resolvedOutputDir = path.isAbsolute(outputDir)
      ? outputDir
      : path.join(execDir, outputDir);

    // Build final configuration
    const finalConfig: TypeweaverConfig = {
      input: resolvedInputPath,
      output: resolvedOutputDir,
      format: options.format ?? config.format ?? true,
      clean: options.clean ?? config.clean ?? true,
    };

    // Handle plugins
    if (options.plugins) {
      // Parse comma-separated plugins from CLI
      finalConfig.plugins = options.plugins.split(",").map(p => p.trim());
    } else if (config.plugins) {
      // Use plugins from config file
      finalConfig.plugins = config.plugins;
    }
    // If no plugins specified, Generator will use defaults

    // Run generation
    if (options.watch) {
      const watcher = new FileWatcher(
        resolvedInputPath,
        resolvedOutputDir,
        finalConfig
      );
      return watcher.watch();
    }

    const generator = new Generator();
    return generator.generate(
      resolvedInputPath,
      resolvedOutputDir,
      finalConfig,
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
