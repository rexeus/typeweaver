import type {
  ContextBuilder,
  GeneratorContext,
  NormalizedSpec,
  PluginContext,
  PluginRegistration,
} from "@rexeus/typeweaver-gen";
import { Cause, Effect, Exit } from "effect";
import { CORE_DIR } from "../generatorDefaults.js";
import type { IndexFileGenerator } from "../IndexFileGenerator.js";
import type { GenerationPlan } from "./generatorPreflight.js";

type PluginLifecycleDeps = {
  readonly contextBuilder: ContextBuilder;
  readonly indexFileGenerator: IndexFileGenerator;
};

type PluginLifecycleParams = {
  readonly plan: GenerationPlan;
  readonly initial: readonly PluginRegistration[];
  readonly normalizedSpec: NormalizedSpec;
  readonly pluginContext: PluginContext;
};

type InitializePluginsParams = {
  readonly registrations: readonly PluginRegistration[];
  readonly pluginContext: PluginContext;
  readonly initialized: PluginRegistration[];
};

type FinalizePluginsParams = {
  readonly registrations: readonly PluginRegistration[];
  readonly pluginContext: PluginContext;
};

type GeneratePluginsParams = {
  readonly registrations: readonly PluginRegistration[];
  readonly context: GeneratorContext;
  readonly flushGeneratedFileLogs: Effect.Effect<void>;
};

type GeneratedFileLogSource = {
  readonly drainPendingWriteLogs: () => readonly string[];
};

export type GenerationResult = {
  readonly generatedFiles: readonly string[];
};

const initializePlugin = Effect.fn(function* (params: {
  readonly registration: PluginRegistration;
  readonly pluginContext: PluginContext;
  readonly initialized: PluginRegistration[];
}) {
  const initialize =
    params.registration.plugin.initialize === undefined
      ? Effect.void
      : params.registration.plugin.initialize(params.pluginContext).pipe(
          Effect.withSpan("typeweaver.plugin.initialize", {
            attributes: { plugin: params.registration.plugin.name },
          })
        );

  yield* Effect.logDebug(
    `Initializing plugin: ${params.registration.plugin.name}`
  );
  yield* Effect.uninterruptibleMask(restore =>
    restore(initialize).pipe(
      Effect.tap(() =>
        Effect.sync(() => {
          params.initialized.push(params.registration);
        })
      )
    )
  );
});

const initializePlugins = Effect.fn(function* (
  params: InitializePluginsParams
) {
  yield* Effect.logInfo("Initializing plugins...");
  yield* Effect.forEach(
    params.registrations,
    registration =>
      initializePlugin({
        registration,
        pluginContext: params.pluginContext,
        initialized: params.initialized,
      }),
    { discard: true }
  );
});

const collectPluginResources = Effect.fn(function* (params: {
  readonly registration: PluginRegistration;
  readonly normalizedSpec: NormalizedSpec;
}) {
  const collectResources = params.registration.plugin.collectResources;
  if (collectResources === undefined) {
    return params.normalizedSpec;
  }
  return yield* collectResources(params.normalizedSpec).pipe(
    Effect.withSpan("typeweaver.plugin.collectResources", {
      attributes: { plugin: params.registration.plugin.name },
    })
  );
});

const collectResources = Effect.fn(function* (
  registrations: readonly PluginRegistration[],
  initialSpec: NormalizedSpec
) {
  yield* Effect.logInfo("Collecting resources...");
  return yield* Effect.reduce(
    registrations,
    initialSpec,
    (normalizedSpec, registration) =>
      collectPluginResources({ registration, normalizedSpec })
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
  readonly registration: PluginRegistration;
  readonly context: GeneratorContext;
  readonly flushGeneratedFileLogs: Effect.Effect<void>;
}) {
  yield* Effect.logInfo(`Running plugin: ${params.registration.plugin.name}`);
  const generate = params.registration.plugin.generate;
  if (generate === undefined) {
    return;
  }
  yield* generate(params.context).pipe(
    Effect.onExit(() => params.flushGeneratedFileLogs),
    Effect.withSpan("typeweaver.plugin.generate", {
      attributes: { plugin: params.registration.plugin.name },
    })
  );
});

const generatePlugins = Effect.fn(function* (params: GeneratePluginsParams) {
  yield* Effect.logInfo("Generating code...");
  yield* Effect.forEach(
    params.registrations,
    registration =>
      generatePlugin({
        registration,
        context: params.context,
        flushGeneratedFileLogs: params.flushGeneratedFileLogs,
      }),
    { discard: true }
  );
});

const finalizePlugin = Effect.fn(function* (params: {
  readonly registration: PluginRegistration;
  readonly pluginContext: PluginContext;
}) {
  const finalize = params.registration.plugin.finalize;
  if (finalize === undefined) {
    return;
  }
  yield* finalize(params.pluginContext).pipe(
    Effect.withSpan("typeweaver.plugin.finalize", {
      attributes: { plugin: params.registration.plugin.name },
    }),
    Effect.catchAll(cause =>
      Effect.logWarning(cause.message).pipe(
        Effect.annotateLogs({
          plugin: params.registration.plugin.name,
          cause,
        })
      )
    )
  );
});

const finalizePlugins = Effect.fn("typeweaver.Generator.finalizePlugins")(
  function* (params: FinalizePluginsParams) {
    yield* Effect.logInfo("Finalizing plugins...");
    let finalizerDefects: Cause.Cause<never> | undefined;

    for (const registration of [...params.registrations].reverse()) {
      const finalizerExit = yield* Effect.exit(
        finalizePlugin({
          registration,
          pluginContext: params.pluginContext,
        })
      );
      if (Exit.isFailure(finalizerExit)) {
        finalizerDefects =
          finalizerDefects === undefined
            ? finalizerExit.cause
            : Cause.sequential(finalizerDefects, finalizerExit.cause);
      }
    }

    if (finalizerDefects !== undefined) {
      return yield* Effect.failCause(finalizerDefects);
    }
  }
);

export const runPluginLifecycle = (
  params: PluginLifecycleParams,
  deps: PluginLifecycleDeps
) =>
  Effect.gen(function* () {
    const initialized: PluginRegistration[] = [];
    let getGeneratedFiles: () => readonly string[] = () => [];

    yield* Effect.gen(function* () {
      yield* initializePlugins({
        registrations: params.initial,
        pluginContext: params.pluginContext,
        initialized,
      });
      const normalizedSpec = yield* collectResources(
        params.initial,
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
        registrations: params.initial,
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
          registrations: initialized,
          pluginContext: params.pluginContext,
        })
      )
    );

    return { generatedFiles: getGeneratedFiles() } satisfies GenerationResult;
  });
