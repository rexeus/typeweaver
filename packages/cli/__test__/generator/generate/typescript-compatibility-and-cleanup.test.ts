import { execFile } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { promisify } from "node:util";
import type { TypeweaverConfig } from "@rexeus/typeweaver-gen";
import { afterEach, describe, expect, test } from "vitest";
import { effectRuntime } from "../../../src/effectRuntime.js";
import { Generator } from "../../../src/services/Generator.js";

const runGenerator = async (params: {
  readonly inputFile: string;
  readonly outputDir: string;
  readonly config?: TypeweaverConfig;
  readonly currentWorkingDirectory: string;
}): Promise<void> => {
  await effectRuntime.runPromise(Generator.generate(params));
};

const require = createRequire(import.meta.url);

const execFileAsync = promisify(execFile);

const tempDirs: string[] = [];

afterEach(() => {
  for (const tempDir of tempDirs) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }

  tempDirs.length = 0;
});

const createTempWorkspace = (): string => {
  const tempDir = fs.mkdtempSync(
    path.join(process.cwd(), ".typeweaver-generate-test-")
  );
  tempDirs.push(tempDir);

  return tempDir;
};

const writeTinySpec = (workspace: string): string => {
  const specFile = path.join(workspace, "spec", "index.ts");

  fs.mkdirSync(path.dirname(specFile), { recursive: true });
  fs.writeFileSync(
    specFile,
    [
      'import { defineOperation, defineResponse, defineSpec, HttpMethod, HttpStatusCode } from "@rexeus/typeweaver-core";',
      'import { z } from "zod";',
      "",
      "const itemLoaded = defineResponse({",
      '  name: "ItemLoaded",',
      "  statusCode: HttpStatusCode.OK,",
      '  description: "Item loaded",',
      "  body: z.object({ id: z.string(), name: z.string() }),",
      "});",
      "",
      "export const spec = defineSpec({",
      '  metadata: { title: "Items API", version: "1.0.0" },',
      "  resources: {",
      "    item: {",
      "      operations: [",
      "        defineOperation({",
      '          operationId: "getItem",',
      '          path: "/items/:itemId",',
      "          method: HttpMethod.GET,",
      '          summary: "Get item",',
      "          request: {",
      "            param: z.object({ itemId: z.string() }),",
      "          },",
      "          responses: [itemLoaded],",
      "        }),",
      "      ],",
      "    },",
      "  },",
      "});",
      "",
    ].join("\n")
  );

  return specFile;
};

const writeSchemaLessSpec = (workspace: string): string => {
  const specFile = path.join(workspace, "spec", "index.ts");

  fs.mkdirSync(path.dirname(specFile), { recursive: true });
  fs.writeFileSync(
    specFile,
    [
      'import { defineOperation, defineResponse, defineSpec, HttpMethod, HttpStatusCode } from "@rexeus/typeweaver-core";',
      "",
      "const pingOk = defineResponse({",
      '  name: "PingOk",',
      "  statusCode: HttpStatusCode.OK,",
      '  description: "Ping succeeded",',
      "});",
      "",
      "export const spec = defineSpec({",
      '  metadata: { title: "Health API", version: "1.0.0" },',
      "  resources: {",
      "    health: {",
      "      operations: [",
      "        defineOperation({",
      '          operationId: "ping",',
      '          path: "/ping",',
      "          method: HttpMethod.GET,",
      '          summary: "Ping",',
      "          request: {},",
      "          responses: [pingOk],",
      "        }),",
      "        defineOperation({",
      '          operationId: "status",',
      '          path: "/status",',
      "          method: HttpMethod.GET,",
      '          summary: "Status",',
      "          request: {},",
      "          responses: [pingOk],",
      "        }),",
      "      ],",
      "    },",
      "  },",
      "});",
      "",
    ].join("\n")
  );

  return specFile;
};

const generateTypesInWorkspace = async (
  workspace: string,
  config: { readonly clean?: boolean } = {}
): Promise<string> => {
  const outputDir = path.join(workspace, "generated", "output");

  await runGenerator({
    inputFile: "spec/index.ts",
    outputDir: "generated/output",
    config: {
      input: "spec/index.ts",
      output: "generated/output",
      format: false,
      ...config,
    },
    currentWorkingDirectory: workspace,
  });

  return outputDir;
};

const expectFileExists = (filePath: string): void => {
  expect(fs.existsSync(filePath), filePath).toBe(true);
};

const readFile = (filePath: string): string => {
  return fs.readFileSync(filePath, "utf8");
};

const writeStrictGeneratedTsConfig = (workspace: string): string => {
  const tsconfigFile = path.join(workspace, "tsconfig.generated-strict.json");

  fs.writeFileSync(
    tsconfigFile,
    JSON.stringify(
      {
        compilerOptions: {
          target: "ESNext",
          module: "NodeNext",
          moduleResolution: "NodeNext",
          strict: true,
          noUnusedLocals: true,
          noUnusedParameters: true,
          verbatimModuleSyntax: true,
          skipLibCheck: true,
          isolatedModules: true,
          esModuleInterop: true,
          types: ["node"],
          noEmit: true,
        },
        include: [
          "consumer.ts",
          "generated/output/**/*.ts",
          "generated/output/**/*.d.ts",
        ],
      },
      null,
      2
    )
  );

  return tsconfigFile;
};

