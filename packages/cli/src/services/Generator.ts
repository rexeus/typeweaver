import { ContextBuilder, PluginRegistry } from "@rexeus/typeweaver-gen";
import type {
  ContextBuilderShape,
  PluginRegistryInstance,
} from "@rexeus/typeweaver-gen";
import { Context, Effect, FileSystem, Layer } from "effect";
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
import { PluginLoader } from "./PluginLoaderService.js";
import { SpecLoader } from "./SpecLoader.js";
import type { FormatterShape } from "./Formatter.js";
import type { GenerateParams } from "./generatorTypes.js";
import type { IndexFileGeneratorShape } from "./IndexFileGenerator.js";
import type { PluginLoaderShape } from "./PluginLoaderService.js";
import type { SpecLoaderShape } from "./SpecLoader.js";

type LockedGenerationPlan = Parameters<
  Parameters<typeof withGenerationLock>[1]
>[0];

type LockedGenerationEnvironment = {
  readonly contextBuilder: ContextBuilderShape;
  readonly pluginLoader: PluginLoaderShape;
  readonly specLoader: SpecLoaderShape;
  readonly formatter: FormatterShape;
  readonly indexFileGenerator: IndexFileGeneratorShape;
  readonly registry: PluginRegistryInstance;
  readonly params: GenerateParams;
  readonly lockedPlan: LockedGenerationPlan;
};

const runLockedGeneration = ({
  contextBuilder,
  pluginLoader,
  specLoader,
  formatter,
  indexFileGenerator,
  registry,
  params,
  lockedPlan,
}: LockedGenerationEnvironment) =>
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
  });

/**
 * Effect-native top-level generator orchestrator. The focused internal
 * workflows own preflight/locking, plugin lifecycle, and postprocessing;
 * this service remains the single composition boundary from user params to
 * a completed generation.
 */
const makeGenerator = Effect.gen(function* () {
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
      runLockedGeneration({
        contextBuilder,
        pluginLoader,
        specLoader,
        formatter,
        indexFileGenerator,
        registry,
        params,
        lockedPlan,
      })
    );
  });

  return { generate } as const;
});

export type GeneratorShape = Effect.Success<typeof makeGenerator>;
export class Generator extends Context.Service<Generator, GeneratorShape>()(
  "typeweaver/Generator"
) {
  static readonly make = (service: GeneratorShape) => service;

  /**
   * Generator layer over un-provided dependency services. Production uses
   * `Generator.Default`; tests substitute fake dependency layers and merge
   * them with this layer.
   */
  static readonly DefaultWithoutDependencies: Layer.Layer<
    Generator,
    never,
    | ContextBuilder
    | Formatter
    | IndexFileGenerator
    | PluginLoader
    | PluginRegistry
    | SpecLoader
  > = Layer.effect(Generator, makeGenerator);

  static readonly Default: Layer.Layer<
    Generator,
    never,
    FileSystem.FileSystem
  > = Layer.effect(Generator, makeGenerator).pipe(
    Layer.provide(ContextBuilder.Default),
    Layer.provide(Formatter.Default),
    Layer.provide(IndexFileGenerator.Default),
    Layer.provide(PluginLoader.Default),
    Layer.provide(PluginRegistry.Default),
    Layer.provide(SpecLoader.Default)
  );

  static readonly generate = (params: GenerateParams) =>
    Generator.use(service => service.generate(params));
}
