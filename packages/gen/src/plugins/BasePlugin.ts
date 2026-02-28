import fs from "node:fs";
import path from "node:path";
import type { GetResourcesResult } from "../Resource";
import type {
  GeneratorContext,
  PluginConfig,
  PluginContext,
  TypeweaverPlugin,
} from "./types";

/**
 * Base class for typeweaver plugins
 * Provides default implementations and common utilities
 */
export abstract class BasePlugin implements TypeweaverPlugin {
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
  async initialize(_context: PluginContext): Promise<void> {
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
  async finalize(_context: PluginContext): Promise<void> {
    // Default: no finalization needed
  }

  protected copyLibFiles(
    context: GeneratorContext,
    libSourceDir: string,
    libNamespace: string
  ): void {
    if (!fs.existsSync(libSourceDir)) return;

    const libDir = path.join(context.outputDir, "lib", libNamespace);

    fs.cpSync(libSourceDir, libDir, { recursive: true });

    const libIndexPath = path.join("lib", libNamespace, "index.ts");
    if (fs.existsSync(path.join(libDir, "index.ts"))) {
      context.addGeneratedFile(libIndexPath);
    }
  }
}
