import fs from "node:fs";
import path from "node:path";
import type { TypeweaverConfig } from "@rexeus/typeweaver-gen";
import { expect } from "vitest";
import { effectRuntime } from "../../../src/effectRuntime.js";
import { Generator } from "../../../src/services/Generator.js";

const tempDirs: string[] = [];

export const removeTempDirs = (): void => {
  for (const tempDir of tempDirs) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }

  tempDirs.length = 0;
};

export const runGenerator = async (params: {
  readonly inputFile: string;
  readonly outputDir: string;
  readonly config?: TypeweaverConfig;
  readonly currentWorkingDirectory: string;
}): Promise<void> => {
  await effectRuntime.runPromise(Generator.generate(params));
};

export const createTempWorkspace = (): string => {
  const tempDir = fs.mkdtempSync(
    path.join(process.cwd(), ".typeweaver-generate-test-")
  );
  tempDirs.push(tempDir);

  return tempDir;
};

/**
 * Writes a one-operation spec whose response body carries `id` and `name`.
 */
export const writeTinySpec = (workspace: string): string => {
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

export const generateTypesInWorkspace = async (
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

export const expectFileExists = (filePath: string): void => {
  expect(fs.existsSync(filePath), filePath).toBe(true);
};

export const expectFileContains = (
  filePath: string,
  expected: string
): void => {
  expect(fs.readFileSync(filePath, "utf8")).toContain(expected);
};

export const readFile = (filePath: string): string => {
  return fs.readFileSync(filePath, "utf8");
};
