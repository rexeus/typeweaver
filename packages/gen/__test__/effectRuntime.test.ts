import { describe, expect } from "vitest";
import { it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { MainLayer } from "../src/runtime/MainLayer.js";

describe("MainLayer", () => {
  it.effect("composes a runnable Effect program", () =>
    Effect.gen(function* () {
      const result = yield* Effect.succeed("typeweaver");
      expect(result).toBe("typeweaver");
    }).pipe(Effect.provide(MainLayer))
  );

  it.effect("supports Effect.gen composition over the layer", () =>
    Effect.gen(function* () {
      const a = yield* Effect.succeed(2);
      const b = yield* Effect.succeed(3);
      expect(a * b).toBe(6);
    }).pipe(Effect.provide(MainLayer))
  );

  it.effect("propagates typed failures through the layer", () =>
    Effect.gen(function* () {
      class SmokeTestError {
        public readonly _tag = "SmokeTestError";
      }
      const exit = yield* Effect.exit(
        Effect.fail(new SmokeTestError()).pipe(Effect.provide(MainLayer))
      );
      expect(exit._tag).toBe("Failure");
    })
  );

  it("MainLayer is structurally a Layer", () => {
    expect(Layer.isLayer(MainLayer)).toBe(true);
  });
});
