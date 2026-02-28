import path from "node:path";
import { describe, expect, test } from "vitest";
import { Path } from "../src/helpers/Path";

describe("Path.relative", () => {
  test("returns POSIX path with ./ prefix for sibling directories", () => {
    const from = path.join("/project", "output", "account");
    const to = path.join("/project", "output", "lib");
    const result = Path.relative(from, to);

    expect(result).toBe("../lib");
    expect(result).not.toContain("\\");
  });

  test("prepends ./ for paths in the same directory", () => {
    const from = path.join("/project", "output");
    const to = path.join("/project", "output", "types.ts");
    const result = Path.relative(from, to);

    expect(result).toBe("./types.ts");
    expect(result).not.toContain("\\");
  });

  test("never contains backslashes in output", () => {
    const from = path.join("/project", "src", "a", "b");
    const to = path.join("/project", "src", "c", "d", "file.ts");
    const result = Path.relative(from, to);

    expect(result).not.toContain("\\");
    expect(result).toBe("../../c/d/file.ts");
  });

  test("strips node_modules prefix and uses forward slashes", () => {
    const from = path.join("/project", "src");
    const to = path.join(
      "/project",
      "node_modules",
      "@rexeus",
      "typeweaver-core",
      "dist",
      "index.js"
    );
    const result = Path.relative(from, to);

    expect(result).toBe("@rexeus/typeweaver-core/dist/index.js");
    expect(result).not.toContain("\\");
  });
});
