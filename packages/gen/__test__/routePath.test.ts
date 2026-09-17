import { describe, expect, test } from "vitest";
import { getPathParameterNames } from "../src/helpers/routePath.js";

describe("getPathParameterNames canonical grammar", () => {
  test.each([
    {
      path: "/files/:__proto__.:format",
      expected: ["__proto__", "format"],
    },
    { path: "/:__proto__-suffix", expected: ["__proto__"] },
    { path: "/files/:__proto__{suffix}", expected: ["__proto__"] },
    { path: "/:__proto__!suffix", expected: ["__proto__"] },
    { path: "/a/:x/:__proto__", expected: ["x", "__proto__"] },
    { path: "/files/:fileId.:format", expected: ["fileId", "format"] },
    {
      path: "/todos/:todoId/subtodos/:subtodoId",
      expected: ["todoId", "subtodoId"],
    },
    { path: "/todos/:__proto__x", expected: ["__proto__x"] },
  ])("extracts placeholder names from $path", ({ path, expected }) => {
    expect(getPathParameterNames(path)).toEqual(expected);
  });
});
