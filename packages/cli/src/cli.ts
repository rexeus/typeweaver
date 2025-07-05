import { Generator } from "./generators/Generator";
import { Command, type CommandOptions as CommanderOptions } from "commander";
import packageJson from "../package.json";
import path from "path";
import { pathToFileURL } from "url";
import type { TypeWeaverConfig } from "@rexeus/typeweaver-gen";

type CommandOptions = CommanderOptions & {
  input?: string;
  output?: string;
  config?: string;
  plugins?: string;
  prettier?: boolean;
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
  .description("Generate types, validators, and clients from API definitions")
  .option("-i, --input <inputDir>", "path to definition directory")
  .option("-o, --output <outputDir>", "output directory for generated files")
  .option("-c, --config <configFile>", "path to configuration file")
  .option("-p, --plugins <plugins>", "comma-separated list of plugins to use")
  .option("--prettier", "format generated code with Prettier (default: true)")
  .option("--no-prettier", "disable Prettier formatting")
  .option("--clean", "clean output directory before generation (default: true)")
  .option("--no-clean", "disable cleaning output directory")
  .action(async (options: CommandOptions) => {
    let config: Partial<TypeWeaverConfig> = {};

    // Load configuration file if provided
    if (options.config) {
      const configPath = path.isAbsolute(options.config)
        ? options.config
        : path.join(execDir, options.config);

      try {
        const configUrl = pathToFileURL(configPath).toString();
        const configModule = await import(configUrl);
        config = configModule.default ?? configModule;
        console.info(`Loaded configuration from ${configPath}`);
      } catch (error) {
        console.error(`Failed to load configuration file: ${options.config}`);
        console.error(error);
        process.exit(1);
      }
    }

    // Override with CLI options
    const inputDir = options.input ?? config.input;
    const outputDir = options.output ?? config.output;

    // Validate required options
    if (!inputDir) {
      throw new Error(
        "No input directory provided. Use --input or specify in config file."
      );
    }
    if (!outputDir) {
      throw new Error(
        "No output directory provided. Use --output or specify in config file."
      );
    }

    // Resolve paths
    const resolvedInputDir = path.isAbsolute(inputDir)
      ? inputDir
      : path.join(execDir, inputDir);
    const resolvedOutputDir = path.isAbsolute(outputDir)
      ? outputDir
      : path.join(execDir, outputDir);

    // Build final configuration
    const finalConfig: TypeWeaverConfig = {
      input: resolvedInputDir,
      output: resolvedOutputDir,
      prettier: options.prettier ?? config.prettier ?? true,
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
    const generator = new Generator();
    return generator.generate(resolvedInputDir, resolvedOutputDir, finalConfig);
  });

// Add future commands placeholder
program
  .command("init")
  .description("Initialize a new TypeWeaver project (coming soon)")
  .action(() => {
    console.log("The init command is coming soon!");
  });

program.parse(process.argv);
