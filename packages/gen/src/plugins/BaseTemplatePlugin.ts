import { BasePlugin } from "./BasePlugin";
import type { GeneratorContext } from "./types";
import fs from "fs";
import path from "path";
import ejs from "ejs";

/**
 * Base class for template-based generator plugins
 * Provides utilities for working with EJS templates
 */
export abstract class BaseTemplatePlugin extends BasePlugin {
  /**
   * Render an EJS template with the given data
   */
  protected renderTemplate(templatePath: string, data: unknown): string {
    const template = fs.readFileSync(templatePath, "utf8");
    return ejs.render(template, data as ejs.Data);
  }

  /**
   * Write a file relative to the output directory
   */
  protected writeFile(
    context: GeneratorContext,
    relativePath: string,
    content: string
  ): void {
    context.writeFile(relativePath, content);
  }

  /**
   * Ensure a directory exists
   */
  protected ensureDir(context: GeneratorContext, relativePath: string): void {
    const fullPath = path.join(context.outputDir, relativePath);
    fs.mkdirSync(fullPath, { recursive: true });
  }

  /**
   * Get the template path for this plugin
   */
  protected getTemplatePath(
    context: GeneratorContext,
    templateName: string
  ): string {
    return path.join(context.templateDir, templateName);
  }
}
