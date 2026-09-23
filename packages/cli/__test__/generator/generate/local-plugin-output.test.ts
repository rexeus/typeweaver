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
