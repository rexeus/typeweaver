import type {
  ContextBuilderShape,
  GeneratorContext,
  NormalizedSpec,
  PluginContext,
  PluginRegistration,
} from "@rexeus/typeweaver-gen";
import { Cause, Effect, Exit } from "effect";
import { CORE_DIR } from "../generatorDefaults.js";
import { initializePlugins } from "./pluginInitialization.js";
import type { IndexFileGeneratorShape } from "../IndexFileGenerator.js";
import type { GenerationPlan } from "./generatorPreflight.js";
import type { InitializedPlugin } from "./pluginInitialization.js";

type PluginLifecycleDeps = {
  readonly contextBuilder: ContextBuilderShape;
  readonly indexFileGenerator: IndexFileGeneratorShape;
};

type PluginLifecycleParams = {
  readonly plan: GenerationPlan;
  readonly initial: readonly PluginRegistration[];
  readonly normalizedSpec: NormalizedSpec;
  readonly pluginContext: PluginContext;
};

type FinalizePluginsParams = {
  readonly plugins: readonly InitializedPlugin[];
  readonly pluginContext: PluginContext;
};

type GeneratePluginsParams = {
  readonly plugins: readonly InitializedPlugin[];
  readonly context: GeneratorContext;
  readonly flushGeneratedFileLogs: Effect.Effect<void>;
};

type GeneratedFileLogSource = {
  readonly drainPendingWriteLogs: () => readonly string[];
};

export type GenerationResult = {
  readonly generatedFiles: readonly string[];
};

const collectPluginResources = Effect.fn(function* (params: {
  readonly plugin: InitializedPlugin;
  readonly normalizedSpec: NormalizedSpec;
}) {
  const collectResources = params.plugin.hooks.collectResources;
  if (collectResources === undefined) {
    return params.normalizedSpec;
  }
  return yield* collectResources(params.normalizedSpec).pipe(
    Effect.withSpan("typeweaver.plugin.collectResources", {
      attributes: { plugin: params.plugin.registration.plugin.name },
    })
  );
});

const collectResources = Effect.fn(function* (
  plugins: readonly InitializedPlugin[],
  initialSpec: NormalizedSpec
) {
  yield* Effect.logInfo("Collecting resources...");
  return yield* Effect.reduce(
    plugins,
    () => initialSpec,
    (normalizedSpec, plugin) =>
      collectPluginResources({ plugin, normalizedSpec })
  );
});

const makeFlushGeneratedFileLogs = (
  built: GeneratedFileLogSource
): Effect.Effect<void> =>
  Effect.suspend(() =>
    Effect.forEach(
      built.drainPendingWriteLogs(),
      filePath => Effect.logInfo(`Generated: ${filePath}`),
      { discard: true }
    )
  );

const generatePlugin = Effect.fn(function* (params: {
  readonly plugin: InitializedPlugin;
  readonly context: GeneratorContext;
  readonly flushGeneratedFileLogs: Effect.Effect<void>;
}) {
  const pluginName = params.plugin.registration.plugin.name;
  yield* Effect.logInfo(`Running plugin: ${pluginName}`);
  const generate = params.plugin.hooks.generate;
  if (generate === undefined) {
    return;
  }
  yield* generate(params.context).pipe(
    Effect.onExit(() => params.flushGeneratedFileLogs),
    Effect.withSpan("typeweaver.plugin.generate", {
      attributes: { plugin: pluginName },
    })
  );
});

const generatePlugins = Effect.fn(function* (params: GeneratePluginsParams) {
  yield* Effect.logInfo("Generating code...");
  yield* Effect.forEach(
    params.plugins,
    plugin =>
      generatePlugin({
        plugin,
        context: params.context,
        flushGeneratedFileLogs: params.flushGeneratedFileLogs,
      }),
    { discard: true }
  );
});

const finalizePlugin = Effect.fn(function* (params: {
  readonly plugin: InitializedPlugin;
  readonly pluginContext: PluginContext;
}) {
  const pluginName = params.plugin.registration.plugin.name;
  const finalize = params.plugin.hooks.finalize;
  if (finalize === undefined) {
    return;
  }
  yield* finalize(params.pluginContext).pipe(
    Effect.withSpan("typeweaver.plugin.finalize", {
      attributes: { plugin: pluginName },
    }),
    Effect.catch(cause =>
      Effect.logWarning(cause.message).pipe(
        Effect.annotateLogs({ plugin: pluginName, cause })
      )
    )
  );
});

const finalizePlugins = Effect.fn("typeweaver.Generator.finalizePlugins")(
  function* (params: FinalizePluginsParams) {
    yield* Effect.logInfo("Finalizing plugins...");
    let finalizerDefects: Cause.Cause<never> | undefined;

    for (const plugin of [...params.plugins].reverse()) {
      const finalizerExit = yield* Effect.exit(
        finalizePlugin({
          plugin,
          pluginContext: params.pluginContext,
        })
      );
      if (Exit.isFailure(finalizerExit)) {
        finalizerDefects =
          finalizerDefects === undefined
            ? finalizerExit.cause
            : Cause.combine(finalizerDefects, finalizerExit.cause);
      }
    }

    if (finalizerDefects !== undefined) {
      return yield* Effect.failCause(finalizerDefects);
    }
  }
);

/**
 * Runs one generation's plugin lifecycle inside a Scope that it owns. Scoped
 * plugins acquire into that Scope at the initialize stage, in registration
 * order. `finalize` runs in reverse order for every initialized plugin, and
 * closing the Scope afterwards releases the acquired resources in reverse
 * order, on success, typed failure, defect, and interruption.
 */
export const runPluginLifecycle = (
  params: PluginLifecycleParams,
  deps: PluginLifecycleDeps
) =>
  Effect.gen(function* () {
    const initialized: InitializedPlugin[] = [];
    let getGeneratedFiles: () => readonly string[] = () => [];

    yield* Effect.gen(function* () {
      yield* initializePlugins({
        registrations: params.initial,
        pluginContext: params.pluginContext,
        initialized,
      });
      const normalizedSpec = yield* collectResources(
        initialized,
        params.normalizedSpec
      );

      const built = yield* deps.contextBuilder.buildGeneratorContext({
        outputDir: params.plan.outputDir,
        inputDir: params.plan.inputDir,
        config: params.plan.userConfig,
        normalizedSpec,
        templateDir: params.plan.templateDir,
        coreDir: CORE_DIR,
        responsesOutputDir: params.plan.responsesOutputDir,
        specOutputDir: params.plan.specOutputDir,
      });
      getGeneratedFiles = built.getGeneratedFiles;

      const flushGeneratedFileLogs = makeFlushGeneratedFileLogs(built);
      yield* generatePlugins({
        plugins: initialized,
        context: built.context,
        flushGeneratedFileLogs,
      });

      yield* deps.indexFileGenerator
        .generate({
          templateDir: params.plan.templateDir,
          outputDir: params.plan.outputDir,
          generatedFiles: getGeneratedFiles(),
          writeFile: built.context.writeFile,
        })
        .pipe(Effect.onExit(() => flushGeneratedFileLogs));
    }).pipe(
      Effect.onExit(() =>
        finalizePlugins({
          plugins: initialized,
          pluginContext: params.pluginContext,
        })
      )
    );

    return { generatedFiles: getGeneratedFiles() } satisfies GenerationResult;
  }).pipe(Effect.scoped);
