import { ContextBuilder, PluginRegistry } from "@rexeus/typeweaver-gen";
import { Effect } from "effect";
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

        const paths = resolveGenerationPaths(params);
        yield* Effect.logDebug(
          `Input file: '${paths.inputFile}'; output dir: '${paths.outputDir}'`
        );

        const registry = yield* PluginRegistry.createInstance();
        const plan = yield* prepareGeneration(paths);

        yield* withGenerationLock(
          plan,
          Effect.gen(function* () {
            yield* pluginLoader.loadAll({
              registry,
              requiredPlugins: defaultRequiredPlugins(),
              strategies: DEFAULT_PLUGIN_RESOLUTION_STRATEGIES,
              config: params.config,
            });

            yield* Effect.logInfo(
              `Bundling spec from '${plan.inputFile}' to '${plan.specOutputDir}'...`
            );
            const normalizedSpec = (yield* specLoader.load({
              inputFile: plan.inputFile,
              specOutputDir: plan.specOutputDir,
            })).normalizedSpec;

            const pluginContext = yield* contextBuilder.buildPluginContext({
              outputDir: plan.outputDir,
              inputDir: plan.inputDir,
              config: plan.userConfig,
            });
            const initial = yield* registry.getAll;

            const result = yield* runPluginLifecycle(
              {
                plan,
                initial,
                normalizedSpec,
                pluginContext,
              },
              { contextBuilder, indexFileGenerator }
            );

            yield* runGeneratorPostprocessing(plan, result, formatter);
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
