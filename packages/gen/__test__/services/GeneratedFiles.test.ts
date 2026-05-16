import { it } from "@effect/vitest";
import { Effect } from "effect";
import { describe, expect } from "vitest";
import { GeneratedFiles } from "../../src/services/GeneratedFiles.js";

describe("GeneratedFiles", () => {
  it.effect("snapshot returns sorted paths regardless of insertion order", () =>
    Effect.gen(function* () {
      yield* GeneratedFiles.add("zeta/z.ts");
      yield* GeneratedFiles.add("alpha/a.ts");
      yield* GeneratedFiles.add("mu/m.ts");
      const snapshot = yield* GeneratedFiles.snapshot;
      expect(snapshot).toEqual(["alpha/a.ts", "mu/m.ts", "zeta/z.ts"]);
    }).pipe(Effect.provide(GeneratedFiles.Default))
  );

  it.effect("deduplicates repeated additions of the same path", () =>
    Effect.gen(function* () {
      yield* GeneratedFiles.add("a.ts");
      yield* GeneratedFiles.add("a.ts");
      yield* GeneratedFiles.add("a.ts");
      const size = yield* GeneratedFiles.size;
      expect(size).toBe(1);
    }).pipe(Effect.provide(GeneratedFiles.Default))
  );

  it.effect("clear empties the store", () =>
    Effect.gen(function* () {
      yield* GeneratedFiles.add("a.ts");
      yield* GeneratedFiles.add("b.ts");
      yield* GeneratedFiles.clear;
      const snapshot = yield* GeneratedFiles.snapshot;
      expect(snapshot).toEqual([]);
    }).pipe(Effect.provide(GeneratedFiles.Default))
  );

  it.effect("isolates state between independent runtime instances", () =>
    Effect.gen(function* () {
      yield* GeneratedFiles.add("only-here.ts");
      const here = yield* GeneratedFiles.snapshot;
      expect(here).toEqual(["only-here.ts"]);
    }).pipe(Effect.provide(GeneratedFiles.Default))
  );
});
