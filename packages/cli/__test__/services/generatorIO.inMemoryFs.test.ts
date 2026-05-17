import { FileSystem } from "@effect/platform";
import { Effect } from "effect";
import { makeInMemoryFileSystem } from "test-utils";
import { describe, expect, test } from "vitest";
import {
  ensureOutputDirectories,
  removeOutputDir,
} from "../../src/services/generatorIO.js";

const runAgainstInMemoryFs = async <A, E>(
  effect: Effect.Effect<A, E, FileSystem.FileSystem>
): Promise<{
  readonly result: A;
  readonly state: ReturnType<typeof makeInMemoryFileSystem>["state"];
}> => {
  const { layer, state } = makeInMemoryFileSystem();
  const result = await Effect.runPromise(effect.pipe(Effect.provide(layer)));
  return { result, state };
};

describe("generatorIO against InMemoryFileSystem", () => {
  test("ensureOutputDirectories creates the output, responses, and spec directories", async () => {
    const { state } = await runAgainstInMemoryFs(
      ensureOutputDirectories({
        outputDir: "/project/generated",
        responsesOutputDir: "/project/generated/responses",
        specOutputDir: "/project/generated/spec",
      })
    );

    expect(state.listDirectories()).toEqual(
      expect.arrayContaining([
        "/project/generated",
        "/project/generated/responses",
        "/project/generated/spec",
      ])
    );
  });

  test("removeOutputDir is a no-op when the directory does not exist", async () => {
    const { state } = await runAgainstInMemoryFs(
      removeOutputDir("/project/missing")
    );

    expect(state.hasFile("/project/missing")).toBe(false);
    expect(state.listDirectories()).not.toContain("/project/missing");
  });

  test("removeOutputDir recursively deletes a previously created tree", async () => {
    const program = Effect.gen(function* () {
      const fileSystem = yield* FileSystem.FileSystem;
      yield* fileSystem.makeDirectory("/project/generated", {
        recursive: true,
      });
      yield* fileSystem.writeFileString(
        "/project/generated/spec/spec.d.ts",
        "export declare const spec: unknown;\n"
      );
      yield* removeOutputDir("/project/generated");
    });

    const { state } = await runAgainstInMemoryFs(program);

    expect(state.hasFile("/project/generated/spec/spec.d.ts")).toBe(false);
    expect(state.listDirectories()).not.toContain("/project/generated");
  });

  test("writeFileString followed by readFileString returns the original content", async () => {
    const program = Effect.gen(function* () {
      const fileSystem = yield* FileSystem.FileSystem;
      yield* fileSystem.writeFileString(
        "/project/spec.d.ts",
        "export declare const spec: SpecDefinition;\n"
      );
      return yield* fileSystem.readFileString("/project/spec.d.ts");
    });

    const { result } = await runAgainstInMemoryFs(program);

    expect(result).toBe("export declare const spec: SpecDefinition;\n");
  });
});
