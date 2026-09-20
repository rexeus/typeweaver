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
import type { PluginTestContextOptions } from "./internal/pluginTestContext.js";

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
  const cause = exit.cause;
  if (Cause.hasDies(cause)) {
    return Effect.failCause(
      Cause.fromReasons(cause.reasons.filter(Cause.isDieReason))
    );
  }
  if (Cause.hasInterrupts(cause)) {
    return Effect.interrupt;
  }
  const failure = Cause.findErrorOption(cause);
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

const resolveTestOptions = (
  options: PluginTestKitOptions
): PluginTestContextOptions => ({
  inputDir: options.inputDir ?? DEFAULT_INPUT_DIR,
  outputDir: options.outputDir ?? DEFAULT_OUTPUT_DIR,
  templateDir: options.templateDir ?? DEFAULT_TEMPLATE_DIR,
  coreDir: options.coreDir ?? DEFAULT_CORE_DIR,
  responsesOutputDir:
    options.responsesOutputDir ?? DEFAULT_RESPONSES_OUTPUT_DIR,
  specOutputDir: options.specOutputDir ?? DEFAULT_SPEC_OUTPUT_DIR,
  config: options.config ?? {},
});

const buildTemplates = (
  options: PluginTestKitOptions
): ReadonlyMap<string, string> =>
  new Map(
    Object.entries(options.templates ?? {}).map(([templatePath, source]) => [
      path.posix.normalize(templatePath.replaceAll("\\", "/")),
      source,
    ])
  );

type PluginStageRunner = {
  readonly plugin: Plugin;
  readonly normalizedSpec: NormalizedSpec;
  readonly pluginContext: PluginContext;
  readonly validationContext: PluginValidationContext;
  readonly buildGeneratorContext: (
    normalizedSpec: NormalizedSpec
  ) => GeneratorContext;
  readonly state: PluginTestState;
  readonly files: PluginTestFiles;
};

const runPluginStages = (
  runner: PluginStageRunner
): Effect.Effect<PluginTestResult, PluginExecutionError> => {
  let initialized = false;

  return Effect.gen(function* () {
    const issues =
      runner.plugin.validate === undefined
        ? []
        : yield* runner.plugin.validate(
            runner.normalizedSpec,
            runner.validationContext
          );
    yield* runner.plugin.initialize?.(runner.pluginContext) ?? Effect.void;
    initialized = true;
    const normalizedSpec =
      runner.plugin.collectResources === undefined
        ? runner.normalizedSpec
        : yield* runner.plugin.collectResources(runner.normalizedSpec);
    const generatorContext = runner.buildGeneratorContext(normalizedSpec);
    yield* runner.plugin.generate?.(generatorContext) ?? Effect.void;

    return {
      issues,
      normalizedSpec,
      generatedFiles: Array.from(runner.state.generatedFiles).sort(),
      files: runner.files.list(),
      finalizeErrors: [...runner.state.finalizeErrors],
    };
  }).pipe(
    Effect.onExit(() =>
      initialized
        ? finalizePlugin(runner.plugin, runner.pluginContext, runner.state)
        : Effect.void
    ),
    Effect.map(result => ({
      ...result,
      finalizeErrors: [...runner.state.finalizeErrors],
    }))
  );
};

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
  const resolvedOptions = resolveTestOptions(options);
  const templates = buildTemplates(options);
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
      return runPluginStages({
        plugin,
        normalizedSpec: options.normalizedSpec,
        pluginContext: buildPluginContext(),
        validationContext: buildValidationContext(),
        buildGeneratorContext,
        state,
        files,
      });
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
