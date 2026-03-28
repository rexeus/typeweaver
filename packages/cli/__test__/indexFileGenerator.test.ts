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
    outputDir,
    inputDir: "/input",
    config: {},
    normalizedSpec: {
      resources: [],
      responses: [],
    },
    templateDir: "/templates",
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
    getResourceOutputDir: () => {
      throw new Error("not implemented");
    },
    writeFile: () => {
      throw new Error("not implemented");
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
        "todo/GetTodoRequest.ts",
        "todo/GetTodoResponse.ts",
        "responses/TodoResponse.ts",
        "lib/clients/BaseClient.ts",
        "lib/types/index.ts",
      ])
    );

    expect(
      fs.readFileSync(path.join(outputDir, "todo", "index.ts"), "utf8")
    ).toContain('export * from "./GetTodoRequest";');
    expect(
      fs.readFileSync(path.join(outputDir, "todo", "index.ts"), "utf8")
    ).toContain('export * from "./GetTodoResponse";');
    expect(
      fs.readFileSync(path.join(outputDir, "responses", "index.ts"), "utf8")
    ).toContain('export * from "./TodoResponse";');
    expect(
      fs.existsSync(path.join(outputDir, "lib", "types", "index.ts"))
    ).toBe(false);

    const rootIndex = fs.readFileSync(path.join(outputDir, "index.ts"), "utf8");
    expect(rootIndex).toContain('export * from "./lib/clients";');
    expect(rootIndex).toContain('export * from "./lib/types";');
    expect(rootIndex).toContain('export * from "./responses";');
    expect(rootIndex).toContain('export * from "./todo";');
  });
});
