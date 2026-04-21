// oxlint-disable import/max-dependencies
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  createPluginContextBuilder,
  createPluginRegistry,
} from "@rexeus/typeweaver-gen";
import type {
  NormalizedSpec,
  PluginConfig,
  TypeweaverConfig,
} from "@rexeus/typeweaver-gen";
import { TypesPlugin } from "@rexeus/typeweaver-types";
import { createLogger } from "../logger.js";
import { ReservedPluginOutputDirectoryError } from "./errors/reservedPluginOutputDirectoryError.js";
import {
  collectRegisteredResources,
  createGeneratorContextFactory,
  finalizeRegisteredPlugins,
  formatGeneratedOutput,
  generateRegisteredFiles,
  initializeRegisteredPlugins,
  loadGeneratorPlugins,
  loadNormalizedSpec,
} from "./generatorSupport.js";
import type { GenerateSummary } from "../generationResult.js";
import type { Logger } from "../logger.js";
import type { PluginResolutionStrategy } from "./pluginLoader.js";

export type GeneratorConfig = TypeweaverConfig & {
  readonly dryRun?: boolean;
};

export type GeneratorOptions = {
  readonly requiredPlugins?: [TypesPlugin];
  readonly strategies?: PluginResolutionStrategy[];
  readonly logger?: Logger;
};

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const RESERVED_PLUGIN_OUTPUT_DIRECTORIES = new Set([
  "lib",
  "responses",
  "spec",
]);

export const assertSafeCleanTarget = (
  outputDir: string,
  currentWorkingDirectory: string
): void => {
  const trimmedOutputDir = outputDir.trim();
  if (trimmedOutputDir.length === 0) {
    throw new Error(
      "Refusing to clean an empty output directory path. Pass a dedicated generated output directory instead."
    );
  }

  const resolvedWorkingDirectory = path.resolve(currentWorkingDirectory);
  const resolvedOutputDir = path.resolve(
    resolvedWorkingDirectory,
    trimmedOutputDir
  );
  const filesystemRoot = path.parse(resolvedOutputDir).root;

  if (resolvedOutputDir === filesystemRoot) {
    throw new Error(
      `Refusing to clean '${outputDir}' because it resolves to the filesystem root.`
    );
  }

  if (resolvedOutputDir === resolvedWorkingDirectory) {
    throw new Error(
      `Refusing to clean '${outputDir}' because it resolves to the current working directory.`
    );
  }

  const protectedWorkspaceRoot = findProtectedWorkspaceRoot(
    resolvedWorkingDirectory
  );

  if (
    protectedWorkspaceRoot !== undefined &&
    resolvedOutputDir === protectedWorkspaceRoot
  ) {
    throw new Error(
      `Refusing to clean '${outputDir}' because it resolves to the inferred workspace root '${protectedWorkspaceRoot}'. Choose a dedicated output subdirectory instead.`
    );
  }
};

type GenerationPaths = {
  readonly inputFile: string;
  readonly outputDir: string;
  readonly generationOutputDir: string;
  readonly responsesOutputDir: string;
  readonly specOutputDir: string;
  readonly temporaryOutputDir: string | undefined;
};

export class Generator {
  public readonly coreDir = "@rexeus/typeweaver-core";
  public readonly templateDir = path.join(moduleDir, "templates");

  private readonly registry = createPluginRegistry();
  private readonly contextBuilder = createPluginContextBuilder();
  private readonly requiredPlugins: [TypesPlugin];
  private readonly strategies: PluginResolutionStrategy[];
  private readonly logger: Logger;

  public constructor(options: GeneratorOptions = {}) {
    this.requiredPlugins = options.requiredPlugins ?? [new TypesPlugin()];
    this.strategies = options.strategies ?? ["npm", "local"];
    this.logger = options.logger ?? createLogger();
  }

  public async generate(
    specFile: string,
    outputDir: string,
    config?: GeneratorConfig,
    currentWorkingDirectory: string = process.cwd()
  ): Promise<GenerateSummary> {
    this.logger.step("Starting generation...");
    this.contextBuilder.clearGeneratedFiles();

    const paths = resolveGenerationPaths(
      specFile,
      outputDir,
      currentWorkingDirectory,
      config?.dryRun ?? false
    );

    try {
      this.prepareOutputDirectories(paths, config, currentWorkingDirectory);

      const normalizedSpec = await this.runGenerationPipeline(paths, config);

      const warnings = await formatGeneratedOutput({
        generationOutputDir: paths.generationOutputDir,
        shouldFormat: config?.format ?? true,
      });

      const isDryRun = paths.temporaryOutputDir !== undefined;
      this.logger.success(
        `Generation complete${isDryRun ? " (dry run)" : ""}!`
      );

      return buildGenerateSummary({
        dryRun: isDryRun,
        outputDir: paths.outputDir,
        normalizedSpec,
        pluginCount:
          this.registry.getAll().length - this.requiredPlugins.length,
        generatedFiles: listGeneratedFiles(paths.generationOutputDir),
        warnings,
      });
    } finally {
      if (paths.temporaryOutputDir) {
        fs.rmSync(paths.temporaryOutputDir, { recursive: true, force: true });
      }
    }
  }

  private prepareOutputDirectories(
    paths: GenerationPaths,
    config: GeneratorConfig | undefined,
    currentWorkingDirectory: string
  ): void {
    const isDryRun = paths.temporaryOutputDir !== undefined;

    if ((config?.clean ?? true) && !isDryRun) {
      assertSafeCleanTarget(paths.outputDir, currentWorkingDirectory);
      this.logger.step("Cleaning output directory...");
      fs.rmSync(paths.outputDir, { recursive: true, force: true });
    }

    fs.mkdirSync(paths.generationOutputDir, { recursive: true });
    fs.mkdirSync(paths.responsesOutputDir, { recursive: true });
    fs.mkdirSync(paths.specOutputDir, { recursive: true });
  }

