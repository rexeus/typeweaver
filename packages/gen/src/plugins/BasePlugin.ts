import type { GetResourcesResult } from "../Resource";
import type {
  TypeWeaverPlugin,
  PluginConfig,
  PluginContext,
  GeneratorContext,
} from "./types";
import path from "path";
import fs from "fs";

/**
 * Base class for TypeWeaver plugins
 * Provides default implementations and common utilities
 */
export abstract class BasePlugin implements TypeWeaverPlugin {
  abstract name: string;
  description?: string;
  author?: string;
  depends?: string[];

  protected config: PluginConfig;

  constructor(config: PluginConfig = {}) {
    this.config = config;
  }

  /**
   * Default implementation - override in subclasses if needed
   */
  async initialize(context: PluginContext): Promise<void> {
    // Default: no initialization needed
  }

  /**
   * Default implementation - override in subclasses if needed
   */
  collectResources(resources: GetResourcesResult): GetResourcesResult {
    // Default: return resources unchanged
    return resources;
  }

  /**
   * Main generation logic - must be implemented by subclasses
   */
  abstract generate(context: GeneratorContext): Promise<void> | void;

  /**
   * Default implementation - override in subclasses if needed
   */
  async finalize(context: PluginContext): Promise<void> {
    // Default: no finalization needed
  }

  /**
   * Copy lib files from plugin package to generated lib folder
   */
  protected copyLibFiles(context: GeneratorContext, libSourceDir: string, libNamespace: string): void {
    const libDir = path.join(context.outputDir, "lib", libNamespace);
    
    // Ensure lib directory exists
    fs.mkdirSync(libDir, { recursive: true });
    
    // Copy all files from lib source to lib directory
    if (fs.existsSync(libSourceDir)) {
      const files = fs.readdirSync(libSourceDir);
      
      for (const file of files) {
        const sourcePath = path.join(libSourceDir, file);
        const targetPath = path.join(libDir, file);
        
        if (fs.statSync(sourcePath).isFile()) {
          fs.copyFileSync(sourcePath, targetPath);
        }
      }
    }
  }
}
