import type { PluginContext, GeneratorContext, PluginConfig } from "./types";
import fs from "fs";
import path from "path";
import ejs from "ejs";
import type { GetResourcesResult } from "../Resource";

/**
 * Builder for plugin contexts
 */
export class PluginContextBuilder {
  private generatedFiles = new Set<string>();

  /**
   * Create a basic plugin context
   */
  createPluginContext(params: {
    outputDir: string;
    inputDir: string;
    config: PluginConfig;
  }): PluginContext {
    return {
      outputDir: params.outputDir,
      inputDir: params.inputDir,
      config: params.config,
    };
  }

  /**
   * Create a generator context with utilities
   */
  createGeneratorContext(params: {
    outputDir: string;
    inputDir: string;
    config: PluginConfig;
    resources: GetResourcesResult;
    templateDir: string;
    coreDir: string;
  }): GeneratorContext {
    const pluginContext = this.createPluginContext(params);

    return {
      ...pluginContext,
      resources: params.resources,
      templateDir: params.templateDir,
      coreDir: params.coreDir,

      // Utility functions
      writeFile: (relativePath: string, content: string) => {
        const fullPath = path.join(params.outputDir, relativePath);
        const dir = path.dirname(fullPath);

        // Ensure directory exists
        fs.mkdirSync(dir, { recursive: true });

        // Write file
        fs.writeFileSync(fullPath, content);

        // Track generated file
        this.generatedFiles.add(relativePath);

        console.info(`Generated: ${relativePath}`);
      },

      renderTemplate: (templatePath: string, data: unknown) => {
        const fullTemplatePath = path.isAbsolute(templatePath)
          ? templatePath
          : path.join(params.templateDir, templatePath);

        const template = fs.readFileSync(fullTemplatePath, "utf8");
        return ejs.render(template, data as ejs.Data);
      },

      addGeneratedFile: (relativePath: string) => {
        this.generatedFiles.add(relativePath);
      },

      getGeneratedFiles: () => {
        return Array.from(this.generatedFiles);
      },
    };
  }

  /**
   * Get all generated files
   */
  getGeneratedFiles(): string[] {
    return Array.from(this.generatedFiles);
  }

  /**
   * Clear generated files tracking
   */
  clearGeneratedFiles(): void {
    this.generatedFiles.clear();
  }
}
