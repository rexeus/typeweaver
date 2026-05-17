import { Cause, Effect, Exit, Layer } from "effect";
import { makeInMemoryFileSystem } from "test-utils";
import { describe, expect, test } from "vitest";
import { SpecBundler } from "../../src/services/SpecBundler.js";

type StateHandle = ReturnType<typeof makeInMemoryFileSystem>["state"];

const runWithBundler = async <A, E>(
  build: (state: StateHandle) => Effect.Effect<A, E, SpecBundler>
): Promise<{
  readonly exit: Exit.Exit<A, E>;
  readonly state: StateHandle;
}> => {
  const { layer: fileSystemLayer, state } = makeInMemoryFileSystem();
  const bundlerLayer = Layer.provide(SpecBundler.Default, fileSystemLayer);
  const exit = await Effect.runPromise(
    build(state).pipe(Effect.provide(bundlerLayer), Effect.exit)
  );
  return { exit, state };
};

describe("SpecBundler temp directory lifecycle", () => {
  test("the temp directory is present in the filesystem while build runs and absent after the scope closes", async () => {
    let tempDirAtBuildTime: string | undefined;
    let tempDirExistedAtBuildTime = false;

    const { exit, state } = await runWithBundler(state =>
      Effect.gen(function* () {
        const bundler = yield* SpecBundler;

        const recordingBuild = (config: {
          readonly cwd?: string;
          readonly output: { readonly file: string };
        }): Promise<unknown> => {
          tempDirAtBuildTime = config.cwd;
          tempDirExistedAtBuildTime =
            tempDirAtBuildTime !== undefined &&
            state.listDirectories().includes(tempDirAtBuildTime);
          return Promise.resolve();
        };

        return yield* bundler.bundle(
          {
            inputFile: "/in/spec/index.ts",
            specOutputDir: "/out/spec",
          },
          {
            build: recordingBuild as never,
            existsSync: () => true,
          }
        );
      })
    );

    if (Exit.isFailure(exit)) {
      // eslint-disable-next-line no-console
      console.error(Cause.pretty(exit.cause));
    }
    expect(Exit.isSuccess(exit)).toBe(true);
    expect(tempDirAtBuildTime).toBeDefined();
    expect(tempDirExistedAtBuildTime).toBe(true);
    if (tempDirAtBuildTime !== undefined) {
      expect(state.listDirectories()).not.toContain(tempDirAtBuildTime);
    }
  });

  test("the temp directory is removed even when build throws", async () => {
    let tempDirAtBuildTime: string | undefined;

    const { exit, state } = await runWithBundler(() =>
      Effect.gen(function* () {
        const bundler = yield* SpecBundler;

        const throwingBuild = (config: {
          readonly cwd?: string;
        }): Promise<unknown> => {
          tempDirAtBuildTime = config.cwd;
          return Promise.reject(new Error("rolldown crashed"));
        };

        return yield* bundler.bundle(
          {
            inputFile: "/in/spec/index.ts",
            specOutputDir: "/out/spec",
          },
          {
            build: throwingBuild as never,
          }
        );
      })
    );

    expect(Exit.isFailure(exit)).toBe(true);
    expect(tempDirAtBuildTime).toBeDefined();
    if (tempDirAtBuildTime !== undefined) {
      expect(state.listDirectories()).not.toContain(tempDirAtBuildTime);
    }
  });
});
