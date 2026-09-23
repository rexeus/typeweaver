import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import {
  aGeneratedProjectContext,
  aTempDir,
  expectUnsafeGeneratedFilePath,
  removeTempDirs,
} from "./fixtures.js";
import { symlinkCapability, symlinkSkipReason } from "./symlinkCapability.js";

afterEach(removeTempDirs);

describe("createPluginContextBuilder absolute write rejection", () => {
  test("rejects absolute POSIX paths before writing outside the output directory", () => {
    const workspaceDir = aTempDir();
    const outputDir = path.join(workspaceDir, "generated");
    fs.mkdirSync(outputDir);
    const outsideFile = path.join(workspaceDir, "outside.ts");
    const generatorContext = aGeneratedProjectContext({ outputDir });

    const writeOutside = () =>
      generatorContext.writeFile(outsideFile, "export const outside = true;\n");

    expectUnsafeGeneratedFilePath(writeOutside);
    expect(fs.existsSync(outsideFile)).toBe(false);
    expect(generatorContext.getGeneratedFiles()).toEqual([]);
  });

  test.each([
    { scenario: "drive absolute", generatedPath: "C:\\tmp\\outside.ts" },
    { scenario: "drive relative", generatedPath: "C:tmp\\outside.ts" },
    { scenario: "rooted", generatedPath: "\\tmp\\outside.ts" },
    {
      scenario: "UNC share",
      generatedPath: "\\\\server\\share\\outside.ts",
    },
  ])("rejects Windows-style $scenario paths", ({ generatedPath }) => {
    const outputDir = aTempDir();
    const generatorContext = aGeneratedProjectContext({ outputDir });

    const writeOutside = () =>
      generatorContext.writeFile(
        generatedPath,
        "export const outside = true;\n"
      );

    expectUnsafeGeneratedFilePath(writeOutside);
    expect(generatorContext.getGeneratedFiles()).toEqual([]);
  });

  test.each([
    { scenario: "empty", generatedPath: "" },
    { scenario: "current-directory", generatedPath: "." },
    { scenario: "current-directory segment", generatedPath: "./" },
    {
      scenario: "directory that normalizes to current",
      generatedPath: "todo/..",
    },
  ])("rejects $scenario generated file paths", ({ generatedPath }) => {
    const outputDir = aTempDir();
    const generatorContext = aGeneratedProjectContext({ outputDir });

    const writeOutputRoot = () =>
      generatorContext.writeFile(
        generatedPath,
        "export const invalid = true;\n"
      );

    expectUnsafeGeneratedFilePath(writeOutputRoot);
    expect(generatorContext.getGeneratedFiles()).toEqual([]);
  });
});

describe("createPluginContextBuilder normalized traversal write rejection", () => {
  test("rejects traversal paths that normalize outside the output directory", () => {
    const workspaceDir = aTempDir();
    const outputDir = path.join(workspaceDir, "generated");
    fs.mkdirSync(outputDir);
    const outsideFile = path.join(workspaceDir, "outside.ts");
    const generatorContext = aGeneratedProjectContext({ outputDir });

    const writeOutside = () =>
      generatorContext.writeFile(
        "todo/../../outside.ts",
        "export const outside = true;\n"
      );

    expectUnsafeGeneratedFilePath(writeOutside);
    expect(fs.existsSync(outsideFile)).toBe(false);
    expect(generatorContext.getGeneratedFiles()).toEqual([]);
  });

  test.each([
    {
      scenario: "single Windows parent segment",
      generatedPath: "..\\outside.ts",
    },
    {
      scenario: "nested mixed separators",
      generatedPath: "todo\\..\\..\\outside.ts",
    },
  ])("rejects $scenario traversal paths", ({ generatedPath }) => {
    const workspaceDir = aTempDir();
    const outputDir = path.join(workspaceDir, "generated");
    fs.mkdirSync(outputDir);
    const outsideFile = path.join(workspaceDir, "outside.ts");
    const generatorContext = aGeneratedProjectContext({ outputDir });

    const writeOutside = () =>
      generatorContext.writeFile(
        generatedPath,
        "export const outside = true;\n"
      );

    expectUnsafeGeneratedFilePath(writeOutside);
    expect(fs.existsSync(outsideFile)).toBe(false);
    expect(generatorContext.getGeneratedFiles()).toEqual([]);
  });
});

describe("createPluginContextBuilder symlink component rejection", () => {
  test.skipIf(!symlinkCapability.supported)(
    `rejects symlink directory components before writing outside the output directory${symlinkSkipReason}`,
    () => {
      const workspaceDir = aTempDir();
      const outputDir = path.join(workspaceDir, "generated");
      const externalDir = path.join(workspaceDir, "external");
      const symlinkDir = path.join(outputDir, "linked");
      const externalFile = path.join(externalDir, "outside.ts");
      fs.mkdirSync(outputDir);
      fs.mkdirSync(externalDir);
      fs.symlinkSync(externalDir, symlinkDir, "dir");

      const generatorContext = aGeneratedProjectContext({ outputDir });

      const writeOutside = () =>
        generatorContext.writeFile(
          "linked/outside.ts",
          "export const outside = true;\n"
        );

      expectUnsafeGeneratedFilePath(writeOutside);
      expect(fs.existsSync(externalFile)).toBe(false);
      expect(generatorContext.getGeneratedFiles()).toEqual([]);
    }
  );

  test.skipIf(!symlinkCapability.supported)(
    `rejects dangling final-path symlinks before writing outside the output directory${symlinkSkipReason}`,
    () => {
      const workspaceDir = aTempDir();
      const outputDir = path.join(workspaceDir, "generated");
      const outsideFile = path.join(workspaceDir, "missing", "outside.ts");
      fs.mkdirSync(outputDir);
      fs.symlinkSync(outsideFile, path.join(outputDir, "outside.ts"), "file");

      const generatorContext = aGeneratedProjectContext({ outputDir });

      const writeOutside = () =>
        generatorContext.writeFile(
          "outside.ts",
          "export const outside = true;\n"
        );

      expectUnsafeGeneratedFilePath(writeOutside);
      expect(fs.existsSync(outsideFile)).toBe(false);
      expect(generatorContext.getGeneratedFiles()).toEqual([]);
    }
  );

  test.skipIf(!symlinkCapability.supported)(
    `rejects final-path file symlinks before truncating outside files${symlinkSkipReason}`,
    () => {
      const workspaceDir = aTempDir();
      const outputDir = path.join(workspaceDir, "generated");
      const externalDir = path.join(workspaceDir, "external");
      const externalFile = path.join(externalDir, "outside.ts");
      fs.mkdirSync(outputDir);
      fs.mkdirSync(externalDir);
      fs.writeFileSync(externalFile, "export const outside = false;\n");
      fs.symlinkSync(externalFile, path.join(outputDir, "outside.ts"), "file");

      const generatorContext = aGeneratedProjectContext({ outputDir });

      const writeOutside = () =>
        generatorContext.writeFile(
          "outside.ts",
          "export const outside = true;\n"
        );

      expectUnsafeGeneratedFilePath(writeOutside);
      expect(fs.readFileSync(externalFile, "utf8")).toBe(
        "export const outside = false;\n"
      );
      expect(generatorContext.getGeneratedFiles()).toEqual([]);
    }
  );
});
