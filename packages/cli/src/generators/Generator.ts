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
} from "@rexeus/typeweaver-gen";
import { IndexFileGenerator } from "./IndexFileGenerator";
import { PluginLoader } from "./PluginLoader";
import TypesPlugin from "@rexeus/typeweaver-types";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Main generator for TypeWeaver
 * Uses a plugin-based architecture for extensible code generation
 */
export class Generator {
  public readonly coreDir = "@rexeus/typeweaver-core";
  public readonly templateDir = path.join(__dirname, "templates");

  private readonly registry: PluginRegistry;
  private readonly contextBuilder: PluginContextBuilder;
  private readonly pluginLoader: PluginLoader;
  private readonly indexFileGenerator: IndexFileGenerator;
  private resourceReader: ResourceReader | null = null;
  private prettier: Prettier | null = null;

  private outputDir: string = "";
  private sourceDir: string = "";
  private sharedSourceDir: string = "";
  private sharedOutputDir: string = "";

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
  }

  /**
   * Generate code using the plugin system
   */
  public async generate(
    definitionDir: string,
    outputDir: string,
    config?: TypeWeaverConfig
  ): Promise<void> {
    console.info("Starting generation...");

    // Initialize directories
    this.initializeDirectories(definitionDir, outputDir);

    // Clean output if requested
    if (config?.clean ?? true) {
      console.info("Cleaning output directory...");
      fs.rmSync(this.outputDir, { recursive: true, force: true });
    }

    // Create output directories
    fs.mkdirSync(this.outputDir, { recursive: true });
    fs.mkdirSync(this.sharedOutputDir, { recursive: true });

    // Load and register plugins
    await this.pluginLoader.loadPlugins(config);

    // Create ResourceReader instance
    this.resourceReader = new ResourceReader({
      sourceDir: this.sourceDir,
      outputDir: this.outputDir,
      sharedSourceDir: this.sharedSourceDir,
      sharedOutputDir: this.sharedOutputDir,
    });

    // Create Prettier instance
    this.prettier = new Prettier(this.outputDir);

    // Read resources
    console.info("Reading definitions...");
    let resources = await this.resourceReader.getResources();

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

    this.indexFileGenerator.generate(generatorContext);

    // Finalize plugins
    console.info("Finalizing plugins...");
    for (const registration of this.registry.getAll()) {
      if (registration.plugin.finalize) {
        await registration.plugin.finalize(pluginContext);
      }
    }

    // Format code if requested
    if (config?.prettier ?? true) {
      await this.prettier.formatCode();
    }

    console.info("Generation complete!");
    console.info(
      `Generated files: ${this.contextBuilder.getGeneratedFiles().length}`
    );
  }

  private initializeDirectories(
    definitionDir: string,
    outputDir: string
  ): void {
    this.sourceDir = definitionDir;
    this.outputDir = outputDir;
    this.sharedSourceDir = path.join(definitionDir, "shared");
    this.sharedOutputDir = path.join(outputDir, "shared");
  }
}
