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
      "nested/value.ts",
    ]);
  });
});

describe("buildPrecompiledLib", () => {
  test("transpiles runtime files, preserves index.ts, and copies declaration overlays", () => {
    const packageDir = createPackageFixture("build");

    writeFile(
      path.join(packageDir, "src", "lib", "index.ts"),
      "export * from './nested/value.js';\n"
    );
    writeFile(
      path.join(packageDir, "src", "lib", "runtime.ts"),
      "export const greet = (name: string): string => `hello ${name}`;\n"
    );
    writeFile(
      path.join(packageDir, "src", "lib", "nested", "value.ts"),
      "export const value: number = 42;\n"
    );
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
      fs.readFileSync(path.join(packageDir, "dist", "lib", "index.ts"), "utf8")
    ).toBe("export * from './nested/value.js';\n");

    const runtimeOutput = fs.readFileSync(
      path.join(packageDir, "dist", "lib", "runtime.js"),
      "utf8"
    );
    const nestedOutput = fs.readFileSync(
      path.join(packageDir, "dist", "lib", "nested", "value.js"),
      "utf8"
    );

    expect(runtimeOutput).toContain(
      "export const greet = (name) => `hello ${name}`;"
    );
    expect(runtimeOutput).not.toContain(": string");
    expect(nestedOutput).toContain("export const value = 42;");
    expect(
      fs.existsSync(path.join(packageDir, "dist", "lib", "runtime.ts"))
    ).toBe(false);
    expect(
      fs.readFileSync(
        path.join(packageDir, "dist", "lib", "runtime.d.ts"),
        "utf8"
      )
    ).toBe("export declare const greet: (name: string) => string;\n");
    expect(
      fs.readFileSync(
        path.join(packageDir, "dist", "lib", "nested", "value.d.ts"),
        "utf8"
      )
    ).toBe("export declare const value: number;\n");
  });
});
