import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";
import { createLogger } from "../src/logger.js";
import { createTempDirFactory } from "./__helpers__/tempDir.js";

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
      resources: [],
      responses: [],
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
      clearGeneratedFiles: () => {},
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

const { Generator } = await import("../src/generators/generator.js");

describe("Generator.generate", () => {
  const createTempDir = createTempDirFactory("typeweaver-generate-");

  afterEach(() => {
    vi.clearAllMocks();
  });

  test("resolves generation paths from the provided working directory", async () => {
    const workingDirectory = createTempDir();
    const generator = new Generator({
      logger: createLogger({ quiet: true }),
    });

    const summary = await generator.generate(
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
    expect(summary.targetOutputDir).toBe(
      path.join(workingDirectory, "generated/output")
    );
    expect(fs.existsSync(path.join(workingDirectory, "generated/output"))).toBe(
      true
    );
  });

  test("uses the provided working directory for clean safety checks", async () => {
    const workspaceRoot = createTempDir();
    const packageDirectory = path.join(workspaceRoot, "packages", "cli");
    const generator = new Generator({
      logger: createLogger({ quiet: true }),
    });

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

  test("supports dry-run generation without mutating the output directory", async () => {
    const workingDirectory = createTempDir();
    const outputDirectory = path.join(workingDirectory, "generated/output");
    const existingFile = path.join(outputDirectory, "keep.txt");
    const generator = new Generator({
      logger: createLogger({ quiet: true }),
    });

    fs.mkdirSync(outputDirectory, { recursive: true });
    fs.writeFileSync(existingFile, "keep");

    const summary = await generator.generate(
      "spec/index.ts",
      "generated/output",
      {
        input: "spec/index.ts",
        output: "generated/output",
        clean: true,
        format: false,
        dryRun: true,
      },
      workingDirectory
    );

    expect(fs.readFileSync(existingFile, "utf8")).toBe("keep");
    expect(summary.dryRun).toBe(true);
    expect(summary.targetOutputDir).toBe(outputDirectory);
    expect(generateIndexFilesMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ pluginName: "typeweaver" })
    );
    expect(loadSpecMock.mock.calls[0]?.[0].specOutputDir).not.toBe(
      path.join(workingDirectory, "generated/output/spec")
    );
    expect(loadSpecMock.mock.calls[0]?.[0].specOutputDir).toEqual(
      expect.stringMatching(
        new RegExp(
          `^${os.tmpdir().replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}/typeweaver-generate-.*?/spec$`
        )
      )
    );
  });
});
