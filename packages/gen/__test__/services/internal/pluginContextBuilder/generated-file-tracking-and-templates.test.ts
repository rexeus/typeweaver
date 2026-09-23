import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import {
  aBuilder,
  aGeneratedProjectContext,
  aTempDir,
  expectUnsafeGeneratedFilePath,
  generatedProjectParams,
  removeTempDirs,
} from "./fixtures.js";

afterEach(removeTempDirs);

describe("createPluginContextBuilder absolute and traversal tracking rejection", () => {
  test("rejects absolute POSIX paths before tracking generated files", () => {
    const workspaceDir = aTempDir();
    const outputDir = path.join(workspaceDir, "generated");
    fs.mkdirSync(outputDir);
    const outsideFile = path.join(workspaceDir, "outside.ts");
    const generatorContext = aGeneratedProjectContext({ outputDir });

    const trackOutside = () => generatorContext.addGeneratedFile(outsideFile);

    expectUnsafeGeneratedFilePath(trackOutside);
    expect(generatorContext.getGeneratedFiles()).toEqual([]);
  });

  test.each([
    { scenario: "POSIX separators", generatedPath: "todo/../File.ts" },
    { scenario: "Windows separators", generatedPath: "todo\\..\\File.ts" },
  ])(
    "rejects $scenario traversal paths that normalize back inside before tracking generated files",
    ({ generatedPath }) => {
      const outputDir = aTempDir();
      const generatorContext = aGeneratedProjectContext({ outputDir });

      const trackNormalizedInsidePath = () =>
        generatorContext.addGeneratedFile(generatedPath);

      expectUnsafeGeneratedFilePath(trackNormalizedInsidePath);
      expect(generatorContext.getGeneratedFiles()).toEqual([]);
    }
  );

  test.each([
    { scenario: "POSIX trailing slash", generatedPath: "todo/" },
    { scenario: "Windows trailing slash", generatedPath: "todo\\" },
    {
      scenario: "POSIX final current-directory segment",
      generatedPath: "todo/.",
    },
    {
      scenario: "Windows final current-directory segment",
      generatedPath: "todo\\.",
    },
  ])(
    "rejects $scenario directory-like paths before tracking generated files",
    ({ generatedPath }) => {
      const outputDir = aTempDir();
      const generatorContext = aGeneratedProjectContext({ outputDir });

      const trackDirectoryLikePath = () =>
        generatorContext.addGeneratedFile(generatedPath);

      expectUnsafeGeneratedFilePath(trackDirectoryLikePath);
      expect(generatorContext.getGeneratedFiles()).toEqual([]);
    }
  );

  test.each([
    {
      scenario: "POSIX separators",
      pathFromOutputParent: (outputDirName: string) =>
        `../${outputDirName}/todo/File.ts`,
    },
    {
      scenario: "Windows separators",
      pathFromOutputParent: (outputDirName: string) =>
        `..\\${outputDirName}\\todo\\File.ts`,
    },
    {
      scenario: "mixed separators",
      pathFromOutputParent: (outputDirName: string) =>
        `../${outputDirName}\\todo/File.ts`,
    },
  ])(
    "rejects $scenario traversal paths that re-enter the output directory before tracking generated files",
    ({ pathFromOutputParent }) => {
      const workspaceDir = aTempDir();
      const outputDir = path.join(workspaceDir, "generated");
      fs.mkdirSync(outputDir);
      const generatorContext = aGeneratedProjectContext({ outputDir });

      const trackReenteredOutput = () =>
        generatorContext.addGeneratedFile(
          pathFromOutputParent(path.basename(outputDir))
        );

      expectUnsafeGeneratedFilePath(trackReenteredOutput);
      expect(generatorContext.getGeneratedFiles()).toEqual([]);
    }
  );
});

