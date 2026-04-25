import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { Generator } from "../src/generators/Generator.js";

describe("Generator.generate", () => {
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

  const writeConfiguredLocalPlugin = (workspace: string): string => {
    const pluginFile = path.join(workspace, "plugins", "marker-plugin.mjs");

    fs.mkdirSync(path.dirname(pluginFile), { recursive: true });
    fs.writeFileSync(
      pluginFile,
      [
        'import fs from "node:fs";',
        'import path from "node:path";',
        "",
        "const getMarker = config => {",
        "  const configuredPlugin = config.plugins.find(plugin =>",
        "    Array.isArray(plugin) && plugin[0] === import.meta.filename",
        "  );",
        '  return configuredPlugin?.[1]?.marker ?? "missing marker";',
        "};",
        "",
        "const writeMarker = (context, fileName) => {",
        '  const outputDir = path.join(context.outputDir, "plugin");',
        "  fs.mkdirSync(outputDir, { recursive: true });",
        "  fs.writeFileSync(",
        "    path.join(outputDir, fileName),",
        "    JSON.stringify({",
        "      marker: getMarker(context.config),",
        "      inputDir: context.inputDir,",
        "      outputDir: context.outputDir,",
        "    }, null, 2)",
        "  );",
        "};",
        "",
        "export class MarkerPlugin {",
        '  name = "marker-plugin";',
        "",
        "  initialize(context) {",
        '    writeMarker(context, "initialize.json");',
        "  }",
        "",
        "  generate(context) {",
        '    context.writeFile("plugin/Marker.ts",',
        '      "export const marker = " + JSON.stringify(getMarker(context.config)) + ";\\n" +',
        '      "export const generatedFrom = " + JSON.stringify(context.inputDir) + ";\\n"',
        "    );",
        "  }",
        "",
        "  finalize(context) {",
        '    writeMarker(context, "finalize.json");',
        "  }",
        "}",
        "",
      ].join("\n")
    );

    return pluginFile;
  };

  const writeResourceCollectingLocalPlugin = (workspace: string): string => {
    const pluginFile = path.join(workspace, "plugins", "resource-plugin.mjs");

    fs.mkdirSync(path.dirname(pluginFile), { recursive: true });
    fs.writeFileSync(
      pluginFile,
      [
        "export class ResourcePlugin {",
        '  name = "resource-plugin";',
        "",
        "  collectResources(normalizedSpec) {",
        "    const existingResource = normalizedSpec.resources[0];",
        "    const existingOperation = existingResource.operations[0];",
        "    const existingResponse = normalizedSpec.responses[0];",
        "    const pluginResponse = {",
        "      ...existingResponse,",
        '      name: "PluginLoaded",',
        '      description: "Plugin-loaded response",',
        "    };",
        "",
        "    return {",
        "      ...normalizedSpec,",
        "      responses: [...normalizedSpec.responses, pluginResponse],",
        "      resources: [",
        "        ...normalizedSpec.resources,",
        "        {",
        '          name: "pluginItem",',
        "          operations: [",
        "            {",
        "              ...existingOperation,",
        '              operationId: "getPluginItem",',
        '              path: "/plugin-items",',
        '              summary: "Get plugin item",',
        "              request: undefined,",
        "              responses: [",
        '                { responseName: "PluginLoaded", source: "canonical" },',
        "              ],",
        "            },",
        "          ],",
        "        },",
        "      ],",
        "    };",
        "  }",
        "}",
        "",
      ].join("\n")
    );

    return pluginFile;
  };

  const unformattedPluginOutput =
    'export const formatted={name:"plugin",enabled:true};\n';
  const formattedPluginOutput =
    'export const formatted = { name: "plugin", enabled: true };\n';

  const writeFormattingLocalPlugin = (workspace: string): string => {
    const pluginFile = path.join(workspace, "plugins", "formatting-plugin.mjs");

    fs.mkdirSync(path.dirname(pluginFile), { recursive: true });
    fs.writeFileSync(
      pluginFile,
      [
        "export class FormattingPlugin {",
        '  name = "formatting-plugin";',
        "",
        "  generate(context) {",
        "    context.writeFile(",
        '      "plugin/Formatted.ts",',
        `      ${JSON.stringify(unformattedPluginOutput)}`,
        "    );",
        "  }",
        "}",
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
        "",
        "const eventLogFile = path.join(",
        "  path.dirname(fileURLToPath(import.meta.url)),",
        '  "..",',
        '  "phase-events.log"',
        ");",
        "",
        "const appendEvent = eventName => {",
        '  fs.appendFileSync(eventLogFile, `${eventName}\\n`);',
        "};",
        "",
        "export class PhaseOrderPlugin {",
        '  name = "phase-order-plugin";',
        "",
        "  initialize() {",
        '    appendEvent("initialize");',
        "  }",
        "",
        "  collectResources(normalizedSpec) {",
        '    appendEvent("collectResources");',
        "    return normalizedSpec;",
        "  }",
        "",
        "  generate() {",
        '    appendEvent("generate");',
        "  }",
        "",
        "  finalize() {",
        '    appendEvent("finalize");',
        "  }",
        "}",
        "",
      ].join("\n")
    );

    return pluginFile;
  };

  const generateTypesInWorkspace = async (
    workspace: string,
    config: { readonly clean?: boolean } = {}
  ): Promise<string> => {
    const outputDir = path.join(workspace, "generated", "output");

    await new Generator().generate(
      "spec/index.ts",
      "generated/output",
      {
        input: "spec/index.ts",
        output: "generated/output",
        format: false,
        ...config,
      },
      workspace
    );

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

  test("generates TypeWeaver output from paths relative to the provided working directory", async () => {
    const workspace = createTempWorkspace();
    writeTinySpec(workspace);
    const outputDir = path.join(workspace, "generated", "output");

    await new Generator().generate(
      "spec/index.ts",
      "generated/output",
      {
        input: "spec/index.ts",
        output: "generated/output",
      },
      workspace
    );

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
      path.join(outputDir, "item", "GetItemResponseValidator.ts"),
      'getOperationDefinition(spec, "item", "getItem")'
    );
    expectFileContains(
      path.join(outputDir, "responses", "ItemLoadedResponse.ts"),
      "export type IItemLoadedResponse"
    );
  });

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

    await new Generator().generate(
      "spec/index.ts",
      "generated/output",
      undefined,
      workspace
    );

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
      new Generator().generate(
        "spec/index.ts",
        "../..",
        {
          input: "spec/index.ts",
          output: "../..",
          clean: true,
          format: false,
        },
        packageDirectory
      )
    ).rejects.toThrow(/inferred workspace root/);

    expectFileExists(sentinelFile);
  });

  test("runs configured local plugins alongside required type generation", async () => {
    const workspace = createTempWorkspace();
    const pluginFile = writeConfiguredLocalPlugin(workspace);
    writeTinySpec(workspace);
    const outputDir = path.join(workspace, "generated", "output");

    await new Generator().generate(
      "spec/index.ts",
      "generated/output",
      {
        input: "spec/index.ts",
        output: "generated/output",
        plugins: [[pluginFile, { marker: "configured locally" }]],
      },
      workspace
    );

    expectFileExists(path.join(outputDir, "item", "GetItemRequest.ts"));
    expectFileContains(
      path.join(outputDir, "plugin", "Marker.ts"),
      'marker = "configured locally"'
    );
    expectFileContains(
      path.join(outputDir, "plugin", "Marker.ts"),
      "generatedFrom"
    );
    expectFileContains(
      path.join(outputDir, "plugin", "Marker.ts"),
      JSON.stringify(path.join(workspace, "spec"))
    );
    expectFileContains(
      path.join(outputDir, "plugin", "initialize.json"),
      '"marker": "configured locally"'
    );
    expectFileContains(
      path.join(outputDir, "plugin", "initialize.json"),
      `"inputDir": ${JSON.stringify(path.join(workspace, "spec"))}`
    );
    expectFileContains(
      path.join(outputDir, "plugin", "finalize.json"),
      `"outputDir": ${JSON.stringify(outputDir)}`
    );
  });

  test("formats files emitted by local plugins by default", async () => {
    const workspace = createTempWorkspace();
    const pluginFile = writeFormattingLocalPlugin(workspace);
    writeTinySpec(workspace);
    const outputDir = path.join(workspace, "generated", "output");

    await new Generator().generate(
      "spec/index.ts",
      "generated/output",
      {
        input: "spec/index.ts",
        output: "generated/output",
        plugins: [pluginFile],
      },
      workspace
    );

    expect(readFile(path.join(outputDir, "plugin", "Formatted.ts"))).toBe(
      formattedPluginOutput
    );
  });

  test("leaves files emitted by local plugins unformatted when formatting is disabled", async () => {
    const workspace = createTempWorkspace();
    const pluginFile = writeFormattingLocalPlugin(workspace);
    writeTinySpec(workspace);
    const outputDir = path.join(workspace, "generated", "output");

    await new Generator().generate(
      "spec/index.ts",
      "generated/output",
      {
        input: "spec/index.ts",
        output: "generated/output",
        format: false,
        plugins: [pluginFile],
      },
      workspace
    );

    expect(readFile(path.join(outputDir, "plugin", "Formatted.ts"))).toBe(
      unformattedPluginOutput
    );
  });

  test("runs local plugin phases in lifecycle order", async () => {
    const workspace = createTempWorkspace();
    const pluginFile = writePhaseOrderingLocalPlugin(workspace);
    writeTinySpec(workspace);
    const eventLogFile = path.join(workspace, "phase-events.log");

    await new Generator().generate(
      "spec/index.ts",
      "generated/output",
      {
        input: "spec/index.ts",
        output: "generated/output",
        format: false,
        plugins: [pluginFile],
      },
      workspace
    );

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

    await new Generator().generate(
      "spec/index.ts",
      "generated/output",
      {
        input: "spec/index.ts",
        output: "generated/output",
        plugins: [pluginFile],
      },
      workspace
    );

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
