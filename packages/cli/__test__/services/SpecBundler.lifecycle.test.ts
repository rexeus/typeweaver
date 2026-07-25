import {
  coordinationArtifactMarkerSource,
  TYPEWEAVER_COORDINATION_MARKER_FILE,
} from "@rexeus/typeweaver-gen";
import { FileSystem } from "@effect/platform";
import {
  Cause,
  Deferred,
  Effect,
  Exit,
  Fiber,
  Layer,
  Option,
  Runtime,
} from "effect";
import { makeInMemoryFileSystem } from "test-utils/src/effect/index.js";
import { describe, expect, test } from "vitest";
import { SpecBundler } from "../../src/services/SpecBundler.js";
import type { BuildOptions } from "rolldown";

type StateHandle = ReturnType<typeof makeInMemoryFileSystem>["state"];

const getBuildOutputFile = (config: BuildOptions): string => {
  const output = config.output;
  if (typeof output !== "object" || output === null || Array.isArray(output)) {
    throw new TypeError("Expected one rolldown output configuration");
  }
  const file = Reflect.get(output, "file");
  if (typeof file !== "string") {
    throw new TypeError("Expected rolldown output.file");
  }
  return file;
};

const writeBuildOutput = (
  fileSystem: FileSystem.FileSystem,
  config: BuildOptions,
  contents: string
): Promise<void> =>
  Effect.runPromise(
    fileSystem.writeFileString(getBuildOutputFile(config), contents)
  );

const makeRejectedBuild =
  (fileSystem: FileSystem.FileSystem) =>
  async (config: BuildOptions): Promise<unknown> => {
    await writeBuildOutput(
      fileSystem,
      config,
      "export const partial = true;\n"
    );
    throw new Error("rolldown crashed");
  };

const runWithBundler = async <A, E>(
  build: (
    state: StateHandle
  ) => Effect.Effect<A, E, SpecBundler | FileSystem.FileSystem>
): Promise<{
  readonly exit: Exit.Exit<A, E>;
  readonly state: StateHandle;
}> => {
  const { layer: fileSystemLayer, state } = makeInMemoryFileSystem();
  const bundlerLayer = Layer.provide(SpecBundler.Default, fileSystemLayer);
  const testLayer = Layer.merge(fileSystemLayer, bundlerLayer);
  const exit = await Effect.runPromise(
    build(state).pipe(Effect.provide(testLayer), Effect.exit)
  );
  return { exit, state };
};

describe("SpecBundler temp directory lifecycle", () => {
  test("the temp directory is present in the filesystem while build runs and absent after the scope closes", async () => {
    let tempDirAtBuildTime: string | undefined;
    let tempDirExistedAtBuildTime = false;
    let markerSourceAtBuildTime: string | undefined;

    const { exit, state } = await runWithBundler(state =>
      Effect.gen(function* () {
        const bundler = yield* SpecBundler;
        const fileSystem = yield* FileSystem.FileSystem;

        const recordingBuild = (config: BuildOptions): Promise<unknown> => {
          tempDirAtBuildTime = config.cwd;
          tempDirExistedAtBuildTime =
            tempDirAtBuildTime !== undefined &&
            state.listDirectories().includes(tempDirAtBuildTime);
          if (tempDirAtBuildTime !== undefined) {
            markerSourceAtBuildTime = state.readFile(
              `${tempDirAtBuildTime}/${TYPEWEAVER_COORDINATION_MARKER_FILE}`
            );
          }
          return writeBuildOutput(
            fileSystem,
            config,
            "export const spec = {};\n"
          );
        };

        return yield* bundler.bundle(
          {
            inputFile: "/in/spec/index.ts",
            specOutputDir: "/out/spec",
          },
          {
            build: recordingBuild,
          }
        );
      })
    );

    expect(Exit.isSuccess(exit)).toBe(true);
    expect(tempDirAtBuildTime).toBeDefined();
    expect(tempDirExistedAtBuildTime).toBe(true);
    expect(markerSourceAtBuildTime).toBe(
      coordinationArtifactMarkerSource("spec-bundler-temp")
    );
    if (tempDirAtBuildTime !== undefined) {
      expect(state.listDirectories()).not.toContain(tempDirAtBuildTime);
    }
    expect(state.readFile("/out/spec/spec.js")).toBe(
      "export const spec = {};\n"
    );
  });
});

