import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";

const loadPluginsMock = vi.fn(async () => {});
const loadSpecMock = vi.fn(
  async ({
    inputFile,
    specOutputDir,
  }: {
    readonly inputFile: string;
    readonly specOutputDir: string;
  }) => ({
    normalizedSpec: {
      inputFile,
      specOutputDir,
    },
  })
);
const formatCodeMock = vi.fn(async () => {});
const generateIndexFilesMock = vi.fn();

vi.mock("@rexeus/typeweaver-gen", async importOriginal => {
  const actual =
    await importOriginal<typeof import("@rexeus/typeweaver-gen")>();

  return {
    ...actual,
    createPluginRegistry: () => ({
      getAll: () => [],
    }),
    createPluginContextBuilder: () => ({
      createPluginContext: () => ({}),
      createGeneratorContext: (context: Record<string, unknown>) => context,
      getGeneratedFiles: () => [],
    }),
  };
});

vi.mock("../src/generators/pluginLoader.js", () => ({
  loadPlugins: loadPluginsMock,
}));

vi.mock("../src/generators/specLoader.js", () => ({
  loadSpec: loadSpecMock,
}));

vi.mock("../src/generators/formatter.js", () => ({
  formatCode: formatCodeMock,
}));

vi.mock("../src/generators/indexFileGenerator.js", () => ({
  generateIndexFiles: generateIndexFilesMock,
}));

const { Generator } = await import("../src/generators/Generator.js");

describe("Generator.generate", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const tempDir of tempDirs) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }

    tempDirs.length = 0;
    vi.clearAllMocks();
  });

  const createTempDir = (): string => {
    const tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "typeweaver-generate-")
    );
    tempDirs.push(tempDir);

    return tempDir;
  };

  test("resolves generation paths from the provided working directory", async () => {
    const workingDirectory = createTempDir();
    const generator = new Generator();

    await generator.generate(
      "spec/index.ts",
      "generated/output",
      {
        input: "spec/index.ts",
        output: "generated/output",
        clean: false,
        format: false,
      },
      workingDirectory
    );

    expect(loadSpecMock).toHaveBeenCalledWith({
      inputFile: path.join(workingDirectory, "spec/index.ts"),
      specOutputDir: path.join(workingDirectory, "generated/output/spec"),
    });
    expect(fs.existsSync(path.join(workingDirectory, "generated/output"))).toBe(
      true
    );
  });

  test("uses the provided working directory for clean safety checks", async () => {
    const workspaceRoot = createTempDir();
    const packageDirectory = path.join(workspaceRoot, "packages", "cli");
    const generator = new Generator();

    fs.mkdirSync(path.join(workspaceRoot, ".git"), { recursive: true });
    fs.mkdirSync(packageDirectory, { recursive: true });

    await expect(
      generator.generate(
        "spec/index.ts",
        "../../",
        {
          input: "spec/index.ts",
          output: "../../",
          clean: true,
          format: false,
        },
        packageDirectory
      )
    ).rejects.toThrow(/inferred workspace root/);
  });
});