const writeSchemaLessCommandConsumer = (workspace: string): void => {
  fs.writeFileSync(
    path.join(workspace, "consumer.ts"),
    [
      'import { PingRequestCommand } from "./generated/output/health/PingRequestCommand.js";',
      'import { StatusRequestCommand } from "./generated/output/health/StatusRequestCommand.js";',
      "",
      "export const commands = [",
      "  new PingRequestCommand(),",
      "  new PingRequestCommand({}),",
      "  new StatusRequestCommand(),",
      "  new StatusRequestCommand({}),",
      "];",
      "",
    ].join("\n")
  );
};

const runGeneratedTypecheck = async (
  workspace: string,
  tsconfigFile: string
): Promise<void> => {
  const tscPath = require.resolve("typescript/bin/tsc6");

  await execFileAsync(
    process.execPath,
    [tscPath, "--noEmit", "-p", tsconfigFile, "--pretty", "false"],
    { cwd: workspace }
  );
};

describe("Generator generated TypeScript compatibility", () => {
  test("strict-compiles generated client commands and validators for requests without schemas", async () => {
    const workspace = createTempWorkspace();
    writeSchemaLessSpec(workspace);
    writeSchemaLessCommandConsumer(workspace);
    const tsconfigFile = writeStrictGeneratedTsConfig(workspace);

    await runGenerator({
      inputFile: "spec/index.ts",
      outputDir: "generated/output",
      config: {
        input: "spec/index.ts",
        output: "generated/output",
        format: false,
        plugins: ["clients"],
      },
      currentWorkingDirectory: workspace,
    });

    await runGeneratedTypecheck(workspace, tsconfigFile);
  }, 30_000);
  test("omits operation-definition imports and lookups from request validators without schemas", async () => {
    const workspace = createTempWorkspace();
    writeSchemaLessSpec(workspace);
    const outputDir = path.join(workspace, "generated", "output");

    await runGenerator({
      inputFile: "spec/index.ts",
      outputDir: "generated/output",
      config: {
        input: "spec/index.ts",
        output: "generated/output",
        format: false,
        plugins: ["clients"],
      },
      currentWorkingDirectory: workspace,
    });

    const pingRequestValidator = readFile(
      path.join(outputDir, "health", "PingRequestValidator.ts")
    );
    const statusRequestValidator = readFile(
      path.join(outputDir, "health", "StatusRequestValidator.ts")
    );

    for (const requestValidator of [
      pingRequestValidator,
      statusRequestValidator,
    ]) {
      expect(requestValidator).not.toContain("import { spec }");
      expect(requestValidator).not.toContain("getOperationDefinition");
      expect(requestValidator).not.toContain(
        "const definition = getOperationDefinition"
      );
    }
  });
});

describe("Generator output cleanup", () => {
  test("removes stale output before generating by default", async () => {
    const workspace = createTempWorkspace();
    const staleFile = path.join(workspace, "generated", "output", "stale.txt");
    fs.mkdirSync(path.dirname(staleFile), { recursive: true });
    fs.writeFileSync(staleFile, "old output");
    writeTinySpec(workspace);

    const outputDir = await generateTypesInWorkspace(workspace);

    expect(fs.existsSync(staleFile)).toBe(false);
    expectFileExists(path.join(outputDir, "item", "GetItemRequest.ts"));
  });
  test("preserves existing output when clean is disabled", async () => {
    const workspace = createTempWorkspace();
    const staleFile = path.join(workspace, "generated", "output", "stale.txt");
    fs.mkdirSync(path.dirname(staleFile), { recursive: true });
    fs.writeFileSync(staleFile, "old output");
    writeTinySpec(workspace);

    const outputDir = await generateTypesInWorkspace(workspace, {
      clean: false,
    });

    expectFileExists(staleFile);
    expectFileExists(path.join(outputDir, "item", "GetItemRequest.ts"));
  });
  test("uses default config values when no config object is provided", async () => {
    const workspace = createTempWorkspace();
    const staleFile = path.join(workspace, "generated", "output", "stale.txt");
    fs.mkdirSync(path.dirname(staleFile), { recursive: true });
    fs.writeFileSync(staleFile, "old output");
    writeTinySpec(workspace);
    const outputDir = path.join(workspace, "generated", "output");

    await runGenerator({
      inputFile: "spec/index.ts",
      outputDir: "generated/output",
      currentWorkingDirectory: workspace,
    });

    expect(fs.existsSync(staleFile)).toBe(false);
    expectFileExists(path.join(outputDir, "item", "GetItemRequest.ts"));
  });
  test("rejects cleaning the workspace root before deleting existing files", async () => {
    const workspace = createTempWorkspace();
    const packageDirectory = path.join(workspace, "packages", "cli");
    const sentinelFile = path.join(workspace, "sentinel.txt");
    fs.mkdirSync(path.join(workspace, ".git"), { recursive: true });
    fs.mkdirSync(packageDirectory, { recursive: true });
    writeTinySpec(packageDirectory);
    fs.writeFileSync(sentinelFile, "do not delete");

    await expect(
      runGenerator({
        inputFile: "spec/index.ts",
        outputDir: "../..",
        config: {
          input: "spec/index.ts",
          output: "../..",
          clean: true,
          format: false,
        },
        currentWorkingDirectory: packageDirectory,
      })
    ).rejects.toThrow(/protected workspace root/);

    expectFileExists(sentinelFile);
  });
});
