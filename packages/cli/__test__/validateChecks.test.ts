import { describe, expect, test } from "vitest";
import { assertKnownDependencies } from "../src/pipeline/runner.js";
import { createValidateChecks } from "../src/validate/checks/index.js";

describe("validate checks", () => {
  test("every check's dependencies are declared with plugins enabled", () => {
    expect(() =>
      assertKnownDependencies(createValidateChecks({ plugins: true }))
    ).not.toThrow();
  });

  test("every check's dependencies are declared with plugins disabled", () => {
    expect(() =>
      assertKnownDependencies(createValidateChecks({ plugins: false }))
    ).not.toThrow();
  });
});
