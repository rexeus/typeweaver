import fs from "node:fs";
import path from "node:path";
import type { TypeweaverConfig } from "@rexeus/typeweaver-gen";
import { afterEach, describe, expect, test } from "vitest";
import { effectRuntime } from "../src/effectRuntime.js";
import { Generator } from "../src/services/Generator.js";

const runGenerator = async (params: {
  readonly inputFile: string;
  readonly outputDir: string;
  readonly config?: TypeweaverConfig;
  readonly currentWorkingDirectory: string;
}): Promise<void> => {
  await effectRuntime.runPromise(Generator.generate(params));
};

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

const expectFileContains = (filePath: string, expected: string): void => {
  expect(fs.readFileSync(filePath, "utf8")).toContain(expected);
};

const readFile = (filePath: string): string => {
  return fs.readFileSync(filePath, "utf8");
};

describe("Generator output contract", () => {
  test("generates TypeWeaver output from paths relative to the provided working directory", async () => {
    const workspace = createTempWorkspace();
    writeTinySpec(workspace);
    const outputDir = path.join(workspace, "generated", "output");

    await runGenerator({
      inputFile: "spec/index.ts",
      outputDir: "generated/output",
      config: {
        input: "spec/index.ts",
        output: "generated/output",
      },
      currentWorkingDirectory: workspace,
    });

    expectFileExists(outputDir);
    expectFileExists(path.join(outputDir, "spec", "spec.js"));
    expectFileExists(path.join(outputDir, "spec", "spec.d.ts"));
    expectFileExists(
      path.join(outputDir, "responses", "ItemLoadedResponse.ts")
    );
    expectFileExists(path.join(outputDir, "item", "GetItemRequest.ts"));
    expectFileExists(path.join(outputDir, "item", "GetItemResponse.ts"));
    expectFileExists(
      path.join(outputDir, "item", "GetItemRequestValidator.ts")
    );
    expectFileExists(
      path.join(outputDir, "item", "GetItemResponseValidator.ts")
    );
    expectFileExists(path.join(outputDir, "item", "index.ts"));
    expectFileExists(path.join(outputDir, "responses", "index.ts"));
    expectFileExists(path.join(outputDir, "index.ts"));
    expectFileContains(
      path.join(outputDir, "item", "GetItemRequest.ts"),
      "export type IGetItemRequestParam"
    );
    expectFileContains(
      path.join(outputDir, "responses", "ItemLoadedResponse.ts"),
      "export type IItemLoadedResponse"
    );
  });
});

describe("Generator validator and OpenAPI output", () => {
  test("imports operation definitions in validators generated for schema-backed requests and responses", async () => {
    const workspace = createTempWorkspace();
    writeTinySpec(workspace);

    const outputDir = await generateTypesInWorkspace(workspace);
    const requestValidator = readFile(
      path.join(outputDir, "item", "GetItemRequestValidator.ts")
    );
    const responseValidator = readFile(
      path.join(outputDir, "item", "GetItemResponseValidator.ts")
    );

    expect(requestValidator).toContain(
      'import { spec } from "../spec/spec.js";'
    );
    expect(requestValidator).toContain(
      'getOperationDefinition(spec, "item", "getItem")'
    );
    expect(responseValidator).toContain(
      'import { spec } from "../spec/spec.js";'
    );
    expect(responseValidator).toContain(
      'getOperationDefinition(spec, "item", "getItem")'
    );
  });
  test("generates OpenAPI JSON without adding it to TypeScript barrels", async () => {
    const workspace = createTempWorkspace();
    writeTinySpec(workspace);
    const outputDir = path.join(workspace, "generated", "output");

    await runGenerator({
      inputFile: "spec/index.ts",
      outputDir: "generated/output",
      config: {
        input: "spec/index.ts",
        output: "generated/output",
        format: false,
        plugins: ["openapi"],
      },
      currentWorkingDirectory: workspace,
    });

    const openApiFile = path.join(outputDir, "openapi", "openapi.json");
    const document = JSON.parse(readFile(openApiFile)) as Record<
      string,
      unknown
    >;
    const rootIndex = readFile(path.join(outputDir, "index.ts"));

    expectFileExists(openApiFile);
    expect(document["openapi"]).toBe("3.1.2");
    expect(document["paths"]).toHaveProperty("/items/{itemId}");
    expect(rootIndex).not.toContain("openapi.json");
    expect(rootIndex).not.toContain("./openapi/index.js");
    expect(fs.existsSync(path.join(outputDir, "openapi", "index.ts"))).toBe(
      false
    );
  });
});
