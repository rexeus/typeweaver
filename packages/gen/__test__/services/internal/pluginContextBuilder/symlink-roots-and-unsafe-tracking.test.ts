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

const outputDirWithInternalSymlink = (): {
  readonly outputDir: string;
  readonly targetDir: string;
} => {
  const outputDir = aTempDir();
  const targetDir = path.join(outputDir, "target");
  const linkedDir = path.join(outputDir, "linked");
  fs.mkdirSync(targetDir);
  fs.symlinkSync(targetDir, linkedDir, "dir");

  return { outputDir, targetDir };
};

afterEach(removeTempDirs);

describe("createPluginContextBuilder symlink root rejection", () => {
  test.skipIf(!symlinkCapability.supported)(
    `rejects safe internal directory symlinks before writing inside the output directory${symlinkSkipReason}`,
    () => {
      const { outputDir, targetDir } = outputDirWithInternalSymlink();
      const generatorContext = aGeneratedProjectContext({ outputDir });
      const targetFile = path.join(targetDir, "GetTodoClient.ts");

      const writeThroughInternalSymlink = () =>
        generatorContext.writeFile(
          "linked/GetTodoClient.ts",
          "export const client = true;\n"
        );

      expectUnsafeGeneratedFilePath(writeThroughInternalSymlink);
      expect(fs.existsSync(targetFile)).toBe(false);
      expect(generatorContext.getGeneratedFiles()).toEqual([]);
    }
  );

  test.skipIf(!symlinkCapability.supported)(
    `rejects existing output-root symlinks before writing generated files${symlinkSkipReason}`,
    () => {
      const workspaceDir = aTempDir();
      const targetOutputDir = path.join(workspaceDir, "target-generated");
      const outputDir = path.join(workspaceDir, "generated");
      const targetFile = path.join(targetOutputDir, "todo", "GetTodoClient.ts");
      fs.mkdirSync(targetOutputDir);
      fs.symlinkSync(targetOutputDir, outputDir, "dir");

      const generatorContext = aGeneratedProjectContext({ outputDir });

      const writeThroughOutputRootSymlink = () =>
        generatorContext.writeFile(
          path.join("todo", "GetTodoClient.ts"),
          "export const client = true;\n"
        );

      expectUnsafeGeneratedFilePath(writeThroughOutputRootSymlink);
      expect(fs.existsSync(targetFile)).toBe(false);
      expect(generatorContext.getGeneratedFiles()).toEqual([]);
    }
  );

  test.skipIf(!symlinkCapability.supported)(
    `rejects safe internal symlink paths before tracking generated files${symlinkSkipReason}`,
    () => {
      const { outputDir } = outputDirWithInternalSymlink();
      const generatorContext = aGeneratedProjectContext({ outputDir });

      const trackInternalSymlinkPath = () =>
        generatorContext.addGeneratedFile("linked/GetTodoClient.ts");

      expectUnsafeGeneratedFilePath(trackInternalSymlinkPath);
      expect(generatorContext.getGeneratedFiles()).toEqual([]);
    }
  );

  test.skipIf(!symlinkCapability.supported)(
    `rejects existing output-root symlinks before tracking generated files${symlinkSkipReason}`,
    () => {
      const workspaceDir = aTempDir();
      const targetOutputDir = path.join(workspaceDir, "target-generated");
      const outputDir = path.join(workspaceDir, "generated");
      fs.mkdirSync(targetOutputDir);
      fs.symlinkSync(targetOutputDir, outputDir, "dir");

      const generatorContext = aGeneratedProjectContext({ outputDir });

      const trackOutputRootSymlinkPath = () =>
        generatorContext.addGeneratedFile(
          path.join("todo", "GetTodoClient.ts")
        );

      expectUnsafeGeneratedFilePath(trackOutputRootSymlinkPath);
      expect(generatorContext.getGeneratedFiles()).toEqual([]);
    }
  );
});

describe("createPluginContextBuilder unsafe generated-file tracking", () => {
  test("rejects unsafe generated file tracking paths", () => {
    const outputDir = aTempDir();
    const generatorContext = aGeneratedProjectContext({ outputDir });

    const trackUnsafePath = () =>
      generatorContext.addGeneratedFile("../outside.ts");

    expectUnsafeGeneratedFilePath(trackUnsafePath);
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
  ])(
    "rejects $scenario generated file paths before tracking",
    ({ generatedPath }) => {
      const outputDir = aTempDir();
      const generatorContext = aGeneratedProjectContext({ outputDir });

      const trackOutputRoot = () =>
        generatorContext.addGeneratedFile(generatedPath);

      expectUnsafeGeneratedFilePath(trackOutputRoot);
      expect(generatorContext.getGeneratedFiles()).toEqual([]);
    }
  );
});
