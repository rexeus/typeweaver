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
import {
  assertGenerationOutputAllowed,
  assertPathNotReservedForCoordination,
} from "./stagingAuthority.js";
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
  const inputDir = path.dirname(inputFile);
  // Project source and input directory are never bypassed by a staging
  // authority; only the staged output descendant is internal.
  assertPathNotReservedForCoordination(cwd);
  assertPathNotReservedForCoordination(inputDir);
  assertGenerationOutputAllowed({
    outputDir,
    ...(params.stagingAuthority === undefined
      ? {}
      : { stagingAuthority: params.stagingAuthority }),
  });
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
    // Output directories are created only after the lock is acquired so a run
    // that loses the concurrency race cannot create or mutate the output tree.
    return plan;
  });

const prepareLockedOutput = (plan: GenerationPlan) =>
  Effect.gen(function* () {
    // Revalidate after lock acquisition so a target swapped between the
    // initial preflight and mutation cannot redirect the orphan sweep or
    // clean step through a symlink.
    yield* assertSafeCleanTargetEffect(
      plan.outputDir,
      plan.cwd,
      plan.params.config?.clean !== false ? plan.inputFile : undefined
    );
    yield* sweepOrphanTempdirs(plan.outputDir);

    if (plan.params.config?.clean !== false) {
      yield* Effect.logInfo("Cleaning output directory...");
      yield* cleanOutputDirPreservingLock(plan.outputDir);
    }

    yield* ensureOutputDirectories(plan);
  });

export const withGenerationLock = <A, E, R>(
  plan: GenerationPlan,
  workflow: (lockedPlan: GenerationPlan) => Effect.Effect<A, E, R>
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
    outputLock => {
      const lockedPlan: GenerationPlan = {
        ...plan,
        outputDir: outputLock.outputDir,
        responsesOutputDir: path.join(outputLock.outputDir, "responses"),
        specOutputDir: path.join(outputLock.outputDir, "spec"),
      };
      return assertSafeCleanTargetEffect(
        plan.outputDir,
        plan.cwd,
        plan.params.config?.clean !== false ? plan.inputFile : undefined
      ).pipe(
        Effect.zipRight(prepareLockedOutput(lockedPlan)),
        Effect.zipRight(workflow(lockedPlan))
      );
    },
    outputLock =>
      Effect.gen(function* () {
        yield* releaseOutputLock(outputLock);
        yield* Effect.logDebug(`Released output lock at '${outputLock.path}'`);
      })
  );
