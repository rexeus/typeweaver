import { describe, expect, test } from "vitest";
import {
  createWrapperImportSpecifier,
  isExternalSpecImport,
} from "../src/generators/spec/specBundler.js";

describe("createWrapperImportSpecifier", () => {
  test("produces a relative specifier for posix paths", () => {
    expect(
      createWrapperImportSpecifier(
        "/tmp/typeweaver/spec-entrypoint.ts",
        "/tmp/typeweaver/spec.ts"
      )
    ).toBe("./spec.ts");
  });

  test("produces a relative specifier for windows paths", () => {
    expect(
      createWrapperImportSpecifier(
        "C:\\project\\.typeweaver\\spec-entrypoint.ts",
        "C:\\project\\specs\\spec.ts"
      )
    ).toBe("../specs/spec.ts");
  });
});

describe("isExternalSpecImport", () => {
  test("treats bare package imports as external", () => {
    expect(isExternalSpecImport("zod")).toBe(true);
    expect(isExternalSpecImport("@rexeus/typeweaver-core")).toBe(true);
    expect(isExternalSpecImport("node:path")).toBe(true);
  });

  test("treats relative and absolute imports as internal", () => {
    expect(isExternalSpecImport("./todo/index.ts")).toBe(false);
    expect(isExternalSpecImport("/workspace/spec/index.ts")).toBe(false);
  });
});
