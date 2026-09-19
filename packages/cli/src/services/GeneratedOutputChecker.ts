import path from "node:path";
import { FileSystem } from "@effect/platform";
import { Effect, Logger, LogLevel } from "effect";
import {
  GeneratedOutputDriftError,
  ReservedCoordinationPathError,
  UnsafeSharedTempDirectoryError,
} from "../errors/index.js";
import { Generator } from "./Generator.js";
import {
  acquireOutputLock,
  assertSafeCleanTargetEffect,
  releaseOutputLock,
} from "./generatorIO.js";
import { withMirroredOutputStage } from "./internal/projectStaging.js";
import {
  assertPathNotReservedForCoordination,
  createStagingAuthority,
} from "./internal/stagingAuthority.js";
import {
  compareOutputTrees,
  isMatchingOutput,
  snapshotOutputTree,
} from "./outputComparison.js";
import type { GenerateParams } from "./generatorTypes.js";
import type { StagingAuthority } from "./internal/stagingAuthority.js";

export type CheckGenerateParams = GenerateParams & {
  /**
   * When true the staged generation keeps its normal info/debug logging so
   * `--verbose` diagnostics stay complete. When false the staged generation is
   * quiet and only the concise success line is emitted.
   */
  readonly verbose?: boolean;
};

type CheckOperationDeps = {
  readonly generator: Generator;
  readonly configuredOutputDir: string;
  readonly inputFile: string;
  readonly stagedOutputDir: string;
  readonly cwd: string;
  readonly config: GenerateParams["config"];
  readonly verbose: boolean;
  readonly stagingAuthority: StagingAuthority;
};

const runCheckOperation = (deps: CheckOperationDeps) =>
  Effect.gen(function* () {
    if (deps.config?.clean === false) {
      yield* assertSafeCleanTargetEffect(
        deps.configuredOutputDir,
        deps.cwd,
        undefined
      );
      yield* snapshotOutputTree({
        sourceRoot: deps.configuredOutputDir,
        destinationRoot: deps.stagedOutputDir,
      });
    }

    const generation = deps.generator.generate({
      inputFile: deps.inputFile,
      outputDir: deps.stagedOutputDir,
      config: {
        ...deps.config,
        input: deps.inputFile,
        output: deps.stagedOutputDir,
      },
      currentWorkingDirectory: deps.cwd,
      stagingAuthority: deps.stagingAuthority,
      externalImportBase: path.join(
        deps.configuredOutputDir,
        "spec",
        "spec.js"
      ),
    });
    yield* deps.verbose
      ? generation
      : generation.pipe(Logger.withMinimumLogLevel(LogLevel.Warning));

    yield* assertSafeCleanTargetEffect(
      deps.configuredOutputDir,
      deps.cwd,
      undefined
    );
    const comparison = yield* compareOutputTrees({
      committedRoot: deps.configuredOutputDir,
      generatedRoot: deps.stagedOutputDir,
    });
    if (!isMatchingOutput(comparison)) {
      return yield* new GeneratedOutputDriftError({
        outputDir: deps.configuredOutputDir,
        added: comparison.added,
        removed: comparison.removed,
        changed: comparison.changed,
      });
    }

    yield* Effect.logInfo(
      `Generated output at '${deps.configuredOutputDir}' is current (${String(comparison.generatedFileCount)} files).`
    );
  });

const withConfiguredOutputLock = <A, E, R>(params: {
  readonly configuredOutputDir: string;
  readonly inputFile: string;
  readonly run: (lockedOutputDir: string) => Effect.Effect<A, E, R>;
}) =>
  Effect.acquireUseRelease(
    Effect.gen(function* () {
      const outputLock = yield* acquireOutputLock({
        outputDir: params.configuredOutputDir,
        inputFile: params.inputFile,
      });
      yield* Effect.logDebug(
        `Acquired output lock at '${outputLock.path}' (pid ${String(process.pid)})`
      );
      return outputLock;
    }),
    outputLock => params.run(outputLock.outputDir),
    outputLock =>
      Effect.gen(function* () {
        yield* releaseOutputLock(outputLock);
        yield* Effect.logDebug(`Released output lock at '${outputLock.path}'`);
      })
  );

/**
 * Read-only drift check over generated output.
 *
 * A check validates the configured output and source are outside the reserved
 * coordination namespace, then holds the configured-output lock before any
 * staging begins. It generates into a nested stage whose ancestor
 * `node_modules` topology mirrors the original configured output, pins isolated
 * spec evaluation against the original `<output>/spec/spec.js` location so the
 * shared temp parent cannot inject packages, and byte-compares the fresh tree
 * against the committed tree without ever writing to it. With `clean: false`
 * the committed tree is first snapshotted into the stage so preservation
 * semantics mirror a normal no-clean generation. Drift is reported through
 * `GeneratedOutputDriftError` with sorted `Added`, `Removed`, and `Changed`
 * groups.
 */
export class GeneratedOutputChecker extends Effect.Service<GeneratedOutputChecker>()(
  "typeweaver/GeneratedOutputChecker",
  {
    effect: Effect.gen(function* () {
      const fileSystem = yield* FileSystem.FileSystem;
      const generator = yield* Generator;

      const check = Effect.fn("typeweaver.GeneratedOutputChecker.check")(
        function* (params: CheckGenerateParams) {
          const cwd = params.currentWorkingDirectory ?? process.cwd();
          const configuredOutputDir = path.resolve(cwd, params.outputDir);
          const inputFile = path.resolve(cwd, params.inputFile);
          const inputDirectory = path.dirname(inputFile);
          const reservedCandidates = [
            configuredOutputDir,
            cwd,
            inputDirectory,
          ] as const;

          yield* Effect.try({
            try: () => {
              for (const candidate of reservedCandidates) {
                assertPathNotReservedForCoordination(candidate);
              }
            },
            catch: error => {
              if (
                error instanceof ReservedCoordinationPathError ||
                error instanceof UnsafeSharedTempDirectoryError
              ) {
                return error;
              }
              throw error;
            },
          });

          yield* assertSafeCleanTargetEffect(
            configuredOutputDir,
            cwd,
            undefined
          );
          yield* withConfiguredOutputLock({
            configuredOutputDir,
            inputFile,
            run: lockedOutputDir => {
              const forbiddenRoots = [
                lockedOutputDir,
                cwd,
                inputDirectory,
              ] as const;
              return withMirroredOutputStage(
                fileSystem,
                { configuredOutputDir: lockedOutputDir, forbiddenRoots },
                ({ stageRoot, stagedOutputDir }) =>
                  runCheckOperation({
                    generator,
                    configuredOutputDir: lockedOutputDir,
                    inputFile,
                    stagedOutputDir,
                    cwd,
                    config: params.config,
                    verbose: params.verbose === true,
                    stagingAuthority: createStagingAuthority(stageRoot),
                  })
              );
            },
          });
        }
      );

      return { check } as const;
    }),
    dependencies: [Generator.Default],
    accessors: true,
  }
) {}
