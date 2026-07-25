import path from "node:path";
import { ContextBuilder, PluginRegistry } from "@rexeus/typeweaver-gen";
import { Cause, Effect, Exit } from "effect";
import { Formatter } from "./Formatter.js";
import {
  CORE_DIR,
  DEFAULT_PLUGIN_RESOLUTION_STRATEGIES,
  defaultRequiredPlugins,
  resolveTemplateDir,
} from "./generatorDefaults.js";
import {
  acquireOutputLock,
  assertSafeCleanTargetEffect,
  cleanOutputDirPreservingLock,
  ensureOutputDirectories,
  releaseOutputLock,
  sweepOrphanTempdirs,
} from "./generatorIO.js";
import { IndexFileGenerator } from "./IndexFileGenerator.js";
import { PluginLoader } from "./PluginLoader.js";
import { SpecLoader } from "./SpecLoader.js";
import type { GenerateParams } from "./generatorTypes.js";

/**
 * Effect-native generator orchestrator. Owns the full pipeline from spec
 * bundling through plugin lifecycle to optional formatting. A fresh plugin
 * registry instance is yielded at the start of every `generate(...)` call
 * via `PluginRegistry.createInstance` so two concurrent generations on the same
 * long-lived runtime see fully isolated registrations. The generated-file
 * tracker is per-call by construction (built fresh inside
 * `ContextBuilder.buildGeneratorContext`).
 *
 * Each invocation acquires an exclusive lock at
 * `outputDir/.typeweaver-lock/` via `Effect.acquireUseRelease`, so two
 * `typeweaver generate` processes pointed at the same `outputDir` fail
 * fast with a `ConcurrentGenerationError` rather than racing the
 * clean+write sequence. The lock is released on success, on typed
 * failure, and on interrupt (e.g. Ctrl+C).
 *
 * Pipeline ordering and the log lines along the way are held byte-stable
 * so the generated test-project output stays unchanged and the existing
 * test expectations keep passing.
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
        const cwd = params.currentWorkingDirectory ?? process.cwd();
        const inputFile = path.resolve(cwd, params.inputFile);
        const outputDir = path.resolve(cwd, params.outputDir);
        const responsesOutputDir = path.join(outputDir, "responses");
        const specOutputDir = path.join(outputDir, "spec");
        const inputDir = path.dirname(inputFile);
        // The plugin context exposes the full Typeweaver user config so
        // plugins can read whatever top-level keys they document; the type
        // alias `TypeweaverUserConfig` (a permissive Record) names this
        // contract for plugin authors. The spread widens the known config
        // shape into that record without an unsafe cast.
        const userConfig: Record<string, unknown> = { ...params.config };

        yield* Effect.annotateCurrentSpan({
          inputFile: params.inputFile,
          outputDir: params.outputDir,
        });
        yield* Effect.logInfo("Starting generation...");
        yield* Effect.logDebug(
          `Input file: '${inputFile}'; output dir: '${outputDir}'`
        );

        const registry = yield* PluginRegistry.createInstance();

        const templateDir = yield* resolveTemplateDir();

        // Validate the output target before anything touches the
        // filesystem. When the clean step will run, the full guard
        // applies (including the input-file containment rule). With
        // `--no-clean` the structural rules still apply: the
        // orphan-tempdir sweep deletes atomic-write temp entries and
        // `ensureOutputDirectories` creates directories under
        // `outputDir`, so catastrophic targets (filesystem root, cwd,
        // workspace root) must be rejected before either runs.
        yield* assertSafeCleanTargetEffect(
          outputDir,
          cwd,
          params.config?.clean !== false ? inputFile : undefined
        );

        // The lock dir lives inside outputDir, so outputDir must exist
        // before we can `mkdir` the lock. Make the base directories now;
        // the subdirectories are recreated inside the lock scope if the
        // clean step removes them.
        yield* ensureOutputDirectories({
          outputDir,
          responsesOutputDir,
          specOutputDir,
        });

        const pipeline = Effect.gen(function* () {
          // Reclaim any `.typeweaver-XXXX` tempdirs left behind by a
          // prior run that died between `mkdtempSync` and the
          // `try/finally` cleanup. The sweep is cheap and idempotent;
          // it runs even with `--no-clean` so the Formatter never walks
          // into orphan tempdirs and rewrites their `.tmp` content.
          yield* sweepOrphanTempdirs(outputDir);

          if (params.config?.clean !== false) {
            yield* Effect.logInfo("Cleaning output directory...");
            yield* cleanOutputDirPreservingLock(outputDir);
            // The clean removed `responses/` and `spec/` (we preserve
            // only lock coordination artifacts); recreate them before the pipeline
            // bundles into them.
            yield* ensureOutputDirectories({
              outputDir,
              responsesOutputDir,
              specOutputDir,
            });
          }

          yield* pluginLoader.loadAll({
            registry,
            requiredPlugins: defaultRequiredPlugins(),
            strategies: DEFAULT_PLUGIN_RESOLUTION_STRATEGIES,
            config: params.config,
          });

          yield* Effect.logInfo(
            `Bundling spec from '${inputFile}' to '${specOutputDir}'...`
          );
          let normalizedSpec = (yield* specLoader.load({
            inputFile,
            specOutputDir,
          })).normalizedSpec;

          const pluginContext = yield* contextBuilder.buildPluginContext({
            outputDir,
            inputDir,
            config: userConfig,
          });

          const initial = yield* registry.getAll;
          const initialized: (typeof initial)[number][] = [];

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
                registration.plugin.finalize(pluginContext).pipe(
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
            for (const registration of initial) {
              yield* Effect.logDebug(
                `Initializing plugin: ${registration.plugin.name}`
              );
              if (registration.plugin.initialize) {
                yield* registration.plugin.initialize(pluginContext).pipe(
                  Effect.withSpan("typeweaver.plugin.initialize", {
                    attributes: { plugin: registration.plugin.name },
                  })
                );
              }
              initialized.push(registration);
            }

            yield* Effect.logInfo("Collecting resources...");
            for (const registration of initial) {
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

            const built = yield* contextBuilder.buildGeneratorContext({
              outputDir,
              inputDir,
              config: userConfig,
              normalizedSpec,
              templateDir,
              coreDir: CORE_DIR,
              responsesOutputDir,
              specOutputDir,
            });
            getGeneratedFiles = built.getGeneratedFiles;

            // The sync `writeFile` callback runs outside any Effect
            // runtime and queues its `Generated: <path>` lines on the
            // per-call builder. Flushing through `Effect.logInfo` after
            // each plugin keeps the lines inside the configured logger
            // pipeline; `Effect.onExit` flushes even when a plugin
            // fails or is interrupted, so files already written are
            // still reported.
            const flushGeneratedFileLogs = Effect.suspend(() =>
              Effect.forEach(
                built.drainPendingWriteLogs(),
                filePath => Effect.logInfo(`Generated: ${filePath}`),
                { discard: true }
              )
            );

            yield* Effect.logInfo("Generating code...");
            for (const registration of initial) {
              yield* Effect.logInfo(
                `Running plugin: ${registration.plugin.name}`
              );
              if (registration.plugin.generate) {
                // `onExit` stays inside the span so the flushed
                // `Generated:` log records carry the plugin's span
                // context.
                yield* registration.plugin.generate(built.context).pipe(
                  Effect.onExit(() => flushGeneratedFileLogs),
                  Effect.withSpan("typeweaver.plugin.generate", {
                    attributes: { plugin: registration.plugin.name },
                  })
                );
              }
            }

            yield* indexFileGenerator
              .generate({
                templateDir,
                outputDir,
                generatedFiles: getGeneratedFiles(),
                writeFile: built.context.writeFile,
              })
              .pipe(Effect.onExit(() => flushGeneratedFileLogs));
          }).pipe(Effect.onExit(() => finalizeInitializedPlugins()));

          if (params.config?.format !== false) {
            yield* formatter.format(outputDir);
          }

          const generatedFiles = getGeneratedFiles();
          yield* Effect.logInfo("Generation complete!");
          yield* Effect.logInfo(`Generated files: ${generatedFiles.length}`);
        });

        yield* Effect.acquireUseRelease(
          Effect.gen(function* () {
            const outputLock = yield* acquireOutputLock({
              outputDir,
              inputFile,
            });
            yield* Effect.logDebug(
              `Acquired output lock at '${outputLock.path}' (pid ${process.pid})`
            );
            return outputLock;
          }),
          () => pipeline,
          outputLock =>
            Effect.gen(function* () {
              yield* releaseOutputLock(outputLock);
              yield* Effect.logDebug(
                `Released output lock at '${outputLock.path}'`
              );
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
