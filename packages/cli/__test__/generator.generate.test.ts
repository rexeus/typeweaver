import { execFile } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { promisify } from "node:util";
import { afterEach, describe, expect, test } from "vitest";
import { Generator } from "../src/generators/Generator.js";

const require = createRequire(import.meta.url);
const execFileAsync = promisify(execFile);

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
    const pluginFile = path.join(
      workspace,
      "plugins",
      "phase-order-plugin.mjs"
    );

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
        "  fs.appendFileSync(eventLogFile, `${eventName}\\n`);",
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
    const tscPath = require.resolve("typescript/bin/tsc");

    await execFileAsync(
      process.execPath,
      [tscPath, "--noEmit", "-p", tsconfigFile, "--pretty", "false"],
      { cwd: workspace }
    );
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
      path.join(outputDir, "responses", "ItemLoadedResponse.ts"),
      "export type IItemLoadedResponse"
    );
  });

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

  test("strict-compiles generated client commands and validators for requests without schemas", async () => {
    const workspace = createTempWorkspace();
    writeSchemaLessSpec(workspace);
    writeSchemaLessCommandConsumer(workspace);
    const tsconfigFile = writeStrictGeneratedTsConfig(workspace);

    await new Generator().generate(
      "spec/index.ts",
      "generated/output",
      {
        input: "spec/index.ts",
        output: "generated/output",
        format: false,
        plugins: ["clients"],
      },
      workspace
    );

    await runGeneratedTypecheck(workspace, tsconfigFile);
  });

  test("omits operation-definition imports and lookups from request validators without schemas", async () => {
    const workspace = createTempWorkspace();
    writeSchemaLessSpec(workspace);
    const outputDir = path.join(workspace, "generated", "output");

    await new Generator().generate(
      "spec/index.ts",
      "generated/output",
      {
        input: "spec/index.ts",
        output: "generated/output",
        format: false,
        plugins: ["clients"],
      },
      workspace
    );

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
    ).rejects.toThrow(/protected workspace root/);

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
