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

const writeResourceCollectingLocalPlugin = (workspace: string): string => {
  const pluginFile = path.join(workspace, "plugins", "resource-plugin.mjs");

  fs.mkdirSync(path.dirname(pluginFile), { recursive: true });
  fs.writeFileSync(
    pluginFile,
    [
      'import { Effect } from "effect";',
      "",
      "export const resourcePlugin = {",
      '  name: "resource-plugin",',
      "  collectResources: normalizedSpec =>",
      "    Effect.sync(() => {",
      "      const existingResource = normalizedSpec.resources[0];",
      "      const existingOperation = existingResource.operations[0];",
      "      const existingResponse = normalizedSpec.responses[0];",
      "      const pluginResponse = {",
      "        ...existingResponse,",
      '        name: "PluginLoaded",',
      '        description: "Plugin-loaded response",',
      "      };",
      "",
      "      return {",
      "        ...normalizedSpec,",
      "        responses: [...normalizedSpec.responses, pluginResponse],",
      "        resources: [",
      "          ...normalizedSpec.resources,",
      "          {",
      '            name: "pluginItem",',
      "            operations: [",
      "              {",
      "                ...existingOperation,",
      '                operationId: "getPluginItem",',
      '                path: "/plugin-items",',
      '                summary: "Get plugin item",',
      "                request: undefined,",
      "                responses: [",
      '                  { responseName: "PluginLoaded", source: "canonical" },',
      "                ],",
      "              },",
      "            ],",
      "          },",
      "        ],",
      "      };",
      "    }),",
      "};",
      "",
    ].join("\n")
  );

  return pluginFile;
};

const writePhaseOrderingLocalPlugin = (workspace: string): string => {
  const pluginFile = path.join(workspace, "plugins", "phase-order-plugin.mjs");

  fs.mkdirSync(path.dirname(pluginFile), { recursive: true });
  fs.writeFileSync(
    pluginFile,
    [
      'import fs from "node:fs";',
      'import path from "node:path";',
      'import { fileURLToPath } from "node:url";',
      'import { Effect } from "effect";',
      "",
      "const eventLogFile = path.join(",
      "  path.dirname(fileURLToPath(import.meta.url)),",
      '  "..",',
      '  "phase-events.log"',
      ");",
      "",
      "const appendEvent = eventName => {",
      "  fs.appendFileSync(eventLogFile, `${eventName}\\n`);",
      "};",
      "",
      "export const phaseOrderPlugin = {",
      '  name: "phase-order-plugin",',
      '  initialize: () => Effect.sync(() => appendEvent("initialize")),',
      "  collectResources: normalizedSpec =>",
      "    Effect.sync(() => {",
      '      appendEvent("collectResources");',
      "      return normalizedSpec;",
      "    }),",
      '  generate: () => Effect.sync(() => appendEvent("generate")),',
      '  finalize: () => Effect.sync(() => appendEvent("finalize")),',
      "};",
      "",
    ].join("\n")
  );

  return pluginFile;
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

describe("Generator local plugin lifecycle", () => {
  test("runs local plugin phases in lifecycle order", async () => {
    const workspace = createTempWorkspace();
    const pluginFile = writePhaseOrderingLocalPlugin(workspace);
    writeTinySpec(workspace);
    const eventLogFile = path.join(workspace, "phase-events.log");

    await runGenerator({
      inputFile: "spec/index.ts",
      outputDir: "generated/output",
      config: {
        input: "spec/index.ts",
        output: "generated/output",
        format: false,
        plugins: [pluginFile],
      },
      currentWorkingDirectory: workspace,
    });

    expect(readFile(eventLogFile).trim().split("\n")).toEqual([
      "initialize",
      "collectResources",
      "generate",
      "finalize",
    ]);
  });
  test("generates output from resources collected by local plugins", async () => {
    const workspace = createTempWorkspace();
    const pluginFile = writeResourceCollectingLocalPlugin(workspace);
    writeTinySpec(workspace);
    const outputDir = path.join(workspace, "generated", "output");

    await runGenerator({
      inputFile: "spec/index.ts",
      outputDir: "generated/output",
      config: {
        input: "spec/index.ts",
        output: "generated/output",
        plugins: [pluginFile],
      },
      currentWorkingDirectory: workspace,
    });

    expectFileExists(
      path.join(outputDir, "pluginItem", "GetPluginItemRequest.ts")
    );
    expectFileContains(
      path.join(outputDir, "pluginItem", "GetPluginItemResponse.ts"),
      "IPluginLoadedResponse"
    );
    expectFileContains(
      path.join(outputDir, "responses", "PluginLoadedResponse.ts"),
      "export type IPluginLoadedResponse"
    );
  });
});
