import fs from "node:fs";
import path from "node:path";
import type { GeneratorContext } from "@rexeus/typeweaver-gen";
import { beforeEach, describe, expect, test } from "vitest";
import { generateIndexFiles } from "../src/generators/indexFileGenerator.js";
import { createTempDirFactory } from "./__helpers__/tempDir.js";

const BARREL_TEMPLATE = `<% for (const indexPath of indexPaths) { %>export * from "<%= indexPath %>";
<% } %>`;

/**
 * Creates a GeneratorContext whose actually-used fields are populated and
 * whose unused fields throw a descriptive error on access. Any future
 * `indexFileGenerator` change that starts touching a new context member
 * will get a clear "stub missing" error instead of a silent undefined.
 */
const createStubContext = (
  outputDir: string,
  generatedFiles: readonly string[]
): GeneratorContext => {
  const stubs = {
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
    writeFile: (relativePath: string, content: string) => {
      const filePath = path.join(outputDir, relativePath);
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, content);
    },
    addGeneratedFile: () => {},
    getGeneratedFiles: () => [...generatedFiles],
  };

  return new Proxy(stubs, {
    get(target, property) {
      if (property in target) {
        return target[property as keyof typeof target];
      }
      if (typeof property === "symbol") {
        return undefined;
      }
      throw new Error(
        `GeneratorContext.${property} is not stubbed for indexFileGenerator tests. Add it to createStubContext if the code under test now requires it.`
      );
    },
  }) as unknown as GeneratorContext;
};

const readIndex = (outputDir: string, ...segments: string[]): string => {
  return fs.readFileSync(path.join(outputDir, ...segments, "index.ts"), "utf8");
};

describe("generateIndexFiles", () => {
  const createTempDir = createTempDirFactory("typeweaver-index-");

  let outputDir: string;
  let templateDir: string;

  beforeEach(() => {
    outputDir = createTempDir();
    templateDir = createTempDir();
    fs.writeFileSync(path.join(templateDir, "Index.ejs"), BARREL_TEMPLATE);
  });

  test("creates resource-level barrels that re-export each sibling file", () => {
    generateIndexFiles(
      templateDir,
      createStubContext(outputDir, [
        "types/todo/GetTodoRequest.ts",
        "types/todo/GetTodoResponse.ts",
        "clients/todo/TodoClient.ts",
      ])
    );

    const typesTodoIndex = readIndex(outputDir, "types", "todo");
    expect(typesTodoIndex).toContain('export * from "./GetTodoRequest.js";');
    expect(typesTodoIndex).toContain('export * from "./GetTodoResponse.js";');

    const clientsTodoIndex = readIndex(outputDir, "clients", "todo");
    expect(clientsTodoIndex).toContain('export * from "./TodoClient.js";');
  });

  test("creates plugin-level barrels that link resource barrels", () => {
    generateIndexFiles(
      templateDir,
      createStubContext(outputDir, [
        "types/todo/GetTodoRequest.ts",
        "responses/TodoResponse.ts",
      ])
    );

    expect(readIndex(outputDir, "types")).toContain(
      'export * from "./todo/index.js";'
    );
    expect(readIndex(outputDir, "responses")).toContain(
      'export * from "./TodoResponse.js";'
    );
  });

  test("preserves a pre-existing lib/index.ts instead of overwriting it", () => {
    generateIndexFiles(
      templateDir,
      createStubContext(outputDir, [
        "lib/clients/BaseClient.ts",
        "lib/types/index.ts",
      ])
    );

    // A generated file ending in `/index.ts` is treated as authoritative —
    // the generator must not produce a shadowing barrel next to it.
    expect(
      fs.existsSync(path.join(outputDir, "lib", "types", "index.ts"))
    ).toBe(false);
    expect(fs.existsSync(path.join(outputDir, "lib", "index.ts"))).toBe(true);
  });

  test("creates a root barrel that re-exports every top-level directory", () => {
    generateIndexFiles(
      templateDir,
      createStubContext(outputDir, [
        "types/todo/GetTodoRequest.ts",
        "clients/todo/TodoClient.ts",
        "responses/TodoResponse.ts",
        "lib/clients/BaseClient.ts",
      ])
    );

    const rootIndex = readIndex(outputDir);
    expect(rootIndex).toContain('export * from "./clients/index.js";');
    expect(rootIndex).toContain('export * from "./lib/index.js";');
    expect(rootIndex).toContain('export * from "./responses/index.js";');
    expect(rootIndex).toContain('export * from "./types/index.js";');
  });

  test("normalizes Windows-style backslashes to forward slashes", () => {
    generateIndexFiles(
      templateDir,
      createStubContext(outputDir, [
        "types\\todo\\GetTodoRequest.ts",
        "types\\todo\\GetTodoResponse.ts",
        "lib\\clients\\BaseClient.ts",
      ])
    );

    const todoIndex = readIndex(outputDir, "types", "todo");
    expect(todoIndex).toContain('export * from "./GetTodoRequest.js";');
    expect(todoIndex).toContain('export * from "./GetTodoResponse.js";');
    expect(todoIndex).not.toContain("\\");

    const rootIndex = readIndex(outputDir);
    expect(rootIndex).toContain('export * from "./lib/index.js";');
    expect(rootIndex).toContain('export * from "./types/index.js";');
    expect(rootIndex).not.toContain("\\");
  });
});