describe("createPluginContextBuilder normalized generated-file tracking", () => {
  test("normalizes current-directory segments before tracking generated files", () => {
    const outputDir = aTempDir();
    const generatorContext = aGeneratedProjectContext({ outputDir });

    generatorContext.addGeneratedFile("todo/./GetTodoClient.ts");

    expect(generatorContext.getGeneratedFiles()).toEqual([
      "todo/GetTodoClient.ts",
    ]);
  });

  test("normalizes Windows separators before tracking generated files", () => {
    const outputDir = aTempDir();
    const generatorContext = aGeneratedProjectContext({ outputDir });

    generatorContext.addGeneratedFile("todo\\GetTodoClient.ts");

    expect(generatorContext.getGeneratedFiles()).toEqual([
      "todo/GetTodoClient.ts",
    ]);
  });

  test.each([
    { scenario: "Windows traversal", generatedPath: "..\\outside.ts" },
    {
      scenario: "nested Windows traversal",
      generatedPath: "todo\\..\\..\\outside.ts",
    },
    { scenario: "Windows rooted", generatedPath: "\\tmp\\outside.ts" },
    {
      scenario: "UNC share",
      generatedPath: "\\\\server\\share\\outside.ts",
    },
    { scenario: "drive-relative", generatedPath: "C:tmp\\outside.ts" },
  ])(
    "rejects unsafe $scenario paths when tracking generated files",
    ({ generatedPath }) => {
      const workspaceDir = aTempDir();
      const outputDir = path.join(workspaceDir, "generated");
      fs.mkdirSync(outputDir);
      const generatorContext = aGeneratedProjectContext({ outputDir });

      const trackUnsafePath = () =>
        generatorContext.addGeneratedFile(generatedPath);

      expectUnsafeGeneratedFilePath(trackUnsafePath);
      expect(generatorContext.getGeneratedFiles()).toEqual([]);
    }
  );
});

describe("createPluginContextBuilder generated-file tracker semantics", () => {
  test("returns defensive arrays for generated file tracking", () => {
    const generatorContext = aGeneratedProjectContext();

    generatorContext.addGeneratedFile("todo/GetTodoClient.ts");
    const generatedFiles = generatorContext.getGeneratedFiles();

    generatedFiles.push("mutated.ts");

    expect(generatorContext.getGeneratedFiles()).toEqual([
      "todo/GetTodoClient.ts",
    ]);
  });

  test("returns generated file paths in stable alphabetical order regardless of write order", () => {
    const outputDir = aTempDir();
    const generatorContext = aGeneratedProjectContext({ outputDir });

    // Track in reverse alphabetical order to surface any insertion-order
    // dependency.
    generatorContext.addGeneratedFile("todo/Z.ts");
    generatorContext.addGeneratedFile("todo/M.ts");
    generatorContext.addGeneratedFile("todo/A.ts");

    expect(generatorContext.getGeneratedFiles()).toEqual([
      "todo/A.ts",
      "todo/M.ts",
      "todo/Z.ts",
    ]);
  });

  test("isolates the generated-file tracker across builder instances", () => {
    const firstBuilder = aBuilder();
    const secondBuilder = aBuilder();

    const firstContext = firstBuilder.createGeneratorContext(
      generatedProjectParams
    );
    const secondContext = secondBuilder.createGeneratorContext(
      generatedProjectParams
    );

    firstContext.addGeneratedFile("todo/GetTodoClient.ts");

    expect(firstBuilder.getGeneratedFiles()).toEqual(["todo/GetTodoClient.ts"]);
    expect(secondBuilder.getGeneratedFiles()).toEqual([]);
    expect(secondContext.getGeneratedFiles()).toEqual([]);
  });
});

describe("createPluginContextBuilder template rendering", () => {
  test("renders relative template paths from the configured template directory", () => {
    const templateDir = aTempDir();
    fs.writeFileSync(
      path.join(templateDir, "message.ejs"),
      "Hello <%= name %>!"
    );
    const generatorContext = aGeneratedProjectContext({ templateDir });

    const result = generatorContext.renderTemplate("message.ejs", {
      name: "Ada",
    });

    expect(result).toBe("Hello Ada!");
  });

  test("renders absolute template paths without prefixing the template directory", () => {
    const templateDir = aTempDir();
    const absoluteTemplatePath = path.join(aTempDir(), "absolute.ejs");
    fs.writeFileSync(path.join(templateDir, "absolute.ejs"), "wrong template");
    fs.writeFileSync(absoluteTemplatePath, "Absolute <%= name %>");
    const generatorContext = aGeneratedProjectContext({ templateDir });

    const result = generatorContext.renderTemplate(absoluteTemplatePath, {
      name: "template",
    });

    expect(result).toBe("Absolute template");
  });

  test.each([
    { scenario: "null data", data: null },
    { scenario: "undefined data", data: undefined },
  ])("renders static templates with $scenario as empty data", ({ data }) => {
    const templateDir = aTempDir();
    fs.writeFileSync(path.join(templateDir, "static.ejs"), "static output");
    const generatorContext = aGeneratedProjectContext({ templateDir });

    const result = generatorContext.renderTemplate("static.ejs", data);

    expect(result).toBe("static output");
  });
});
