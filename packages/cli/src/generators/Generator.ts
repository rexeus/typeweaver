import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PluginContextBuilder, PluginRegistry } from "@rexeus/typeweaver-gen";
import type { PluginConfig, TypeweaverConfig } from "@rexeus/typeweaver-gen";
import TypesPlugin from "@rexeus/typeweaver-types";
import { Formatter } from "./Formatter";
import { IndexFileGenerator } from "./IndexFileGenerator";
import { PluginLoader } from "./PluginLoader";
import { SpecLoader } from "./SpecLoader";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));

/**
 * Main generator for typeweaver
 * Uses a plugin-based architecture for extensible code generation
 */
export class Generator {
  public readonly coreDir = "@rexeus/typeweaver-core";
  public readonly templateDir = path.join(moduleDir, "templates");

  private readonly registry: PluginRegistry;
  private readonly contextBuilder: PluginContextBuilder;
  private readonly pluginLoader: PluginLoader;
  private readonly indexFileGenerator: IndexFileGenerator;
  private readonly specLoader: SpecLoader;
  private formatter: Formatter | null = null;

  private inputFile = "";
  private outputDir = "";
  private specOutputDir = "";
  private responsesOutputDir = "";

  public constructor(
    registry?: PluginRegistry,
    contextBuilder?: PluginContextBuilder,
    pluginLoader?: PluginLoader,
    indexFileGenerator?: IndexFileGenerator,
    requiredPlugins: [TypesPlugin] = [new TypesPlugin()]
  ) {
    this.registry = registry ?? new PluginRegistry();
    this.contextBuilder = contextBuilder ?? new PluginContextBuilder();
    this.pluginLoader =
      pluginLoader ?? new PluginLoader(this.registry, requiredPlugins);
    this.indexFileGenerator =
      indexFileGenerator ?? new IndexFileGenerator(this.templateDir);
    this.specLoader = new SpecLoader();
  }

  /**
   * Generate code using the plugin system
   */
  public async generate(
    specFile: string,
    outputDir: string,
    config?: TypeweaverConfig
  ): Promise<void> {
    console.info("Starting generation...");

    // Initialize directories
    this.initializeDirectories(specFile, outputDir);

    // Clean output if requested
    if (config?.clean ?? true) {
      console.info("Cleaning output directory...");
      fs.rmSync(this.outputDir, { recursive: true, force: true });
    }

    // Create output directories
    fs.mkdirSync(this.outputDir, { recursive: true });
    fs.mkdirSync(this.responsesOutputDir, { recursive: true });
    fs.mkdirSync(this.specOutputDir, { recursive: true });

    // Load and register plugins
    await this.pluginLoader.loadPlugins(config);

    this.formatter = new Formatter(this.outputDir);

    console.info(
      `Bundling spec from '${this.inputFile}' to '${this.specOutputDir}'...`
    );
    let { normalizedSpec } = await this.specLoader.load({
      inputFile: this.inputFile,
      specOutputDir: this.specOutputDir,
    });

    // Create contexts
    const pluginContext = this.contextBuilder.createPluginContext({
      outputDir: this.outputDir,
      inputDir: path.dirname(this.inputFile),
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
        normalizedSpec =
          await registration.plugin.collectResources(normalizedSpec);
      }
    }

    // Create generator context
    const generatorContext = this.contextBuilder.createGeneratorContext({
      outputDir: this.outputDir,
      inputDir: path.dirname(this.inputFile),
      config: (config ?? {}) as PluginConfig,
      normalizedSpec,
      templateDir: this.templateDir,
      coreDir: this.coreDir,
      responsesOutputDir: this.responsesOutputDir,
      specOutputDir: this.specOutputDir,
    });

    // Run generation for each plugin
    console.info("Generating code...");
    for (const registration of this.registry.getAll()) {
      console.info(`Running plugin: ${registration.plugin.name}`);
      if (registration.plugin.generate) {
        await registration.plugin.generate(generatorContext);
      }
    }

    this.indexFileGenerator.generate(generatorContext);

    // Finalize plugins
    console.info("Finalizing plugins...");
    for (const registration of this.registry.getAll()) {
      if (registration.plugin.finalize) {
        await registration.plugin.finalize(pluginContext);
      }
    }

    // Format code if requested
    if (config?.format ?? true) {
      await this.formatter.formatCode();
    }

    console.info("Generation complete!");
    console.info(
      `Generated files: ${this.contextBuilder.getGeneratedFiles().length}`
    );
  }

  private initializeDirectories(specFile: string, outputDir: string): void {
    this.inputFile = specFile;
    this.outputDir = outputDir;
    this.responsesOutputDir = path.join(outputDir, "responses");
    this.specOutputDir = path.join(this.outputDir, "spec");
  }
}
