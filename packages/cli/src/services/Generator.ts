import { ContextBuilder, PluginRegistry } from "@rexeus/typeweaver-gen";
import { Effect } from "effect";
import {
  ReservedCoordinationPathError,
  UnsafeSharedTempDirectoryError,
  UnsafeStagingRootError,
} from "../errors/index.js";
import { Formatter } from "./Formatter.js";
import {
  DEFAULT_PLUGIN_RESOLUTION_STRATEGIES,
  defaultRequiredPlugins,
} from "./generatorDefaults.js";
import { IndexFileGenerator } from "./IndexFileGenerator.js";
import {
  prepareGeneration,
  resolveGenerationPaths,
  runGeneratorPostprocessing,
  runPluginLifecycle,
  withGenerationLock,
} from "./internal/generatorWorkflows.js";
import { PluginLoader } from "./PluginLoader.js";
import { SpecLoader } from "./SpecLoader.js";
import type { GenerateParams } from "./generatorTypes.js";

/**
 * Effect-native top-level generator orchestrator. The focused internal
 * workflows own preflight/locking, plugin lifecycle, and postprocessing;
 * this service remains the single composition boundary from user params to
 * a completed generation.
 */
export class Generator extends Effect.Service<Generator>()(
  "typeweaver/Generator",
  {
    effect: Effect.gen(function* () {
      const contextBuilder = yield* ContextBuilder;
      const pluginLoader = yield* PluginLoader;
      const specLoader = yield* SpecLoader;
      const formatter = yield* Formatter;
      const indexFileGenerator = yield* IndexFileGenerator;

      const generate = Effect.fn("typeweaver.Generator.generate")(function* (
        params: GenerateParams
      ) {
        yield* Effect.annotateCurrentSpan({
          inputFile: params.inputFile,
          outputDir: params.outputDir,
        });
        yield* Effect.logInfo("Starting generation...");

        const paths = yield* Effect.try({
          try: () => resolveGenerationPaths(params),
          catch: error => {
            if (
              error instanceof ReservedCoordinationPathError ||
              error instanceof UnsafeSharedTempDirectoryError ||
              error instanceof UnsafeStagingRootError
            ) {
              return error;
            }
            throw error;
          },
        });
        yield* Effect.logDebug(
          `Input file: '${paths.inputFile}'; output dir: '${paths.outputDir}'`
        );

        const registry = yield* PluginRegistry.createInstance();
        const plan = yield* prepareGeneration(paths);

        yield* withGenerationLock(plan, lockedPlan =>
          Effect.gen(function* () {
            yield* pluginLoader.loadAll({
              registry,
              requiredPlugins: defaultRequiredPlugins(),
              strategies: DEFAULT_PLUGIN_RESOLUTION_STRATEGIES,
              config: params.config,
            });

            yield* Effect.logInfo(
              `Bundling spec from '${lockedPlan.inputFile}' to '${lockedPlan.specOutputDir}'...`
            );
            const normalizedSpec = (yield* specLoader.load({
              inputFile: lockedPlan.inputFile,
              specOutputDir: lockedPlan.specOutputDir,
              isolatedImport: params.stagingAuthority !== undefined,
              ...(params.externalImportBase === undefined
                ? {}
                : { externalImportBase: params.externalImportBase }),
            })).normalizedSpec;

            const pluginContext = yield* contextBuilder.buildPluginContext({
              outputDir: lockedPlan.outputDir,
              inputDir: lockedPlan.inputDir,
              config: lockedPlan.userConfig,
            });
            const initial = yield* registry.getAll;

            const result = yield* runPluginLifecycle(
              {
                plan: lockedPlan,
                initial,
                normalizedSpec,
                pluginContext,
              },
              { contextBuilder, indexFileGenerator }
            );

            yield* runGeneratorPostprocessing(lockedPlan, result, formatter);
          })
        );
      });

      return { generate } as const;
    }),
    dependencies: [
      ContextBuilder.Default,
      Formatter.Default,
      IndexFileGenerator.Default,
      PluginLoader.Default,
      PluginRegistry.Default,
      SpecLoader.Default,
    ],
    accessors: true,
  }
) {}
