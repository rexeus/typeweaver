import { pathToFileURL } from "node:url";
import { describe, expect, test } from "vitest";
import { isExternalModule } from "../../src/services/specBuild.js";
import {
  createWrapperImportSpecifier,
  createWrapperImportSpecifierWith,
} from "../../src/services/specWrapper.js";

const identityRealpath = (filePath: string): string => filePath;

const windowsFileUrl = (filePath: string): { readonly href: string } =>
  pathToFileURL(filePath, { windows: true });

describe("SpecBundler wrapper import specifier", () => {
  test("uses a file URL for a cross-drive Windows input", () => {
    const specifier = createWrapperImportSpecifierWith(
      "C:\\Windows\\Temp\\typeweaver-check-Ab12Z9\\output\\spec\\spec-entrypoint.ts",
      "D:\\repo\\packages\\api\\spec\\index.ts",
      identityRealpath,
      windowsFileUrl
    );

    expect(specifier).toBe("file:///D:/repo/packages/api/spec/index.ts");
  });

  test("uses a file URL for a cross-root UNC input", () => {
    const specifier = createWrapperImportSpecifierWith(
      "C:\\repo\\stage\\spec-entrypoint.ts",
      "\\\\server\\share\\spec\\index.ts",
      identityRealpath,
      windowsFileUrl
    );

    expect(specifier).toBe("file://server/share/spec/index.ts");
  });

  test("keeps a same-drive Windows input relative", () => {
    const specifier = createWrapperImportSpecifierWith(
      "C:\\repo\\stage\\spec-entrypoint.ts",
      "C:\\repo\\spec\\index.ts",
      identityRealpath,
      () => ({ href: "file:///unused" })
    );

    expect(specifier).toBe("../spec/index.ts");
  });

  test("keeps a same-drive descendant Windows input relative", () => {
    const specifier = createWrapperImportSpecifierWith(
      "C:\\repo\\stage\\spec-entrypoint.ts",
      "C:\\repo\\stage\\sub\\index.ts",
      identityRealpath,
      () => ({ href: "file:///unused" })
    );

    expect(specifier).toBe("./sub/index.ts");
  });
});

describe("SpecBundler relative wrapper import specifiers", () => {
  test("creates a relative wrapper import specifier for posix paths", () => {
    expect(
      createWrapperImportSpecifier(
        "/tmp/typeweaver/spec-entrypoint.ts",
        "/tmp/typeweaver/spec.ts"
      )
    ).toBe("./spec.ts");
  });

  test("creates a relative wrapper import specifier for windows paths", () => {
    expect(
      createWrapperImportSpecifier(
        "C:\\project\\.typeweaver\\spec-entrypoint.ts",
        "C:\\project\\specs\\spec.ts"
      )
    ).toBe("../specs/spec.ts");
  });

  test("creates a relative wrapper import specifier for UNC windows paths", () => {
    expect(
      createWrapperImportSpecifier(
        "\\\\server\\share\\project\\.typeweaver\\spec-entrypoint.ts",
        "\\\\server\\share\\project\\specs\\spec.ts"
      )
    ).toBe("../specs/spec.ts");
  });

  test("preserves spaces in wrapper import specifiers", () => {
    expect(
      createWrapperImportSpecifier(
        "/tmp/typeweaver/spec loader/spec-entrypoint.ts",
        "/tmp/typeweaver/spec source/spec.ts"
      )
    ).toBe("../spec source/spec.ts");
  });
});

describe("SpecBundler external classification", () => {
  test("bundles file URLs and relative sources but keeps node/bare external", () => {
    expect(isExternalModule("file:///D:/repo/spec/index.ts")).toBe(false);
    expect(isExternalModule("./relative.ts")).toBe(false);
    expect(isExternalModule("../parent.ts")).toBe(false);
    expect(isExternalModule("node:fs")).toBe(true);
    expect(isExternalModule("zod")).toBe(true);
  });
});