  private async runGenerationPipeline(
    paths: GenerationPaths,
    config: GeneratorConfig | undefined
  ): Promise<NormalizedSpec> {
    await loadGeneratorPlugins({
      registry: this.registry,
      requiredPlugins: this.requiredPlugins,
      strategies: this.strategies,
      logger: this.logger,
      generationConfig: config,
    });

    assertSafePluginOutputNamespaces(
      this.registry.getAll().map(registration => registration.plugin.name),
      paths.generationOutputDir
    );

    const isDryRun = paths.temporaryOutputDir !== undefined;
    this.logger.step(
      `Bundling spec from '${paths.inputFile}'${
        isDryRun ? " for dry-run preview" : ""
      }...`
    );
    let normalizedSpec = await loadNormalizedSpec({
      inputFile: paths.inputFile,
      specOutputDir: paths.specOutputDir,
    });

    const pluginContext = this.contextBuilder.createPluginContext({
      pluginName: "typeweaver",
      outputDir: paths.generationOutputDir,
      inputDir: path.dirname(paths.inputFile),
      config: (config ?? {}) as PluginConfig,
    });

    this.logger.step("Initializing plugins...");
    await initializeRegisteredPlugins({
      registry: this.registry,
      pluginContext,
    });

    this.logger.step("Collecting resources...");
    normalizedSpec = await collectRegisteredResources({
      registry: this.registry,
      normalizedSpec,
    });

    const createGeneratorContext = createGeneratorContextFactory({
      contextBuilder: this.contextBuilder,
      generationOutputDir: paths.generationOutputDir,
      inputFile: paths.inputFile,
      generationConfig: (config ?? {}) as PluginConfig,
      normalizedSpec,
      templateDir: this.templateDir,
      coreDir: this.coreDir,
      responsesOutputDir: paths.responsesOutputDir,
      specOutputDir: paths.specOutputDir,
    });

    this.logger.step("Generating code...");
    await generateRegisteredFiles({
      registry: this.registry,
      createGeneratorContext,
      templateDir: this.templateDir,
      indexGeneratorContext: createGeneratorContext("typeweaver"),
      logger: this.logger,
    });

    this.logger.step("Finalizing plugins...");
    await finalizeRegisteredPlugins({
      registry: this.registry,
      pluginContext,
    });

    return normalizedSpec;
  }
}

const resolveGenerationPaths = (
  specFile: string,
  outputDir: string,
  currentWorkingDirectory: string,
  isDryRun: boolean
): GenerationPaths => {
  const inputFile = path.resolve(currentWorkingDirectory, specFile);
  const resolvedOutputDir = path.resolve(currentWorkingDirectory, outputDir);
  const temporaryOutputDir = isDryRun
    ? fs.mkdtempSync(path.join(os.tmpdir(), "typeweaver-generate-"))
    : undefined;
  const generationOutputDir = temporaryOutputDir ?? resolvedOutputDir;

  return {
    inputFile,
    outputDir: resolvedOutputDir,
    generationOutputDir,
    responsesOutputDir: path.join(generationOutputDir, "responses"),
    specOutputDir: path.join(generationOutputDir, "spec"),
    temporaryOutputDir,
  };
};

const buildGenerateSummary = (config: {
  readonly dryRun: boolean;
  readonly outputDir: string;
  readonly normalizedSpec: NormalizedSpec;
  readonly pluginCount: number;
  readonly generatedFiles: readonly string[];
  readonly warnings: readonly string[];
}): GenerateSummary => {
  const operationCount = config.normalizedSpec.resources.reduce(
    (count, resource) => count + resource.operations.length,
    0
  );

  return {
    mode: "generate",
    dryRun: config.dryRun,
    targetOutputDir: config.outputDir,
    resourceCount: config.normalizedSpec.resources.length,
    operationCount,
    responseCount: config.normalizedSpec.responses.length,
    pluginCount: config.pluginCount,
    generatedFiles: config.generatedFiles,
    warnings: [...config.warnings],
  };
};

export const assertSafePluginOutputNamespaces = (
  pluginNames: readonly string[],
  outputDir: string
): void => {
  for (const pluginName of pluginNames) {
    if (!RESERVED_PLUGIN_OUTPUT_DIRECTORIES.has(pluginName)) {
      continue;
    }

    throw new ReservedPluginOutputDirectoryError(
      pluginName,
      path.join(outputDir, pluginName)
    );
  }
};

const listGeneratedFiles = (outputDir: string): string[] => {
  const generatedFiles: string[] = [];

  const visit = (currentDir: string): void => {
    for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
      const entryPath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        visit(entryPath);
        continue;
      }

      generatedFiles.push(
        path.relative(outputDir, entryPath).replaceAll("\\", "/")
      );
    }
  };

  if (fs.existsSync(outputDir)) {
    visit(outputDir);
  }

  return generatedFiles.sort();
};

const findProtectedWorkspaceRoot = (
  startDirectory: string
): string | undefined => {
  let currentDirectory = startDirectory;

  while (true) {
    if (hasWorkspaceMarker(currentDirectory)) {
      return currentDirectory;
    }

    const parentDirectory = path.dirname(currentDirectory);
    if (parentDirectory === currentDirectory) {
      return undefined;
    }

    currentDirectory = parentDirectory;
  }
};

const hasWorkspaceMarker = (directory: string): boolean => {
  return ["pnpm-workspace.yaml", ".git"].some(marker =>
    fs.existsSync(path.join(directory, marker))
  );
};
