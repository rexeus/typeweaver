import type { NormalizedResponse, NormalizedSpec } from "../NormalizedSpec.js";

/**
 * Configuration for a typeweaver plugin
 */
export type PluginConfig = Record<string, unknown>;

/**
 * Context provided to plugins during initialization and finalization
 */
export type PluginContext = {
  readonly pluginName: string;
  readonly outputDir: string;
  readonly inputDir: string;
  readonly config: PluginConfig;
};

export type OperationOutputPaths = {
  readonly outputDir: string;
  readonly requestFile: string;
  readonly requestFileName: string;
  readonly responseFile: string;
  readonly responseFileName: string;
  readonly requestValidationFile: string;
  readonly requestValidationFileName: string;
  readonly responseValidationFile: string;
  readonly responseValidationFileName: string;
  readonly clientFile: string;
  readonly clientFileName: string;
};

export type OperationImportPaths = {
  readonly outputDir: string;
  readonly requestFile: string;
  readonly responseFile: string;
  readonly requestValidationFile: string;
  readonly responseValidationFile: string;
  readonly clientFile: string;
};

/**
 * Context provided to plugins during generation
 */
export type GeneratorContext = PluginContext & {
  readonly normalizedSpec: NormalizedSpec;
  readonly coreDir: string;
  readonly responsesOutputDir: string;
  readonly specOutputDir: string;

  readonly getPluginOutputDir: (pluginName: string) => string;
  readonly getPluginResourceOutputDir: (params: {
    readonly pluginName: string;
    readonly resourceName: string;
  }) => string;
  readonly getCanonicalResponse: (responseName: string) => NormalizedResponse;
  readonly getCanonicalResponseOutputFile: (responseName: string) => string;
  readonly getCanonicalResponseImportPath: (params: {
    readonly importerDir: string;
    readonly responseName: string;
  }) => string;
  readonly getSpecImportPath: (params: {
    readonly importerDir: string;
  }) => string;
  readonly getOperationDefinitionAccessor: (params: {
    readonly resourceName: string;
    readonly operationId: string;
  }) => string;
  readonly getOperationOutputPaths: (params: {
    readonly pluginName?: string;
    readonly resourceName: string;
    readonly operationId: string;
  }) => OperationOutputPaths;
  readonly getOperationImportPaths: (params: {
    readonly importerDir: string;
    readonly pluginName: string;
    readonly resourceName: string;
    readonly operationId: string;
  }) => OperationImportPaths;
  readonly getResourceOutputDir: (resourceName: string) => string;
  readonly getLibImportPath: (params: {
    readonly importerDir: string;
    readonly pluginName: string;
    readonly entry?: string;
  }) => string;
  readonly writeFile: (relativePath: string, content: string) => void;
  readonly renderTemplate: (templatePath: string, data: unknown) => string;
  readonly addGeneratedFile: (relativePath: string) => void;
  readonly getGeneratedFiles: () => string[];
};

/**
 * Plugin metadata
 */
export type PluginMetadata = {
  readonly name: string;
  readonly depends?: readonly string[];
};

/**
 * typeweaver plugin interface
 */
export type TypeweaverPlugin = PluginMetadata & {
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
    normalizedSpec: NormalizedSpec
  ): Promise<NormalizedSpec> | NormalizedSpec;

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
};

/**
 * Plugin constructor type
 */
export type PluginConstructor = new (config?: PluginConfig) => TypeweaverPlugin;

/**
 * Plugin module export
 */
export type PluginModule = {
  default: PluginConstructor;
};

/**
 * Plugin registration entry
 */
export type PluginRegistration = {
  name: string;
  plugin: TypeweaverPlugin;
  config?: PluginConfig;
};

/**
 * typeweaver configuration
 */
export type TypeweaverConfig = {
  input: string;
  output: string;
  plugins?: (string | [string, PluginConfig])[];
  format?: boolean;
  clean?: boolean;
};

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
    public missingDependency: string,
    message?: string
  ) {
    super(
      message ??
        `Plugin '${pluginName}' depends on '${missingDependency}' which is not loaded`
    );
    this.name = "PluginDependencyError";
  }
}
