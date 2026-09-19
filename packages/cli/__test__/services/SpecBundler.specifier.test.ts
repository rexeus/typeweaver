import { pathToFileURL } from "node:url";
import { describe, expect, test } from "vitest";
import {
  createWrapperImportSpecifierWith,
  isExternalModule,
} from "../../src/services/SpecBundler.js";

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

describe("SpecBundler external classification", () => {
  test("bundles file URLs and relative sources but keeps node/bare external", () => {
    expect(isExternalModule("file:///D:/repo/spec/index.ts")).toBe(false);
    expect(isExternalModule("./relative.ts")).toBe(false);
    expect(isExternalModule("../parent.ts")).toBe(false);
    expect(isExternalModule("node:fs")).toBe(true);
    expect(isExternalModule("zod")).toBe(true);
  });
});
