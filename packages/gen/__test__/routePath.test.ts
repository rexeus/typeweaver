import { describe, expect, test } from "vitest";
import {
  getPathParameterNames,
  normalizeRoutePath,
} from "../src/helpers/routePath.js";

describe("normalizeRoutePath canonical grammar", () => {
  test("preserves embedded literal structure while erasing parameter names", () => {
    expect(normalizeRoutePath("/files/:fileId.:format")).toBe(
      '[[["literal","files"]],[["param"],["literal","."],["param"]]]'
    );
    expect(normalizeRoutePath("/assets/:name-:hash.:ext")).toBe(
      '[[["literal","assets"]],[["param"],["literal","-"],["param"],["literal","."],["param"]]]'
    );
  });

  test("distinguishes bare and embedded parameter shapes", () => {
    expect(normalizeRoutePath("/files/:fileId")).not.toBe(
      normalizeRoutePath("/files/:fileId.:format")
    );
  });

  test("normalizes renamed embedded parameters to the same shape", () => {
    expect(normalizeRoutePath("/files/:fileId.:format")).toBe(
      normalizeRoutePath("/files/:name.:extension")
    );
  });

  test("distinguishes literal colons from placeholder markers", () => {
    expect(normalizeRoutePath("/files/report:")).not.toBe(
      normalizeRoutePath("/files/report:id")
    );
  });
});

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
