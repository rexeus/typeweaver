import type { GetResourcesResult } from "../Resource";

/**
 * Configuration for a TypeWeaver plugin
 */
export type PluginConfig = Record<string, unknown>;

/**
 * Context provided to plugins during initialization and finalization
 */
export type PluginContext = {
  outputDir: string;
  inputDir: string;
  config: PluginConfig;
}

/**
 * Context provided to plugins during generation
 */
export type GeneratorContext = PluginContext & {
  resources: GetResourcesResult;
  templateDir: string;
  coreDir: string;

  // Utility functions
  writeFile: (relativePath: string, content: string) => void;
  renderTemplate: (templatePath: string, data: unknown) => string;
  addGeneratedFile: (relativePath: string) => void;
  getGeneratedFiles: () => string[];
}

/**
 * Plugin metadata
 */
export type PluginMetadata = {
  name: string;
}

/**
 * TypeWeaver plugin interface
 */
export type TypeWeaverPlugin = PluginMetadata & {
  /**
   * Initialize the plugin
   * Called before any generation happens
   */
  initialize?(context: PluginContext): Promise<void> | void;

  /**
   * Collect and transform resources
   * Allows plugins to modify the resource collection
   */
  collectResources?(
    resources: GetResourcesResult
  ): Promise<GetResourcesResult> | GetResourcesResult;

  /**
   * Main generation logic
   * Called with all resources and utilities
   */
  generate?(context: GeneratorContext): Promise<void> | void;

  /**
   * Finalize the plugin
   * Called after all generation is complete
   */
  finalize?(context: PluginContext): Promise<void> | void;
}

/**
 * Plugin constructor type
 */
export type PluginConstructor = new (config?: PluginConfig) => TypeWeaverPlugin;

/**
 * Plugin module export
 */
export type PluginModule = {
  default: PluginConstructor;
}

/**
 * Plugin registration entry
 */
export type PluginRegistration = {
  name: string;
  plugin: TypeWeaverPlugin;
  config?: PluginConfig;
}

/**
 * TypeWeaver configuration
 */
export type TypeWeaverConfig = {
  input: string;
  output: string;
  shared?: string;
  plugins?: (string | [string, PluginConfig])[];
  prettier?: boolean;
  clean?: boolean;
}

/**
 * Plugin loading error
 */
export class PluginLoadError extends Error {
  constructor(
    public pluginName: string,
    message: string
  ) {
    super(`Failed to load plugin '${pluginName}': ${message}`);
    this.name = "PluginLoadError";
  }
}

/**
 * Plugin dependency error
 */
export class PluginDependencyError extends Error {
  constructor(
    public pluginName: string,
    public missingDependency: string
  ) {
    super(
      `Plugin '${pluginName}' depends on '${missingDependency}' which is not loaded`
    );
    this.name = "PluginDependencyError";
  }
}
