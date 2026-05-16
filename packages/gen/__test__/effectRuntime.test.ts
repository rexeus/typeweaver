import { Effect, Layer } from "effect";
import { describe, expect, test } from "vitest";
import { MainLayer } from "../src/runtime/MainLayer.js";

describe("MainLayer", () => {
  test("composes a runnable Effect program", async () => {
    const program = Effect.succeed("typeweaver");

    const result = await Effect.runPromise(
      program.pipe(Effect.provide(MainLayer))
    );

    expect(result).toBe("typeweaver");
  });

  test("supports Effect.gen composition over the layer", async () => {
    const program = Effect.gen(function* () {
      const a = yield* Effect.succeed(2);
      const b = yield* Effect.succeed(3);
      return a * b;
    });

    const result = await Effect.runPromise(
      program.pipe(Effect.provide(MainLayer))
    );

    expect(result).toBe(6);
  });

  test("propagates typed errors through the layer", async () => {
    class SmokeTestError extends Error {
      public override readonly name = "SmokeTestError";
    }

    const program = Effect.fail(new SmokeTestError("boom"));

    const exit = await Effect.runPromiseExit(
      program.pipe(Effect.provide(MainLayer))
    );

    expect(exit._tag).toBe("Failure");
  });

  test("MainLayer is structurally a Layer", () => {
    expect(Layer.isLayer(MainLayer)).toBe(true);
  });
});
