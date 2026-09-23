import fs from "node:fs";
import path from "node:path";
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

const writeConfiguredLocalPlugin = (workspace: string): string => {
  const pluginFile = path.join(workspace, "plugins", "marker-plugin.mjs");

  fs.mkdirSync(path.dirname(pluginFile), { recursive: true });
  fs.writeFileSync(
    pluginFile,
    [
      'import fs from "node:fs";',
      'import path from "node:path";',
      'import { Effect } from "effect";',
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
      "export const markerPlugin = {",
      '  name: "marker-plugin",',
      "  initialize: context =>",
      '    Effect.sync(() => writeMarker(context, "initialize.json")),',
      "  generate: context =>",
      "    Effect.sync(() => {",
      '      context.writeFile("plugin/Marker.ts",',
      '        "export const marker = " + JSON.stringify(getMarker(context.config)) + ";\\n" +',
      '        "export const generatedFrom = " + JSON.stringify(context.inputDir) + ";\\n"',
      "      );",
      "    }),",
      "  finalize: context =>",
      '    Effect.sync(() => writeMarker(context, "finalize.json")),',
      "};",
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
      'import { Effect } from "effect";',
      "",
      "export const formattingPlugin = {",
      '  name: "formatting-plugin",',
      "  generate: context =>",
      "    Effect.sync(() => {",
      "      context.writeFile(",
      '        "plugin/.typeweaver-output.ts",',
      `        ${JSON.stringify(unformattedPluginOutput)}`,
      "      );",
      "    }),",
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

describe("Generator local plugin output", () => {
  test("runs configured local plugins alongside required type generation", async () => {
    const workspace = createTempWorkspace();
    const pluginFile = writeConfiguredLocalPlugin(workspace);
    writeTinySpec(workspace);
    const outputDir = path.join(workspace, "generated", "output");

    await runGenerator({
      inputFile: "spec/index.ts",
      outputDir: "generated/output",
      config: {
        input: "spec/index.ts",
        output: "generated/output",
        plugins: [[pluginFile, { marker: "configured locally" }]],
      },
      currentWorkingDirectory: workspace,
    });

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

    expect(
      readFile(path.join(outputDir, "plugin", ".typeweaver-output.ts"))
    ).toBe(formattedPluginOutput);
  });
  test("leaves files emitted by local plugins unformatted when formatting is disabled", async () => {
    const workspace = createTempWorkspace();
    const pluginFile = writeFormattingLocalPlugin(workspace);
    writeTinySpec(workspace);
    const outputDir = path.join(workspace, "generated", "output");

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

    expect(
      readFile(path.join(outputDir, "plugin", ".typeweaver-output.ts"))
    ).toBe(unformattedPluginOutput);
  });
});
