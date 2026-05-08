import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import {
  buildPrecompiledLib,
  getTypeScriptFiles,
} from "./buildPrecompiledLib.mjs";

const tempDirectories: string[] = [];

function createPackageFixture(packageName: string): string {
  const packageDir = fs.mkdtempSync(
    path.join(os.tmpdir(), `typeweaver-precompiled-lib-${packageName}-`)
  );

  tempDirectories.push(packageDir);

  return packageDir;
}

function writeFile(filePath: string, content: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
}

function readPackageFile(packageDir: string, relativePath: string): string {
  return fs.readFileSync(path.join(packageDir, relativePath), "utf8");
}

function packageFileExists(packageDir: string, relativePath: string): boolean {
  return fs.existsSync(path.join(packageDir, relativePath));
}

afterEach(() => {
  while (tempDirectories.length > 0) {
    const tempDirectory = tempDirectories.pop();

    if (tempDirectory !== undefined) {
      fs.rmSync(tempDirectory, { recursive: true, force: true });
    }
  }
});

describe("getTypeScriptFiles", () => {
  test("discovers nested runtime source files and skips declarations", () => {
    const packageDir = createPackageFixture("discovery");
    const runtimeSourceDir = path.join(packageDir, "src", "lib");

    writeFile(
      path.join(runtimeSourceDir, "index.ts"),
      "export * from './nested/value';"
    );
    writeFile(
      path.join(runtimeSourceDir, "nested", "value.ts"),
      "export const value: number = 42;"
    );
    writeFile(
      path.join(runtimeSourceDir, "nested", "ignored.d.ts"),
      "export type Ignored = string;"
    );

    expect(getTypeScriptFiles(runtimeSourceDir)).toEqual([
      "index.ts",
      path.join("nested", "value.ts"),
    ]);
  });

  test("returns an empty list when the source directory is missing", () => {
    const packageDir = createPackageFixture("missing-source");

    const files = getTypeScriptFiles(path.join(packageDir, "src", "lib"));

    expect(files).toEqual([]);
  });
});

describe("buildPrecompiledLib", () => {
  test("transpiles runtime TypeScript files to JavaScript output", () => {
    const packageDir = createPackageFixture("runtime-transpile");

    writeFile(
      path.join(packageDir, "src", "lib", "runtime.ts"),
      "export const greet = (name: string): string => `hello ${name}`;\n"
    );
    writeFile(
      path.join(packageDir, "src", "lib", "nested", "value.ts"),
      "export const value: number = 42;\n"
    );

    buildPrecompiledLib({
      packageDir,
      runtimeSourceDir: "src/lib",
      outputDir: "dist/lib",
    });

    const runtimeOutput = readPackageFile(
      packageDir,
      path.join("dist", "lib", "runtime.js")
    );
    const nestedOutput = readPackageFile(
      packageDir,
      path.join("dist", "lib", "nested", "value.js")
    );

    expect(runtimeOutput).toContain(
      "export const greet = (name) => `hello ${name}`;"
    );
    expect(runtimeOutput).not.toContain(": string");
    expect(nestedOutput).toContain("export const value = 42;");
    expect(
      packageFileExists(packageDir, path.join("dist", "lib", "runtime.ts"))
    ).toBe(false);
  });

  test("preserves the root index.ts entrypoint in the output", () => {
    const packageDir = createPackageFixture("root-index");

    writeFile(
      path.join(packageDir, "src", "lib", "index.ts"),
      "export * from './nested/value.js';\n"
    );

    buildPrecompiledLib({
      packageDir,
      runtimeSourceDir: "src/lib",
      outputDir: "dist/lib",
    });

    expect(
      readPackageFile(packageDir, path.join("dist", "lib", "index.ts"))
    ).toBe("export * from './nested/value.js';\n");
  });

  test("copies declaration overlays into the output tree", () => {
    const packageDir = createPackageFixture("declaration-overlays");

    writeFile(
      path.join(packageDir, "src", "types", "runtime.d.ts"),
      "export declare const greet: (name: string) => string;\n"
    );
    writeFile(
      path.join(packageDir, "src", "types", "nested", "value.d.ts"),
      "export declare const value: number;\n"
    );

    buildPrecompiledLib({
      packageDir,
      runtimeSourceDir: "src/lib",
      declarationSourceDir: "src/types",
      outputDir: "dist/lib",
    });

    expect(
      readPackageFile(packageDir, path.join("dist", "lib", "runtime.d.ts"))
    ).toBe("export declare const greet: (name: string) => string;\n");
    expect(
      readPackageFile(
        packageDir,
        path.join("dist", "lib", "nested", "value.d.ts")
      )
    ).toBe("export declare const value: number;\n");
  });

  test("creates the output directory when runtime and declaration sources are missing", () => {
    const packageDir = createPackageFixture("empty-build");

    buildPrecompiledLib({
      packageDir,
      runtimeSourceDir: "src/lib",
      declarationSourceDir: "src/types",
      outputDir: "dist/lib",
    });

    expect(packageFileExists(packageDir, path.join("dist", "lib"))).toBe(true);
  });

  test("copies declaration overlays even when runtime sources are missing", () => {
    const packageDir = createPackageFixture("declaration-only");

    writeFile(
      path.join(packageDir, "src", "types", "runtime.d.ts"),
      "export declare const runtime: string;\n"
    );

    buildPrecompiledLib({
      packageDir,
      runtimeSourceDir: "src/lib",
      declarationSourceDir: "src/types",
      outputDir: "dist/lib",
    });

    expect(
      readPackageFile(packageDir, path.join("dist", "lib", "runtime.d.ts"))
    ).toBe("export declare const runtime: string;\n");
  });

  test("transpiles nested index files and only preserves the root index.ts", () => {
    const packageDir = createPackageFixture("nested-index");

    writeFile(
      path.join(packageDir, "src", "lib", "index.ts"),
      "export * from './nested/index.js';\n"
    );
    writeFile(
      path.join(packageDir, "src", "lib", "nested", "index.ts"),
      "export const nested: string = 'nested';\n"
    );

    buildPrecompiledLib({
      packageDir,
      runtimeSourceDir: "src/lib",
      outputDir: "dist/lib",
    });

    expect(
      readPackageFile(packageDir, path.join("dist", "lib", "index.ts"))
    ).toBe("export * from './nested/index.js';\n");
    expect(
      readPackageFile(
        packageDir,
        path.join("dist", "lib", "nested", "index.js")
      )
    ).toContain("export const nested = 'nested';");
    expect(
      packageFileExists(
        packageDir,
        path.join("dist", "lib", "nested", "index.ts")
      )
    ).toBe(false);
  });
});
