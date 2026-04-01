import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  createPluginContextBuilder,
  createPluginRegistry,
} from "@rexeus/typeweaver-gen";
import type { PluginConfig, TypeweaverConfig } from "@rexeus/typeweaver-gen";
import { TypesPlugin } from "@rexeus/typeweaver-types";
import { formatCode } from "./formatter";
import { generateIndexFiles } from "./indexFileGenerator";
import { loadPlugins } from "./pluginLoader";
import { loadSpec } from "./specLoader";
import type { PluginResolutionStrategy } from "./pluginLoader";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));

/**
 * Main generator for typeweaver
 * Uses a plugin-based architecture for extensible code generation
 */
export class Generator {
  public readonly coreDir = "@rexeus/typeweaver-core";
  public readonly templateDir = path.join(moduleDir, "templates");

  private readonly registry = createPluginRegistry();
  private readonly contextBuilder = createPluginContextBuilder();
  private readonly requiredPlugins: [TypesPlugin];
  private readonly strategies: PluginResolutionStrategy[];

  private inputFile = "";
  private outputDir = "";
  private specOutputDir = "";
  private responsesOutputDir = "";

  public constructor(
    requiredPlugins: [TypesPlugin] = [new TypesPlugin()],
    strategies?: PluginResolutionStrategy[]
  ) {
    this.requiredPlugins = requiredPlugins;
    this.strategies = strategies ?? ["npm", "local"];
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

    this.initializeDirectories(specFile, outputDir);

    if (config?.clean ?? true) {
      console.info("Cleaning output directory...");
      fs.rmSync(this.outputDir, { recursive: true, force: true });
    }

    fs.mkdirSync(this.outputDir, { recursive: true });
    fs.mkdirSync(this.responsesOutputDir, { recursive: true });
    fs.mkdirSync(this.specOutputDir, { recursive: true });

    await loadPlugins(
      this.registry,
      this.requiredPlugins,
      this.strategies,
      config
    );

    console.info(
      `Bundling spec from '${this.inputFile}' to '${this.specOutputDir}'...`
    );
    let { normalizedSpec } = await loadSpec({
      inputFile: this.inputFile,
      specOutputDir: this.specOutputDir,
    });

    const pluginContext = this.contextBuilder.createPluginContext({
      outputDir: this.outputDir,
      inputDir: path.dirname(this.inputFile),
      config: (config ?? {}) as PluginConfig,
    });

    console.info("Initializing plugins...");
    for (const registration of this.registry.getAll()) {
      if (registration.plugin.initialize) {
        await registration.plugin.initialize(pluginContext);
      }
    }

    console.info("Collecting resources...");
    for (const registration of this.registry.getAll()) {
      if (registration.plugin.collectResources) {
        normalizedSpec =
          await registration.plugin.collectResources(normalizedSpec);
      }
    }

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

    console.info("Generating code...");
    for (const registration of this.registry.getAll()) {
      console.info(`Running plugin: ${registration.plugin.name}`);
      if (registration.plugin.generate) {
        await registration.plugin.generate(generatorContext);
      }
    }

    generateIndexFiles(this.templateDir, generatorContext);

    console.info("Finalizing plugins...");
    for (const registration of this.registry.getAll()) {
      if (registration.plugin.finalize) {
        await registration.plugin.finalize(pluginContext);
      }
    }

    if (config?.format ?? true) {
      await formatCode(this.outputDir);
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
