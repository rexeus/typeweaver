import path from "node:path";
import { Cause, Effect, Exit, Option } from "effect";
import { PluginExecutionError } from "../plugins/errors/PluginExecutionError.js";
import { makePluginTestGeneratorContext } from "./internal/pluginTestContext.js";
import type { NormalizedSpec } from "../NormalizedSpec.js";
import type {
  GeneratorContext,
  PluginContext,
  PluginValidationContext,
  TypeweaverUserConfig,
} from "../plugins/contextTypes.js";
import type { Plugin } from "../plugins/Plugin.js";

const DEFAULT_INPUT_DIR = "/typeweaver/plugin-test/input";
const DEFAULT_OUTPUT_DIR = "/typeweaver/plugin-test/output";
const DEFAULT_TEMPLATE_DIR = "/typeweaver/plugin-test/templates";
const DEFAULT_CORE_DIR = "core";
const DEFAULT_RESPONSES_OUTPUT_DIR = `${DEFAULT_OUTPUT_DIR}/responses`;
const DEFAULT_SPEC_OUTPUT_DIR = `${DEFAULT_OUTPUT_DIR}/spec`;

export type PluginTestFile = {
  readonly path: string;
  readonly content: string;
};

export type PluginTestFiles = {
  readonly read: (filePath: string) => string | undefined;
  readonly list: () => readonly PluginTestFile[];
  readonly reset: () => void;
};

export type PluginTestKitOptions = {
  readonly normalizedSpec: NormalizedSpec;
  readonly inputDir?: string;
  readonly outputDir?: string;
  readonly templateDir?: string;
  readonly coreDir?: string;
  readonly responsesOutputDir?: string;
  readonly specOutputDir?: string;
  readonly config?: TypeweaverUserConfig;
  readonly templates?: Readonly<Record<string, string>>;
};

export type PluginTestResult = {
  readonly issues: readonly import("../issues/Issue.js").Issue[];
  readonly normalizedSpec: NormalizedSpec;
  readonly generatedFiles: readonly string[];
  readonly files: readonly PluginTestFile[];
  readonly finalizeErrors: readonly PluginExecutionError[];
};

export type PluginTestKit = {
  readonly files: PluginTestFiles;
  readonly buildPluginContext: () => PluginContext;
  readonly buildValidationContext: () => PluginValidationContext;
  readonly buildGeneratorContext: (
    normalizedSpec?: NormalizedSpec
  ) => GeneratorContext;
  readonly run: (
    plugin: Plugin
  ) => Effect.Effect<PluginTestResult, PluginExecutionError>;
  readonly finalizeErrors: () => readonly PluginExecutionError[];
};

type PluginTestState = {
  readonly fileContent: Map<string, string>;
  readonly generatedFiles: Set<string>;
  readonly finalizeErrors: PluginExecutionError[];
};

const snapshotFiles = (
  fileContent: ReadonlyMap<string, string>
): readonly PluginTestFile[] =>
  Array.from(fileContent, ([filePath, content]) => ({
    path: filePath,
    content,
  })).sort((left, right) =>
    left.path < right.path ? -1 : left.path > right.path ? 1 : 0
  );

const makeFiles = (state: PluginTestState): PluginTestFiles => ({
  read: filePath => state.fileContent.get(path.posix.normalize(filePath)),
  list: () => snapshotFiles(state.fileContent),
  reset: () => {
    state.fileContent.clear();
    state.generatedFiles.clear();
  },
});

const collectFinalizerExit = (
  exit: Exit.Exit<void, PluginExecutionError>,
  finalizeErrors: PluginExecutionError[]
): Effect.Effect<void> => {
  if (Exit.isSuccess(exit)) {
    return Effect.void;
  }
  const defectCause = Cause.keepDefects(exit.cause);
  if (Option.isSome(defectCause)) {
    return Effect.failCause(defectCause.value);
  }
  if (Cause.isInterrupted(exit.cause)) {
    return Effect.interrupt;
  }
  const failure = Cause.failureOption(exit.cause);
  if (Option.isSome(failure)) {
    return Effect.sync(() => {
      finalizeErrors.push(failure.value);
    });
  }
  return Effect.void;
};

