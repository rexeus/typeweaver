import { pathToFileURL } from "node:url";
import { FileSystem } from "@effect/platform";
import { Effect, Layer } from "effect";
import { makeInMemoryFileSystem } from "test-utils/src/effect/index.js";
import { describe, expect, test } from "vitest";
import {
  createWrapperImportSpecifierWith,
  SpecBundler,
} from "../../src/services/SpecBundler.js";
import type { BuildOptions } from "rolldown";

const identityRealpath = (filePath: string): string => filePath;

const windowsFileUrl = (filePath: string): { readonly href: string } =>
  pathToFileURL(filePath, { windows: true });

const getBuildOutputFile = (config: BuildOptions): string => {
  const output = config.output;
  if (typeof output !== "object" || output === null || Array.isArray(output)) {
    throw new TypeError("Expected one rolldown output configuration");
  }
  const file = Reflect.get(output, "file");
  if (typeof file !== "string") {
    throw new TypeError("Expected rolldown output.file");
  }
  return file;
};

const isExternalPredicate = (
  value: unknown
): value is (source: string) => boolean => typeof value === "function";

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
  test("bundles file URLs and bare-relative sources but keeps node/bare external", async () => {
    const { layer: fileSystemLayer } = makeInMemoryFileSystem();
    const bundlerLayer = Layer.provide(SpecBundler.Default, fileSystemLayer);
    const testLayer = Layer.merge(fileSystemLayer, bundlerLayer);
    let externalImpl: unknown;

    await Effect.runPromise(
      Effect.gen(function* () {
        const bundler = yield* SpecBundler;
        const fileSystem = yield* FileSystem.FileSystem;
        yield* bundler.bundle(
          { inputFile: "/in/spec/index.ts", specOutputDir: "/out/spec" },
          {
            build: (config: BuildOptions) => {
              externalImpl = config.external;
              return Effect.runPromise(
                fileSystem.writeFileString(
                  getBuildOutputFile(config),
                  "export const spec = {};\n"
                )
              );
            },
          }
        );
      }).pipe(Effect.provide(testLayer))
    );

    expect(isExternalPredicate(externalImpl)).toBe(true);
    if (!isExternalPredicate(externalImpl)) {
      return;
    }
    expect(externalImpl("file:///D:/repo/spec/index.ts")).toBe(false);
    expect(externalImpl("./relative.ts")).toBe(false);
    expect(externalImpl("node:fs")).toBe(true);
    expect(externalImpl("zod")).toBe(true);
  });
});
