import path from "node:path";
import { ContextBuilder, PluginRegistry } from "@rexeus/typeweaver-gen";
import { Effect } from "effect";
import { Formatter } from "./Formatter.js";
import {
  CORE_DIR,
  DEFAULT_PLUGIN_RESOLUTION_STRATEGIES,
  defaultRequiredPlugins,
  resolveTemplateDir,
} from "./generatorDefaults.js";
import {
  assertSafeCleanTargetEffect,
  ensureOutputDirectories,
  removeOutputDir,
} from "./generatorIO.js";
import { IndexFileGenerator } from "./IndexFileGenerator.js";
import { PluginLoader } from "./PluginLoader.js";
import { SpecLoader } from "./SpecLoader.js";
import type { GenerateParams } from "./generatorTypes.js";

/**
 * Effect-native generator orchestrator. Owns the full pipeline from spec
 * bundling through plugin lifecycle to optional formatting. The plugin
 * registry is cleared at the start of every `generate(...)` call so the
 * long-lived service preserves the per-call semantics of the previous
 * `new Generator()` instance. The generated-file tracker is per-call by
 * construction (built fresh inside `ContextBuilder.buildGeneratorContext`).
 *
 * Pipeline ordering and the log lines along the way are held byte-stable
 * so the generated test-project output stays unchanged and the existing
 * test expectations keep passing.
 */
export class Generator extends Effect.Service<Generator>()(
  "typeweaver/Generator",
  {
    effect: Effect.gen(function* () {
      const registry = yield* PluginRegistry;
      const contextBuilder = yield* ContextBuilder;
      const pluginLoader = yield* PluginLoader;
      const specLoader = yield* SpecLoader;
      const formatter = yield* Formatter;
      const indexFileGenerator = yield* IndexFileGenerator;

      const generate = (params: GenerateParams) =>
        Effect.gen(function* () {
          const cwd = params.currentWorkingDirectory ?? process.cwd();
          const inputFile = path.resolve(cwd, params.inputFile);
          const outputDir = path.resolve(cwd, params.outputDir);
          const responsesOutputDir = path.join(outputDir, "responses");
          const specOutputDir = path.join(outputDir, "spec");
          const inputDir = path.dirname(inputFile);
          const pluginConfig = (params.config ?? {}) as Record<string, unknown>;

          yield* Effect.logInfo("Starting generation...");

          yield* registry.clear;

          const templateDir = yield* resolveTemplateDir();

          if (params.config?.clean !== false) {
            yield* assertSafeCleanTargetEffect(outputDir, cwd);
            yield* Effect.logInfo("Cleaning output directory...");
            yield* removeOutputDir(outputDir);
          }

          yield* ensureOutputDirectories({
            outputDir,
            responsesOutputDir,
            specOutputDir,
          });

          yield* pluginLoader.loadAll({
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
            config: pluginConfig,
          });

          yield* Effect.logInfo("Initializing plugins...");
          const initial = yield* registry.getAll;
          for (const registration of initial) {
            if (registration.plugin.initialize) {
              yield* registration.plugin.initialize(pluginContext);
            }
          }

          yield* Effect.logInfo("Collecting resources...");
          for (const registration of initial) {
            if (registration.plugin.collectResources) {
              normalizedSpec =
                yield* registration.plugin.collectResources(normalizedSpec);
            }
          }

          const { context: generatorContext, getGeneratedFiles } =
            yield* contextBuilder.buildGeneratorContext({
              outputDir,
              inputDir,
              config: pluginConfig,
              normalizedSpec,
              templateDir,
              coreDir: CORE_DIR,
              responsesOutputDir,
              specOutputDir,
            });

          yield* Effect.logInfo("Generating code...");
          for (const registration of initial) {
            yield* Effect.logInfo(
              `Running plugin: ${registration.plugin.name}`
            );
            if (registration.plugin.generate) {
              yield* registration.plugin.generate(generatorContext);
            }
          }

          yield* indexFileGenerator.generate({
            templateDir,
            outputDir,
            generatedFiles: getGeneratedFiles(),
            writeFile: generatorContext.writeFile,
          });

          yield* Effect.logInfo("Finalizing plugins...");
          for (const registration of initial) {
            if (registration.plugin.finalize) {
              yield* registration.plugin.finalize(pluginContext);
            }
          }

          if (params.config?.format !== false) {
            yield* formatter.format(outputDir);
          }

          const generatedFiles = getGeneratedFiles();
          yield* Effect.logInfo("Generation complete!");
          yield* Effect.logInfo(`Generated files: ${generatedFiles.length}`);
        }).pipe(
          Effect.withSpan("typeweaver.generate", {
            attributes: {
              inputFile: params.inputFile,
              outputDir: params.outputDir,
            },
          })
        );

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