const finalizePlugin = (
  plugin: Plugin,
  context: PluginContext,
  state: PluginTestState
): Effect.Effect<void> =>
  plugin.finalize === undefined
    ? Effect.void
    : Effect.exit(plugin.finalize(context)).pipe(
        Effect.flatMap(exit => collectFinalizerExit(exit, state.finalizeErrors))
      );

/**
 * Creates a fresh, fully in-memory harness for one third-party plugin.
 *
 * The harness exposes complete public contexts, applies the same lexical
 * generated-path guard as production, records generated content without disk
 * I/O, runs validation plus every lifecycle stage, and mirrors production's
 * best-effort handling of typed finalizer failures.
 */
export const createPluginTestKit = (
  options: PluginTestKitOptions
): PluginTestKit => {
  const resolvedOptions = {
    inputDir: options.inputDir ?? DEFAULT_INPUT_DIR,
    outputDir: options.outputDir ?? DEFAULT_OUTPUT_DIR,
    templateDir: options.templateDir ?? DEFAULT_TEMPLATE_DIR,
    coreDir: options.coreDir ?? DEFAULT_CORE_DIR,
    responsesOutputDir:
      options.responsesOutputDir ?? DEFAULT_RESPONSES_OUTPUT_DIR,
    specOutputDir: options.specOutputDir ?? DEFAULT_SPEC_OUTPUT_DIR,
    config: options.config ?? {},
  };
  const templates = new Map(
    Object.entries(options.templates ?? {}).map(([templatePath, source]) => [
      path.posix.normalize(templatePath.replaceAll("\\", "/")),
      source,
    ])
  );
  const state: PluginTestState = {
    fileContent: new Map(),
    generatedFiles: new Set(),
    finalizeErrors: [],
  };
  const files = makeFiles(state);
  const buildPluginContext = (): PluginContext => ({
    outputDir: resolvedOptions.outputDir,
    inputDir: resolvedOptions.inputDir,
    config: resolvedOptions.config,
  });
  const buildValidationContext = (): PluginValidationContext => ({
    inputDir: resolvedOptions.inputDir,
    config: resolvedOptions.config,
  });
  const buildGeneratorContext = (
    normalizedSpec: NormalizedSpec = options.normalizedSpec
  ): GeneratorContext =>
    makePluginTestGeneratorContext({
      options: resolvedOptions,
      normalizedSpec,
      templates,
      state,
    });

  const run = (
    plugin: Plugin
  ): Effect.Effect<PluginTestResult, PluginExecutionError> =>
    Effect.suspend(() => {
      files.reset();
      state.finalizeErrors.length = 0;
      const pluginContext = buildPluginContext();
      const validationContext = buildValidationContext();
      let initialized = false;

      return Effect.gen(function* () {
        const issues =
          plugin.validate === undefined
            ? []
            : yield* plugin.validate(options.normalizedSpec, validationContext);
        yield* plugin.initialize?.(pluginContext) ?? Effect.void;
        initialized = true;
        const normalizedSpec =
          plugin.collectResources === undefined
            ? options.normalizedSpec
            : yield* plugin.collectResources(options.normalizedSpec);
        const generatorContext = buildGeneratorContext(normalizedSpec);
        yield* plugin.generate?.(generatorContext) ?? Effect.void;

        return {
          issues,
          normalizedSpec,
          generatedFiles: Array.from(state.generatedFiles).sort(),
          files: files.list(),
          finalizeErrors: [...state.finalizeErrors],
        };
      }).pipe(
        Effect.onExit(() =>
          initialized
            ? finalizePlugin(plugin, pluginContext, state)
            : Effect.void
        ),
        Effect.map(result => ({
          ...result,
          finalizeErrors: [...state.finalizeErrors],
        }))
      );
    });

  return {
    files,
    buildPluginContext,
    buildValidationContext,
    buildGeneratorContext,
    run,
    finalizeErrors: () => [...state.finalizeErrors],
  };
};
