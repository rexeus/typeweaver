import { FileSystem } from "@effect/platform";
import { Effect, Layer } from "effect";
import { describe, expect, test } from "vitest";
import { ContextBuilder } from "../../src/services/ContextBuilder.js";

const aBuildPluginContextProgram = (params: {
  readonly outputDir: string;
  readonly inputDir: string;
  readonly config: Record<string, unknown>;
}) =>
  Effect.gen(function* () {
    const builder = yield* ContextBuilder;
    return yield* builder.buildPluginContext(params);
  }).pipe(
    Effect.provide(
      ContextBuilder.Default.pipe(Layer.provide(FileSystem.layerNoop({})))
    )
  );

describe("ContextBuilder", () => {
  test("buildPluginContext returns a context populated from the supplied params", async () => {
    const context = await Effect.runPromise(
      aBuildPluginContextProgram({
        outputDir: "/tmp/output",
        inputDir: "/tmp/input",
        config: { plugins: ["clients"], format: false },
      })
    );

    expect(context).toEqual({
      outputDir: "/tmp/output",
      inputDir: "/tmp/input",
      config: { plugins: ["clients"], format: false },
    });
  });
});
