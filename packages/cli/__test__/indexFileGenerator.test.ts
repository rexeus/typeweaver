import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { GeneratorContext } from "@rexeus/typeweaver-gen";
import { afterEach, describe, expect, test } from "vitest";
import { generateIndexFiles } from "../src/generators/indexFileGenerator.js";

function createContext(
  outputDir: string,
  generatedFiles: string[]
): GeneratorContext {
  return {
    pluginName: "types",
    outputDir,
    inputDir: "/input",
    config: {},
    normalizedSpec: {
      resources: [],
      responses: [],
    },
    coreDir: "@rexeus/typeweaver-core",
    responsesOutputDir: path.join(outputDir, "responses"),
    specOutputDir: path.join(outputDir, "spec"),
    getCanonicalResponse: () => {
      throw new Error("not implemented");
    },
    getCanonicalResponseOutputFile: () => {
      throw new Error("not implemented");
    },
    getCanonicalResponseImportPath: () => {
      throw new Error("not implemented");
    },
    getSpecImportPath: () => {
      throw new Error("not implemented");
    },
    getOperationDefinitionAccessor: () => {
      throw new Error("not implemented");
    },
    getOperationOutputPaths: () => {
      throw new Error("not implemented");
    },
    getOperationImportPaths: () => {
      throw new Error("not implemented");
    },
    getResourceOutputDir: () => {
      throw new Error("not implemented");
    },
    getPluginOutputDir: () => {
      throw new Error("not implemented");
    },
    getPluginResourceOutputDir: () => {
      throw new Error("not implemented");
    },
    getLibImportPath: () => {
      throw new Error("not implemented");
    },
    writeFile: (relativePath: string, content: string) => {
      const filePath = path.join(outputDir, relativePath);

      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, content);
    },
    renderTemplate: () => {
      throw new Error("not implemented");
    },
    addGeneratedFile: () => {},
    getGeneratedFiles: () => generatedFiles,
  };
}

describe("indexFileGenerator", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const tempDir of tempDirs) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }

    tempDirs.length = 0;
  });

  function createTempDir(): string {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "typeweaver-index-"));
    tempDirs.push(tempDir);

    return tempDir;
  }

  test("creates nested barrel files and respects existing index files", () => {
    const outputDir = createTempDir();
    const templateDir = createTempDir();
    const templatePath = path.join(templateDir, "Index.ejs");

    fs.writeFileSync(
      templatePath,
      '<% for (const indexPath of indexPaths) { %>export * from "<%= indexPath %>";\n<% } %>'
    );

    generateIndexFiles(
      templateDir,
      createContext(outputDir, [
        "types/todo/GetTodoRequest.ts",
        "types/todo/GetTodoResponse.ts",
        "clients/todo/TodoClient.ts",
        "responses/TodoResponse.ts",
        "lib/clients/BaseClient.ts",
        "lib/types/index.ts",
      ])
    );

    expect(
      fs.readFileSync(path.join(outputDir, "types", "todo", "index.ts"), "utf8")
    ).toContain('export * from "./GetTodoRequest.js";');
    expect(
      fs.readFileSync(path.join(outputDir, "types", "todo", "index.ts"), "utf8")
    ).toContain('export * from "./GetTodoResponse.js";');
    expect(
      fs.readFileSync(path.join(outputDir, "clients", "todo", "index.ts"), "utf8")
    ).toContain('export * from "./TodoClient.js";');
    expect(
      fs.readFileSync(path.join(outputDir, "responses", "index.ts"), "utf8")
    ).toContain('export * from "./TodoResponse.js";');
    expect(
      fs.readFileSync(path.join(outputDir, "types", "index.ts"), "utf8")
    ).toContain('export * from "./todo/index.js";');
    expect(
      fs.existsSync(path.join(outputDir, "lib", "types", "index.ts"))
    ).toBe(false);
    expect(fs.existsSync(path.join(outputDir, "lib", "index.ts"))).toBe(true);

    const rootIndex = fs.readFileSync(path.join(outputDir, "index.ts"), "utf8");
    expect(rootIndex).toContain('export * from "./clients/index.js";');
    expect(rootIndex).toContain('export * from "./lib/index.js";');
    expect(rootIndex).toContain('export * from "./responses/index.js";');
    expect(rootIndex).toContain('export * from "./types/index.js";');
  });

  test("normalizes Windows-style generated file paths in barrel exports", () => {
    const outputDir = createTempDir();
    const templateDir = createTempDir();
    const templatePath = path.join(templateDir, "Index.ejs");

    fs.writeFileSync(
      templatePath,
      '<% for (const indexPath of indexPaths) { %>export * from "<%= indexPath %>";\n<% } %>'
    );

    generateIndexFiles(
      templateDir,
      createContext(outputDir, [
        "types\\todo\\GetTodoRequest.ts",
        "types\\todo\\GetTodoResponse.ts",
        "lib\\clients\\BaseClient.ts",
      ])
    );

    const todoIndex = fs.readFileSync(
      path.join(outputDir, "types", "todo", "index.ts"),
      "utf8"
    );
    const rootIndex = fs.readFileSync(path.join(outputDir, "index.ts"), "utf8");

    expect(todoIndex).toContain('export * from "./GetTodoRequest.js";');
    expect(todoIndex).toContain('export * from "./GetTodoResponse.js";');
    expect(todoIndex).not.toContain("\\");

    expect(rootIndex).toContain('export * from "./lib/index.js";');
    expect(rootIndex).toContain('export * from "./types/index.js";');
    expect(rootIndex).not.toContain("\\");
  });
});
