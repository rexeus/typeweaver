import { FileSystem } from "@effect/platform";
import { it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { describe, expect } from "vitest";
import { MainLayer } from "../src/runtime/MainLayer.js";

// MainLayer requires the platform-agnostic `FileSystem` tag (consumed by
// ContextBuilder's Effect-native context surface). The smoke tests here
// never touch the filesystem, so a no-op implementation suffices.
const TestMainLayer = MainLayer.pipe(Layer.provide(FileSystem.layerNoop({})));

describe("MainLayer", () => {
  it.effect("composes a runnable Effect program", () =>
    Effect.gen(function* () {
      const result = yield* Effect.succeed("typeweaver");
      expect(result).toBe("typeweaver");
    }).pipe(Effect.provide(TestMainLayer))
  );

  it.effect("supports Effect.gen composition over the layer", () =>
    Effect.gen(function* () {
      const a = yield* Effect.succeed(2);
      const b = yield* Effect.succeed(3);
      expect(a * b).toBe(6);
    }).pipe(Effect.provide(TestMainLayer))
  );

  it.effect("propagates typed failures through the layer", () =>
    Effect.gen(function* () {
      class SmokeTestError {
        public readonly _tag = "SmokeTestError";
      }
      const exit = yield* Effect.exit(
        Effect.fail(new SmokeTestError()).pipe(Effect.provide(TestMainLayer))
      );
      expect(exit._tag).toBe("Failure");
    })
  );

  it("MainLayer is structurally a Layer", () => {
    expect(Layer.isLayer(MainLayer)).toBe(true);
  });
});
