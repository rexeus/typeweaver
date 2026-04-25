import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  createPluginContextBuilder,
  createPluginRegistry,
} from "@rexeus/typeweaver-gen";
import type { PluginConfig, TypeweaverConfig } from "@rexeus/typeweaver-gen";
import { TypesPlugin } from "@rexeus/typeweaver-types";
import { formatCode } from "./formatter.js";
import { generateIndexFiles } from "./indexFileGenerator.js";
import { loadPlugins } from "./pluginLoader.js";
import { loadSpec } from "./specLoader.js";
import type { PluginResolutionStrategy } from "./pluginLoader.js";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));

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
  const canonicalWorkingDirectory = fs.realpathSync.native(
    resolvedWorkingDirectory
  );
  const resolvedOutputDir = path.resolve(
    resolvedWorkingDirectory,
    trimmedOutputDir
  );
  const canonicalOutputDir = canonicalizePathForContainment(resolvedOutputDir);
  const filesystemRoot = path.parse(canonicalOutputDir).root;

  if (canonicalOutputDir === filesystemRoot) {
    throw new Error(
      `Refusing to clean '${outputDir}' because it resolves to the filesystem root.`
    );
  }

  if (
    resolvedOutputDir === resolvedWorkingDirectory ||
    canonicalOutputDir === canonicalWorkingDirectory
  ) {
    throw new Error(
      `Refusing to clean '${outputDir}' because it resolves to the current working directory.`
    );
  }

  const logicalProtectedWorkspaceRoot = findProtectedWorkspaceRoot(
    resolvedWorkingDirectory
  );
  const canonicalProtectedWorkspaceRoot = findProtectedWorkspaceRoot(
    canonicalWorkingDirectory
  );
  const protectedWorkspaceRoots = [
    logicalProtectedWorkspaceRoot,
    canonicalProtectedWorkspaceRoot,
  ].filter((root): root is string => root !== undefined);
  const protectedWorkspaceRootTarget = protectedWorkspaceRoots.find(
    protectedWorkspaceRoot =>
      resolvedOutputDir === protectedWorkspaceRoot ||
      canonicalOutputDir === fs.realpathSync.native(protectedWorkspaceRoot)
  );

  if (protectedWorkspaceRootTarget !== undefined) {
    throw new Error(
      `Refusing to clean '${outputDir}' because it resolves to the inferred workspace root '${protectedWorkspaceRootTarget}'. Choose a dedicated output subdirectory instead.`
    );
  }

  if (
    protectedWorkspaceRoots.length > 0 &&
    (isSameOrDescendantOf(resolvedWorkingDirectory, resolvedOutputDir) ||
      isSameOrDescendantOf(canonicalWorkingDirectory, canonicalOutputDir))
  ) {
    throw new Error(
      `Refusing to clean '${outputDir}' because it resolves to an ancestor directory of the current working directory. Choose a dedicated output subdirectory instead.`
    );
  }
};

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
    config?: TypeweaverConfig,
    currentWorkingDirectory: string = process.cwd()
  ): Promise<void> {
    console.info("Starting generation...");

    this.initializeDirectories(specFile, outputDir, currentWorkingDirectory);

    if (config?.clean ?? true) {
      assertSafeCleanTarget(this.outputDir, currentWorkingDirectory);
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

  private initializeDirectories(
    specFile: string,
    outputDir: string,
    currentWorkingDirectory: string
  ): void {
    this.inputFile = path.resolve(currentWorkingDirectory, specFile);
    this.outputDir = path.resolve(currentWorkingDirectory, outputDir);
    this.responsesOutputDir = path.join(this.outputDir, "responses");
    this.specOutputDir = path.join(this.outputDir, "spec");
  }
}

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

const canonicalizePathForContainment = (targetPath: string): string => {
  const remainingSegments: string[] = [];
  let nearestExistingPath = path.resolve(targetPath);

  while (!fs.existsSync(nearestExistingPath)) {
    const parentPath = path.dirname(nearestExistingPath);
    if (parentPath === nearestExistingPath) {
      break;
    }

    remainingSegments.unshift(path.basename(nearestExistingPath));
    nearestExistingPath = parentPath;
  }

  const canonicalExistingPath = fs.realpathSync.native(nearestExistingPath);

  return path.join(canonicalExistingPath, ...remainingSegments);
};

const isSameOrDescendantOf = (directory: string, ancestor: string): boolean => {
  const relativePath = path.relative(ancestor, directory);
  const parentTraversalPrefix = `..${path.sep}`;
  const escapesAncestor =
    relativePath === ".." || relativePath.startsWith(parentTraversalPrefix);

  return (
    relativePath === "" ||
    (!escapesAncestor && !path.isAbsolute(relativePath))
  );
};
