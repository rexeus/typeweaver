import type {
  ContextBuilder,
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

export type GenerationResult = {
  readonly generatedFiles: readonly string[];
};

export const runPluginLifecycle = (
  params: PluginLifecycleParams,
  deps: PluginLifecycleDeps
) =>
  Effect.gen(function* () {
    const initialized: PluginRegistration[] = [];
    let normalizedSpec = params.normalizedSpec;
    let getGeneratedFiles: () => readonly string[] = () => [];

    const finalizeInitializedPlugins = Effect.fn(
      "typeweaver.Generator.finalizePlugins"
    )(function* () {
      yield* Effect.logInfo("Finalizing plugins...");
      let finalizerDefects: Cause.Cause<never> | undefined;

      for (const registration of [...initialized].reverse()) {
        if (!registration.plugin.finalize) {
          continue;
        }

        const finalizerExit = yield* Effect.exit(
          registration.plugin.finalize(params.pluginContext).pipe(
            Effect.withSpan("typeweaver.plugin.finalize", {
              attributes: { plugin: registration.plugin.name },
            }),
            Effect.catchAll(cause =>
              Effect.logWarning(cause.message).pipe(
                Effect.annotateLogs({
                  plugin: registration.plugin.name,
                  cause,
                })
              )
            )
          )
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
    });

    yield* Effect.gen(function* () {
      yield* Effect.logInfo("Initializing plugins...");
      for (const registration of params.initial) {
        yield* Effect.logDebug(
          `Initializing plugin: ${registration.plugin.name}`
        );
        const initialize =
          registration.plugin.initialize === undefined
            ? Effect.void
            : registration.plugin.initialize(params.pluginContext).pipe(
                Effect.withSpan("typeweaver.plugin.initialize", {
                  attributes: { plugin: registration.plugin.name },
                })
              );

        // Initialization remains interruptible, while successful return and
        // finalizer registration form one masked ownership transition.
        yield* Effect.uninterruptibleMask(restore =>
          restore(initialize).pipe(
            Effect.tap(() =>
              Effect.sync(() => {
                initialized.push(registration);
              })
            )
          )
        );
      }

      yield* Effect.logInfo("Collecting resources...");
      for (const registration of params.initial) {
        if (registration.plugin.collectResources) {
          normalizedSpec = yield* registration.plugin
            .collectResources(normalizedSpec)
            .pipe(
              Effect.withSpan("typeweaver.plugin.collectResources", {
                attributes: { plugin: registration.plugin.name },
              })
            );
        }
      }

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

      const flushGeneratedFileLogs = Effect.suspend(() =>
        Effect.forEach(
          built.drainPendingWriteLogs(),
          filePath => Effect.logInfo(`Generated: ${filePath}`),
          { discard: true }
        )
      );

      yield* Effect.logInfo("Generating code...");
      for (const registration of params.initial) {
        yield* Effect.logInfo(`Running plugin: ${registration.plugin.name}`);
        if (registration.plugin.generate) {
          // Flush inside the plugin span on every Exit so writes completed
          // before a failure or interruption still reach the logger.
          yield* registration.plugin.generate(built.context).pipe(
            Effect.onExit(() => flushGeneratedFileLogs),
            Effect.withSpan("typeweaver.plugin.generate", {
              attributes: { plugin: registration.plugin.name },
            })
          );
        }
      }

      yield* deps.indexFileGenerator
        .generate({
          templateDir: params.plan.templateDir,
          outputDir: params.plan.outputDir,
          generatedFiles: getGeneratedFiles(),
          writeFile: built.context.writeFile,
        })
        .pipe(Effect.onExit(() => flushGeneratedFileLogs));
    }).pipe(Effect.onExit(() => finalizeInitializedPlugins()));

    return { generatedFiles: getGeneratedFiles() } satisfies GenerationResult;
  });
