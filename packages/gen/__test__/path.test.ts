import path from "node:path";
import { describe, expect, test } from "vitest";
import { relative } from "../src/helpers/path.js";

describe("relative", () => {
  test("returns POSIX path with ./ prefix for sibling directories", () => {
    const from = path.join("/project", "output", "account");
    const to = path.join("/project", "output", "lib");
    const result = relative(from, to);

    expect(result).toBe("../lib");
    expect(result).not.toContain("\\");
  });

  test("prepends ./ for paths in the same directory", () => {
    const from = path.join("/project", "output");
    const to = path.join("/project", "output", "types.ts");
    const result = relative(from, to);

    expect(result).toBe("./types.ts");
    expect(result).not.toContain("\\");
  });

  test("never contains backslashes in output", () => {
    const from = path.join("/project", "src", "a", "b");
    const to = path.join("/project", "src", "c", "d", "file.ts");
    const result = relative(from, to);

    expect(result).not.toContain("\\");
    expect(result).toBe("../../c/d/file.ts");
  });

  test("preserves parent traversal for external directories", () => {
    const from = path.join("/project", "src");
    const to = path.join(
      "/project",
      "vendor",
      "@rexeus",
      "typeweaver-core",
      "dist",
      "index.js"
    );
    const result = relative(from, to);

    expect(result).toBe("../vendor/@rexeus/typeweaver-core/dist/index.js");
    expect(result).not.toContain("\\");
  });
});
