import { describe, expect, test } from "vitest";
import { findReservedPathParameter } from "../../src/ReservedPathParameter.js";

describe("findReservedPathParameter", () => {
  test.each([
    "/todos/:__proto__",
    "/todos/:__proto__/sub",
    "/files/:__proto__.:format",
    "/:__proto__-suffix",
    "/files/:__proto__{suffix}",
    "/:__proto__!suffix",
    "/:__proto__+suffix",
    "/:__proto__:rest",
    "/a/:x/:__proto__",
    "/files/:fileId/:__proto__",
    "/:__proto__?query=1",
  ])("rejects the reserved placeholder in %s", path => {
    expect(findReservedPathParameter(path)).toBe("__proto__");
  });

  test.each([
    "/todos/:todoId",
    "/files/:fileId.:format",
    "/todos/:todoId/subtodos/:subtodoId",
    "/todos/:constructor/:toString",
    "/todos/:__proto__x",
    "/todos/:x__proto__",
  ])("preserves the ordinary placeholder in %s", path => {
    expect(findReservedPathParameter(path)).toBeUndefined();
  });
});
