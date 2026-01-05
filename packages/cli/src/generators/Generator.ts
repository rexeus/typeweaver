import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PluginContextBuilder, PluginRegistry } from "@rexeus/typeweaver-gen";
import TypesPlugin from "@rexeus/typeweaver-types";
import type { PluginConfig, TypeweaverConfig } from "@rexeus/typeweaver-gen";
import { IndexFileGenerator } from "./IndexFileGenerator";
import { PluginLoader } from "./PluginLoader";
import { Prettier } from "./Prettier";
import { ResourceReader } from "./ResourceReader";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Main generator for typeweaver
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

  private inputDir = "";
  private sharedInputDir = "";
  private outputDir = "";
  private sourceDir = "";
  private sharedSourceDir = "";
  private sharedOutputDir = "";

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
    config?: TypeweaverConfig
  ): Promise<void> {
    console.info("Starting generation...");

    // Initialize directories
    this.initializeDirectories(definitionDir, outputDir, config?.shared);

    // Clean output if requested
    if (config?.clean ?? true) {
      console.info("Cleaning output directory...");
      fs.rmSync(this.outputDir, { recursive: true, force: true });
    }

    // Create output directories
    fs.mkdirSync(this.outputDir, { recursive: true });
    fs.mkdirSync(this.sharedOutputDir, { recursive: true });

    console.info(
      `Copying definitions from '${this.inputDir}' to '${this.sourceDir}'...`
    );
    fs.cpSync(this.inputDir, this.sourceDir, {
      recursive: true,
      filter: src => {
        return (
          src.endsWith(".ts") ||
          src.endsWith(".js") ||
          src.endsWith(".json") ||
          src.endsWith(".mjs") ||
          src.endsWith(".cjs") ||
          fs.statSync(src).isDirectory()
        );
      },
    });

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
    outputDir: string,
    sharedDir?: string
  ): void {
    this.inputDir = definitionDir;
    this.sharedInputDir = sharedDir ?? path.join(definitionDir, "shared");
    this.outputDir = outputDir;
    this.sharedOutputDir = path.join(outputDir, "shared");
    this.sourceDir = path.join(this.outputDir, "definition");
    const inputToSharedDirRelative = path.relative(
      this.inputDir,
      this.sharedInputDir
    );
    this.sharedSourceDir = path.join(this.sourceDir, inputToSharedDirRelative);
  }
}