describe("SpecBundler interruption lifecycle", () => {
  test("interruption waits for build settlement, discards staged output, cleans the temp directory, and permits retry", async () => {
    const { exit, state } = await runWithBundler(() =>
      Effect.gen(function* () {
        const bundler = yield* SpecBundler;
        const fileSystem = yield* FileSystem.FileSystem;
        const entered = yield* Deferred.make<void>();
        const release = yield* Deferred.make<void>();
        const settled = yield* Deferred.make<void>();
        const runtime = yield* Effect.runtime<FileSystem.FileSystem>();
        const runPromise = Runtime.runPromise(runtime);
        let tempDirAtBuildTime: string | undefined;

        const controlledBuild = (config: BuildOptions): Promise<unknown> => {
          tempDirAtBuildTime = config.cwd;
          return runPromise(
            Deferred.succeed(entered, undefined).pipe(
              Effect.zipRight(Deferred.await(release)),
              Effect.zipRight(
                fileSystem.writeFileString(
                  getBuildOutputFile(config),
                  "export const interrupted = true;\n"
                )
              ),
              Effect.ensuring(Deferred.succeed(settled, undefined))
            )
          );
        };

        const bundling = yield* Effect.fork(
          bundler.bundle(
            {
              inputFile: "/in/spec/index.ts",
              specOutputDir: "/out/spec",
            },
            {
              build: controlledBuild,
            }
          )
        );
        yield* Deferred.await(entered);
        yield* Fiber.interruptFork(bundling);
        yield* Effect.yieldNow();
        const exitBeforeBuildSettlement = yield* Fiber.poll(bundling);
        const stagingExistsBeforeBuildSettlement =
          tempDirAtBuildTime !== undefined &&
          (yield* fileSystem.exists(tempDirAtBuildTime));
        yield* Deferred.succeed(release, undefined);
        yield* Deferred.await(settled);
        const interruptedExit = yield* Fiber.await(bundling);
        const outputAfterInterruption =
          yield* fileSystem.exists("/out/spec/spec.js");

        const retryResult = yield* bundler.bundle(
          {
            inputFile: "/in/spec/index.ts",
            specOutputDir: "/out/spec",
          },
          {
            build: (config: BuildOptions) =>
              writeBuildOutput(
                fileSystem,
                config,
                "export const retry = true;\n"
              ),
          }
        );

        return {
          interruptedExit,
          exitBeforeBuildSettlement,
          outputAfterInterruption,
          retryResult,
          stagingExistsBeforeBuildSettlement,
          tempDirAtBuildTime,
        };
      })
    );

    expect(Exit.isSuccess(exit)).toBe(true);
    if (!Exit.isSuccess(exit)) return;
    expect(Exit.isFailure(exit.value.interruptedExit)).toBe(true);
    if (Exit.isFailure(exit.value.interruptedExit)) {
      expect(Cause.isInterruptedOnly(exit.value.interruptedExit.cause)).toBe(
        true
      );
    }
    expect(Option.isNone(exit.value.exitBeforeBuildSettlement)).toBe(true);
    expect(exit.value.stagingExistsBeforeBuildSettlement).toBe(true);
    expect(exit.value.outputAfterInterruption).toBe(false);
    expect(exit.value.retryResult).toBe("/out/spec/spec.js");
    expect(state.readFile("/out/spec/spec.js")).toBe(
      "export const retry = true;\n"
    );
    expect(exit.value.tempDirAtBuildTime).toBeDefined();
    expect(
      state
        .listDirectories()
        .filter(directory => directory.includes("typeweaver-spec-loader-"))
    ).toEqual([]);
  });
});

