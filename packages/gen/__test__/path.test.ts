import path from "node:path";
import { describe, expect, test } from "vitest";
import { relative } from "../src/helpers/path.js";

describe("relative", () => {
  test.each([
    {
      scenario: "identical source and target paths",
      from: path.join("/project", "output"),
      to: path.join("/project", "output"),
      expected: "./",
    },
    {
      scenario: "same-directory target file",
      from: path.join("/project", "output"),
      to: path.join("/project", "output", "types.ts"),
      expected: "./types.ts",
    },
    {
      scenario: "child directory target",
      from: path.join("/project", "output"),
      to: path.join("/project", "output", "lib"),
      expected: "./lib",
    },
    {
      scenario: "direct parent traversal",
      from: path.join("/project", "output", "account"),
      to: path.join("/project", "output"),
      expected: "..",
    },
    {
      scenario: "sibling directory reached through parent traversal",
      from: path.join("/project", "output", "account"),
      to: path.join("/project", "output", "lib"),
      expected: "../lib",
    },
    {
      scenario: "external package reached through parent traversal",
      from: path.join("/project", "src"),
      to: path.join(
        "/project",
        "vendor",
        "@rexeus",
        "typeweaver-core",
        "dist",
        "index.js"
      ),
      expected: "../vendor/@rexeus/typeweaver-core/dist/index.js",
    },
  ])("returns $expected for $scenario", ({ from, to, expected }) => {
    const result = relative(from, to);

    expect(result).toBe(expected);
  });

  test("emits POSIX separators for nested relative paths", () => {
    const from = path.join("/project", "src", "a", "b");
    const to = path.join("/project", "src", "c", "d", "file.ts");
    const result = relative(from, to);

    expect(result).not.toContain("\\");
    expect(result).toBe("../../c/d/file.ts");
  });
});
