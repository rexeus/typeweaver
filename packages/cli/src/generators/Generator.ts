import { ResourceReader } from "./ResourceReader";
import path from "path";
import fs from "fs";
import { Prettier } from "./Prettier";
import { fileURLToPath } from "url";
import {
  PluginContextBuilder,
  PluginRegistry,
  type PluginConfig,
  type TypeWeaverConfig,
  type TypeWeaverPlugin,
} from "@rexeus/typeweaver-gen";
import TypesPlugin from "@rexeus/typeweaver-types";
import { IndexFileGenerator } from "./IndexFileGenerator";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Main generator for TypeWeaver
 * Uses a plugin-based architecture for extensible code generation
 */
export class Generator {
  public static outputDir: string;
  public static sourceDir: string;
  public static sharedSourceDir: string;
  public static sharedOutputDir: string;

  public static readonly coreDir = "@rexeus/typeweaver-core";
  public static readonly templateDir = path.join(__dirname, "templates");

  private static registry = new PluginRegistry();
  private static contextBuilder = new PluginContextBuilder();

  /**
   * Generate code using the plugin system
   */
  public static async generate(
    definitionDir: string,
    outputDir: string,
    config?: TypeWeaverConfig
  ): Promise<void> {
    console.info("Starting generation...");

    // Set directories
    this.outputDir = outputDir;
    this.sourceDir = definitionDir;
    this.sharedSourceDir = path.join(definitionDir, "shared");
    this.sharedOutputDir = path.join(outputDir, "shared");

    // Clean output if requested
    if (config?.clean ?? true) {
      console.info("Cleaning output directory...");
      fs.rmSync(this.outputDir, { recursive: true, force: true });
    }

    // Create output directories
    fs.mkdirSync(this.outputDir, { recursive: true });
    fs.mkdirSync(this.sharedOutputDir, { recursive: true });

    // Load and register plugins
    await this.loadPlugins(config);

    // Set static properties for ResourceReader (temporary compatibility)
    Generator.sourceDir = this.sourceDir;
    Generator.sharedSourceDir = this.sharedSourceDir;
    Generator.outputDir = this.outputDir;
    Generator.sharedOutputDir = this.sharedOutputDir;

    // Read resources
    console.info("Reading definitions...");
    let resources = await ResourceReader.getResources();

    // Create contexts
    const pluginContext = this.contextBuilder.createPluginContext({
      outputDir: this.outputDir,
      inputDir: this.sourceDir,
      config: (config ?? {}) as PluginConfig,
    });

    // Initialize plugins
    console.info("Initializing plugins...");
    for (const registration of this.registry.getAll()) {
      if (registration.plugin.initialize) {
        await registration.plugin.initialize(pluginContext);
      }
    }

    // Let plugins collect/transform resources
    console.info("Collecting resources...");
    for (const registration of this.registry.getAll()) {
      if (registration.plugin.collectResources) {
        resources = await registration.plugin.collectResources(resources);
      }
    }

    // Create generator context
    const generatorContext = this.contextBuilder.createGeneratorContext({
      outputDir: this.outputDir,
      inputDir: this.sourceDir,
      config: (config ?? {}) as PluginConfig,
      resources,
      templateDir: this.templateDir,
      coreDir: this.coreDir,
    });

    // Run generation for each plugin
    console.info("Generating code...");
    for (const registration of this.registry.getAll()) {
      console.info(`Running plugin: ${registration.plugin.name}`);
      if (registration.plugin.generate) {
        await registration.plugin.generate(generatorContext);
      }
    }

    IndexFileGenerator.generate(generatorContext);

    // Finalize plugins
    console.info("Finalizing plugins...");
    for (const registration of this.registry.getAll()) {
      if (registration.plugin.finalize) {
        await registration.plugin.finalize(pluginContext);
      }
    }

    // Format code if requested
    if (config?.prettier ?? true) {
      await Prettier.formatCode();
    }

    console.info("Generation complete!");
    console.info(
      `Generated files: ${this.contextBuilder.getGeneratedFiles().length}`
    );
  }

  static async loadPlugins(config?: TypeWeaverConfig) {
    // types is an always required plugin
    this.registry.register(new TypesPlugin());

    if (!config || !config.plugins) {
      return;
    }

    for (const plugin of config.plugins) {
      if (typeof plugin === "string") {
        const possiblePluginPaths = [
          `@rexeus/typeweaver-${plugin}`,
          `@rexeus/${plugin}`,
          plugin,
        ];

        let twPlugin: TypeWeaverPlugin | undefined = undefined;
        for (const possiblePath of possiblePluginPaths) {
          try {
            const pluginPackage = await import(possiblePath);
            if (pluginPackage.default) {
              twPlugin = new pluginPackage.default();
              break;
            }
          } catch {
            //
          }
        }

        if (twPlugin) {
          this.registry.register(twPlugin);
          continue;
        } else {
          console.warn(`Plugin '${plugin}' not found. Skipping registration.`);
        }
      }
    }
  }
}
