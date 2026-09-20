import { Effect } from "effect";
import { describe, expect, test } from "vitest";
import { Generator } from "../../src/index.js";

describe("public Generator service", () => {
  test("keeps the identity make constructor for test doubles", () => {
    const service = {
      generate: () => Effect.void,
    };

    expect(Generator.make(service)).toBe(service);
  });
});