describe("SpecBundler rejected-build lifecycle", () => {
  test("a rejected build cannot replace the previous bundle, cleans staging, and permits retry", async () => {
    const { exit, state } = await runWithBundler(() =>
      Effect.gen(function* () {
        const bundler = yield* SpecBundler;
        const fileSystem = yield* FileSystem.FileSystem;
        yield* fileSystem.makeDirectory("/out/spec", { recursive: true });
        yield* fileSystem.writeFileString(
          "/out/spec/spec.js",
          "export const previous = true;\n"
        );

        const failedExit = yield* Effect.exit(
          bundler.bundle(
            {
              inputFile: "/in/spec/index.ts",
              specOutputDir: "/out/spec",
            },
            {
              build: makeRejectedBuild(fileSystem),
            }
          )
        );
        const outputAfterFailure =
          yield* fileSystem.readFileString("/out/spec/spec.js");

        const retryResult = yield* bundler.bundle(
          {
            inputFile: "/in/spec/index.ts",
            specOutputDir: "/out/spec",
          },
          {
            build: (config: BuildOptions) =>
              writeBuildOutput(
                fileSystem,
                config,
                "export const retry = true;\n"
              ),
          }
        );

        return { failedExit, outputAfterFailure, retryResult };
      })
    );

    expect(Exit.isSuccess(exit)).toBe(true);
    if (!Exit.isSuccess(exit)) return;
    expect(Exit.isFailure(exit.value.failedExit)).toBe(true);
    expect(exit.value.outputAfterFailure).toBe(
      "export const previous = true;\n"
    );
    expect(exit.value.retryResult).toBe("/out/spec/spec.js");
    expect(state.readFile("/out/spec/spec.js")).toBe(
      "export const retry = true;\n"
    );
    expect(
      state
        .listDirectories()
        .filter(directory => directory.includes("typeweaver-spec-loader-"))
    ).toEqual([]);
  });
});

describe("SpecBundler post-build defect lifecycle", () => {
  test("a post-build defect cannot publish staged output, cleans staging, and permits retry", async () => {
    const probeDefect = new Error("existence probe defect");
    const { exit, state } = await runWithBundler(() =>
      Effect.gen(function* () {
        const bundler = yield* SpecBundler;
        const fileSystem = yield* FileSystem.FileSystem;
        yield* fileSystem.makeDirectory("/out/spec", { recursive: true });
        yield* fileSystem.writeFileString(
          "/out/spec/spec.js",
          "export const previous = true;\n"
        );

        const defectExit = yield* Effect.exit(
          bundler.bundle(
            {
              inputFile: "/in/spec/index.ts",
              specOutputDir: "/out/spec",
            },
            {
              build: (config: BuildOptions) =>
                writeBuildOutput(
                  fileSystem,
                  config,
                  "export const staged = true;\n"
                ),
              existsSync: () => {
                throw probeDefect;
              },
            }
          )
        );
        const outputAfterDefect =
          yield* fileSystem.readFileString("/out/spec/spec.js");

        const retryResult = yield* bundler.bundle(
          {
            inputFile: "/in/spec/index.ts",
            specOutputDir: "/out/spec",
          },
          {
            build: (config: BuildOptions) =>
              writeBuildOutput(
                fileSystem,
                config,
                "export const retry = true;\n"
              ),
          }
        );

        return { defectExit, outputAfterDefect, retryResult };
      })
    );

    expect(Exit.isSuccess(exit)).toBe(true);
    if (!Exit.isSuccess(exit)) return;
    expect(Exit.isFailure(exit.value.defectExit)).toBe(true);
    if (Exit.isFailure(exit.value.defectExit)) {
      expect(Cause.isDieType(exit.value.defectExit.cause)).toBe(true);
      if (Cause.isDieType(exit.value.defectExit.cause)) {
        expect(Cause.originalError(exit.value.defectExit.cause.defect)).toBe(
          probeDefect
        );
      }
    }
    expect(exit.value.outputAfterDefect).toBe(
      "export const previous = true;\n"
    );
    expect(exit.value.retryResult).toBe("/out/spec/spec.js");
    expect(state.readFile("/out/spec/spec.js")).toBe(
      "export const retry = true;\n"
    );
    expect(
      state
        .listDirectories()
        .filter(directory => directory.includes("typeweaver-spec-loader-"))
    ).toEqual([]);
  });
});
