import path from "node:path";
import { Effect } from "effect";
import { resolveTemplateDir } from "../generatorDefaults.js";
import {
  acquireOutputLock,
  assertSafeCleanTargetEffect,
  cleanOutputDirPreservingLock,
  ensureOutputDirectories,
  releaseOutputLock,
  sweepOrphanTempdirs,
} from "../generatorIO.js";
import type { GenerateParams } from "../generatorTypes.js";

export type GenerationPaths = {
  readonly params: GenerateParams;
  readonly cwd: string;
  readonly inputFile: string;
  readonly inputDir: string;
  readonly outputDir: string;
  readonly responsesOutputDir: string;
  readonly specOutputDir: string;
  readonly userConfig: Record<string, unknown>;
};

export type GenerationPlan = GenerationPaths & {
  readonly templateDir: string;
};

export const resolveGenerationPaths = (
  params: GenerateParams
): GenerationPaths => {
  const cwd = params.currentWorkingDirectory ?? process.cwd();
  const inputFile = path.resolve(cwd, params.inputFile);
  const outputDir = path.resolve(cwd, params.outputDir);
  return {
    params,
    cwd,
    inputFile,
    inputDir: path.dirname(inputFile),
    outputDir,
    responsesOutputDir: path.join(outputDir, "responses"),
    specOutputDir: path.join(outputDir, "spec"),
    // Preserve documented plugin-specific top-level configuration keys.
    userConfig: { ...params.config },
  };
};

export const prepareGeneration = (paths: GenerationPaths) =>
  Effect.gen(function* () {
    const plan: GenerationPlan = {
      ...paths,
      templateDir: yield* resolveTemplateDir(),
    };
    yield* assertSafeCleanTargetEffect(
      plan.outputDir,
      plan.cwd,
      plan.params.config?.clean !== false ? plan.inputFile : undefined
    );
    yield* ensureOutputDirectories(plan);

    return plan;
  });

const prepareLockedOutput = (plan: GenerationPlan) =>
  Effect.gen(function* () {
    yield* sweepOrphanTempdirs(plan.outputDir);

    if (plan.params.config?.clean === false) {
      return;
    }

    yield* Effect.logInfo("Cleaning output directory...");
    yield* cleanOutputDirPreservingLock(plan.outputDir);
    yield* ensureOutputDirectories(plan);
  });

export const withGenerationLock = <A, E, R>(
  plan: GenerationPlan,
  workflow: Effect.Effect<A, E, R>
) =>
  Effect.acquireUseRelease(
    Effect.gen(function* () {
      const outputLock = yield* acquireOutputLock({
        outputDir: plan.outputDir,
        inputFile: plan.inputFile,
      });
      yield* Effect.logDebug(
        `Acquired output lock at '${outputLock.path}' (pid ${process.pid})`
      );
      return outputLock;
    }),
    () => prepareLockedOutput(plan).pipe(Effect.zipRight(workflow)),
    outputLock =>
      Effect.gen(function* () {
        yield* releaseOutputLock(outputLock);
        yield* Effect.logDebug(`Released output lock at '${outputLock.path}'`);
      })
  );
