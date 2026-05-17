import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Cause, Effect, Exit, Option } from "effect";
import { afterEach, describe, expect, test } from "vitest";
import { effectRuntime } from "../src/effectRuntime.js";
import { IndexFileGenerationError } from "../src/services/errors/IndexFileGenerationError.js";
import { IndexFileGenerator } from "../src/services/IndexFileGenerator.js";
import { generateIndexFiles } from "../src/services/internal/indexFileGeneration.js";

type WrittenFile = {
  readonly path: string;
  readonly content: string;
};

type FakeIndexContext = {
  readonly writes: WrittenFile[];
  readonly context: {
    readonly generatedFiles: readonly string[];
    readonly writeFile: (relativePath: string, content: string) => void;
    readonly renderTemplate: (data: unknown) => string;
  };
};

function aFakeIndexContextWith(
  generatedFiles: readonly string[]
): FakeIndexContext {
  const writes: WrittenFile[] = [];
  return {
    writes,
    context: {
      generatedFiles,
      writeFile: (relativePath, content) => {
        writes.push({ path: relativePath, content });
      },
      renderTemplate: data => {
        const indexPaths =
          ((data ?? {}) as { indexPaths?: readonly string[] }).indexPaths ?? [];
        return formatIndexFile(indexPaths);
      },
    },
  };
}

function formatIndexFile(indexPaths: readonly string[]): string {
  return indexPaths
    .map(indexPath => `export * from "${indexPath}";`)
    .join("\n");
}

function getWriteAt(
  fake: FakeIndexContext,
  relativePath: string
): WrittenFile | undefined {
  return fake.writes.find(entry => entry.path === relativePath);
}

