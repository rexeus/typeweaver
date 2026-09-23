import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import {
  createTempWorkspace,
  expectFileContains,
  expectFileExists,
  readFile,
  removeTempDirs,
  runGenerator,
  writeTinySpec,
} from "./fixtures.js";

afterEach(removeTempDirs);

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
