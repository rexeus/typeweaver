import path from "node:path";
import { createPluginRegistry, normalizeSpec } from "@rexeus/typeweaver-gen";
import type { PluginConfig, TypeweaverConfig } from "@rexeus/typeweaver-gen";
import { TypesPlugin } from "@rexeus/typeweaver-types";
import { resolveCommandPath } from "../commands/shared.js";
import { assertSafeCleanTarget } from "../generators/generator.js";
import { loadPlugins } from "../generators/pluginLoader.js";
import { bundle } from "../generators/spec/specBundler.js";
import { createSpecDependencyResolutionBridge } from "../generators/spec/specDependencyResolution.js";
import { importDefinition } from "../generators/spec/specImporter.js";
import { NOOP_LOGGER } from "../logger.js";

export const resolveInputPath = (
  execDir: string,
  inputPath: string
): string => {
  return resolveCommandPath(execDir, inputPath);
};

export const resolveOutputPath = (
  execDir: string,
  outputPath: string
): string => {
  return resolveCommandPath(execDir, outputPath);
};

export const assertOutputPathSafety = (config: {
  readonly execDir: string;
  readonly outputPath: string;
  readonly loadedConfig?: Partial<TypeweaverConfig>;
}): { readonly resolvedOutputPath: string; readonly cleanEnabled: boolean } => {
  const resolvedOutputPath = resolveOutputPath(
    config.execDir,
    config.outputPath
  );
  const cleanEnabled = config.loadedConfig?.clean ?? true;

  if (cleanEnabled) {
    assertSafeCleanTarget(resolvedOutputPath, config.execDir);
  }

  return {
    resolvedOutputPath,
    cleanEnabled,
  };
};

export const resolveOptionalPlugins = async (config: {
  readonly input: string;
  readonly output: string;
  readonly plugins: readonly (string | readonly [string, ...unknown[]])[];
}): Promise<void> => {
  const registry = createPluginRegistry();

  await loadPlugins(
    registry,
    [new TypesPlugin()],
    ["npm", "local"],
    NOOP_LOGGER,
    {
      input: config.input,
      output: config.output,
      plugins: config.plugins.map(plugin => {
        if (typeof plugin === "string") {
          return plugin;
        }

        return [plugin[0], (plugin[1] ?? {}) as PluginConfig];
      }),
    }
  );
};

export const bundleInputSpec = async (config: {
  readonly inputFile: string;
  readonly temporaryDirectory: string;
}): Promise<string> => {
  return bundle({
    inputFile: config.inputFile,
    specOutputDir: path.join(config.temporaryDirectory, "spec-bundle"),
  });
};

export const inspectBundledSpec = async (config: {
  readonly bundledSpecFile: string;
  readonly inputFile: string;
}): Promise<{
  readonly resourceCount: number;
  readonly operationCount: number;
  readonly responseCount: number;
}> => {
  const cleanupDependencyResolutionBridge =
    createSpecDependencyResolutionBridge({
      specExecutionDir: path.dirname(config.bundledSpecFile),
      inputFile: config.inputFile,
    });
  const definition = await importDefinition(config.bundledSpecFile).finally(
    () => {
      cleanupDependencyResolutionBridge();
    }
  );
  const normalizedSpec = normalizeSpec(definition);
  const operationCount = normalizedSpec.resources.reduce(
    (count, resource) => count + resource.operations.length,
    0
  );

  return {
    resourceCount: normalizedSpec.resources.length,
    operationCount,
    responseCount: normalizedSpec.responses.length,
  };
};