describe("generateIndexFiles", () => {
  test("creates resource barrels and a root barrel for generated files", () => {
    const fake = aFakeIndexContextWith([
      "todo/GetTodoRequest.ts",
      "todo/GetTodoResponse.ts",
      "responses/TodoResponse.ts",
    ]);

    generateIndexFiles(fake.context);

    expect(getWriteAt(fake, "todo/index.ts")?.content).toBe(
      formatIndexFile(["./GetTodoRequest.js", "./GetTodoResponse.js"])
    );
    expect(getWriteAt(fake, "responses/index.ts")?.content).toBe(
      formatIndexFile(["./TodoResponse.js"])
    );
    expect(getWriteAt(fake, "index.ts")?.content).toBe(
      formatIndexFile(["./responses/index.js", "./todo/index.js"])
    );
  });

  test("keeps a generated group index file instead of overwriting it", () => {
    const fake = aFakeIndexContextWith([
      "todo/index.ts",
      "todo/GetTodoResponse.ts",
    ]);

    generateIndexFiles(fake.context);

    expect(getWriteAt(fake, "todo/index.ts")).toBeUndefined();
    expect(getWriteAt(fake, "index.ts")?.content).toBe(
      formatIndexFile(["./todo/index.js"])
    );
  });

  test("groups lib namespace files under their two-segment namespace", () => {
    const fake = aFakeIndexContextWith([
      "lib/clients/BaseClient.ts",
      "lib/types/Shared.ts",
    ]);

    generateIndexFiles(fake.context);

    expect(getWriteAt(fake, "lib/clients/index.ts")?.content).toBe(
      formatIndexFile(["./BaseClient.js"])
    );
    expect(getWriteAt(fake, "lib/types/index.ts")?.content).toBe(
      formatIndexFile(["./Shared.js"])
    );
    expect(getWriteAt(fake, "lib/index.ts")).toBeUndefined();
    expect(getWriteAt(fake, "index.ts")?.content).toBe(
      formatIndexFile(["./lib/clients/index.js", "./lib/types/index.js"])
    );
  });

  test("keeps a generated lib barrel and generates sibling namespace barrels", () => {
    const fake = aFakeIndexContextWith([
      "lib/index.ts",
      "lib/clients/BaseClient.ts",
    ]);

    generateIndexFiles(fake.context);

    expect(getWriteAt(fake, "lib/index.ts")).toBeUndefined();
    expect(getWriteAt(fake, "lib/clients/index.ts")?.content).toBe(
      formatIndexFile(["./BaseClient.js"])
    );
    expect(getWriteAt(fake, "index.ts")?.content).toBe(
      formatIndexFile(["./lib/clients/index.js", "./lib/index.js"])
    );
  });

  test("keeps a generated lib namespace index file instead of overwriting it", () => {
    const fake = aFakeIndexContextWith([
      "lib/clients/index.ts",
      "lib/clients/BaseClient.ts",
    ]);

    generateIndexFiles(fake.context);

    expect(getWriteAt(fake, "lib/clients/index.ts")).toBeUndefined();
    expect(getWriteAt(fake, "index.ts")?.content).toBe(
      formatIndexFile(["./lib/clients/index.js"])
    );
  });

  test("includes root-level generated files in the root barrel", () => {
    const fake = aFakeIndexContextWith([
      "rootClient.ts",
      "todo/GetTodoResponse.ts",
    ]);

    generateIndexFiles(fake.context);

    expect(getWriteAt(fake, "index.ts")?.content).toBe(
      formatIndexFile(["./rootClient.js", "./todo/index.js"])
    );
  });

  test("normalizes Windows-style generated paths to POSIX export specifiers", () => {
    const fake = aFakeIndexContextWith([
      "rootClient.ts",
      "todo\\GetTodoRequest.ts",
      "lib\\clients\\BaseClient.ts",
    ]);

    generateIndexFiles(fake.context);

    expect(getWriteAt(fake, "todo/index.ts")?.content).toBe(
      formatIndexFile(["./GetTodoRequest.js"])
    );
    expect(getWriteAt(fake, "lib/clients/index.ts")?.content).toBe(
      formatIndexFile(["./BaseClient.js"])
    );
    expect(getWriteAt(fake, "index.ts")?.content).toBe(
      formatIndexFile([
        "./lib/clients/index.js",
        "./rootClient.js",
        "./todo/index.js",
      ])
    );
  });

  test("deduplicates repeated generated files in barrels", () => {
    const fake = aFakeIndexContextWith([
      "todo/GetTodoResponse.ts",
      "todo/GetTodoResponse.ts",
      "rootClient.ts",
      "rootClient.ts",
    ]);

    generateIndexFiles(fake.context);

    expect(getWriteAt(fake, "todo/index.ts")?.content).toBe(
      formatIndexFile(["./GetTodoResponse.js"])
    );
    expect(getWriteAt(fake, "index.ts")?.content).toBe(
      formatIndexFile(["./rootClient.js", "./todo/index.js"])
    );
  });

  test("does not export the root barrel from itself", () => {
    const fake = aFakeIndexContextWith(["index.ts", "todo/GetTodoResponse.ts"]);

    generateIndexFiles(fake.context);

    expect(getWriteAt(fake, "index.ts")?.content).toBe(
      formatIndexFile(["./todo/index.js"])
    );
  });

  test("ignores generated JSON files when building TypeScript barrels", () => {
    const fake = aFakeIndexContextWith([
      "openapi/openapi.json",
      "todo/GetTodoResponse.ts",
    ]);

    generateIndexFiles(fake.context);

    expect(getWriteAt(fake, "openapi/index.ts")).toBeUndefined();
    expect(getWriteAt(fake, "todo/index.ts")?.content).toBe(
      formatIndexFile(["./GetTodoResponse.js"])
    );
    expect(getWriteAt(fake, "index.ts")?.content).toBe(
      formatIndexFile(["./todo/index.js"])
    );
  });

  test("writes an empty root barrel when only generated JSON files exist", () => {
    const fake = aFakeIndexContextWith(["openapi/openapi.json"]);

    generateIndexFiles(fake.context);

    expect(getWriteAt(fake, "openapi/index.ts")).toBeUndefined();
    expect(getWriteAt(fake, "index.ts")?.content).toBe(formatIndexFile([]));
  });

  test("writes an empty root barrel when no files were generated", () => {
    const fake = aFakeIndexContextWith([]);

    generateIndexFiles(fake.context);

    expect(fake.writes).toEqual([
      { path: "index.ts", content: formatIndexFile([]) },
    ]);
  });
});

describe("IndexFileGenerator service", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const tempDir of tempDirs) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    tempDirs.length = 0;
  });

  const createTempDir = (): string => {
    const tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "typeweaver-index-gen-")
    );
    tempDirs.push(tempDir);
    return tempDir;
  };

  test("fails with IndexFileGenerationError when the Index.ejs template is missing", async () => {
    const emptyTemplateDir = createTempDir();
    const outputDir = createTempDir();

    const exit = await effectRuntime.runPromiseExit(
      IndexFileGenerator.generate({
        templateDir: emptyTemplateDir,
        outputDir,
        generatedFiles: ["todo/GetTodoResponse.ts"],
        writeFile: () => undefined,
      })
    );

    expect(Exit.isFailure(exit)).toBe(true);
    if (!Exit.isFailure(exit)) return;
    const failure = Cause.failureOption(exit.cause);
    expect(Option.isSome(failure)).toBe(true);
    if (!Option.isSome(failure)) return;

    expect(failure.value).toBeInstanceOf(IndexFileGenerationError);
    const error = failure.value as IndexFileGenerationError;
    expect(error.outputDir).toBe(outputDir);
    const cause = error.cause as { readonly code?: string } | undefined;
    expect(cause?.code).toBe("ENOENT");
  });
});
