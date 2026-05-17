import fs from "node:fs";
import path from "node:path";
import { Cause, Effect, Exit } from "effect";
import { afterEach, describe, expect, test } from "vitest";
import { effectRuntime } from "../src/effectRuntime.js";
import { Generator } from "../src/services/Generator.js";
import { withCapturedLogs } from "./helpers/index.js";

const tempDirs: string[] = [];

const createTempWorkspace = (label: string): string => {
  const tempDir = fs.mkdtempSync(
    path.join(process.cwd(), `.typeweaver-lifecycle-${label}-`)
  );
  tempDirs.push(tempDir);
  return tempDir;
};

const writeTinySpec = (workspace: string): void => {
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
      "  body: z.object({ id: z.string() }),",
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
      "          request: { param: z.object({ itemId: z.string() }) },",
      "          responses: [itemLoaded],",
      "        }),",
      "      ],",
      "    },",
      "  },",
      "});",
      "",
    ].join("\n")
  );
};

const writeRecordingPlugins = (workspace: string): readonly string[] => {
  const eventsFile = path.join(workspace, "lifecycle-events.log");
  fs.writeFileSync(eventsFile, "");

  const pluginFor = (name: string): string => {
    const pluginFile = path.join(workspace, "plugins", `${name}.mjs`);
    fs.mkdirSync(path.dirname(pluginFile), { recursive: true });
    fs.writeFileSync(
      pluginFile,
      [
        'import fs from "node:fs";',
        'import { Effect } from "effect";',
        "",
        `const eventsFile = ${JSON.stringify(eventsFile)};`,
        `const pluginName = ${JSON.stringify(name)};`,
        "",
        "const record = stage =>",
        "  Effect.sync(() => {",
        "    fs.appendFileSync(eventsFile, `${stage}:${pluginName}\\n`);",
        "  });",
        "",
        `export const ${name}Plugin = {`,
        "  name: pluginName,",
        '  initialize: _ctx => record("initialize"),',
        "  collectResources: spec =>",
        "    Effect.gen(function* () {",
        '      yield* record("collectResources");',
        "      return spec;",
        "    }),",
        '  generate: _ctx => record("generate"),',
        '  finalize: _ctx => record("finalize"),',
        "};",
        "",
      ].join("\n")
    );
    return pluginFile;
  };

  return [pluginFor("alpha"), pluginFor("beta")];
};

const writeFailingFinalizePlugin = (workspace: string): string => {
  const eventsFile = path.join(workspace, "lifecycle-events.log");
  if (!fs.existsSync(eventsFile)) fs.writeFileSync(eventsFile, "");

  const pluginFile = path.join(
    workspace,
    "plugins",
    "failing-finalize-plugin.mjs"
  );
  fs.mkdirSync(path.dirname(pluginFile), { recursive: true });
  fs.writeFileSync(
    pluginFile,
    [
      'import fs from "node:fs";',
      'import { Effect } from "effect";',
      'import { PluginExecutionError } from "@rexeus/typeweaver-gen";',
      "",
      `const eventsFile = ${JSON.stringify(eventsFile)};`,
      "",
      "const record = stage =>",
      "  Effect.sync(() => {",
      "    fs.appendFileSync(eventsFile, `${stage}:failing-finalize-plugin\\n`);",
      "  });",
      "",
      "export const failingFinalizePlugin = {",
      '  name: "failing-finalize-plugin",',
      '  initialize: _ctx => record("initialize"),',
      "  generate: _ctx =>",
      "    Effect.gen(function* () {",
      '      yield* record("generate");',
      "      return yield* Effect.fail(",
      "        new PluginExecutionError({",
      '          pluginName: "failing-finalize-plugin",',
      '          phase: "generate",',
      '          cause: new Error("intentional generate failure"),',
      "        })",
      "      );",
      "    }),",
      '  finalize: _ctx => record("finalize"),',
      "};",
      "",
    ].join("\n")
  );
  return pluginFile;
};

const writeFailingGeneratePlugin = (
  workspace: string,
  pluginName: string
): string => {
  const eventsFile = path.join(workspace, "lifecycle-events.log");
  if (!fs.existsSync(eventsFile)) fs.writeFileSync(eventsFile, "");

  const pluginFile = path.join(workspace, "plugins", `${pluginName}.mjs`);
  fs.mkdirSync(path.dirname(pluginFile), { recursive: true });
  fs.writeFileSync(
    pluginFile,
    [
      'import fs from "node:fs";',
      'import { Effect } from "effect";',
      'import { PluginExecutionError } from "@rexeus/typeweaver-gen";',
      "",
      `const eventsFile = ${JSON.stringify(eventsFile)};`,
      `const pluginName = ${JSON.stringify(pluginName)};`,
      "",
      "const record = stage =>",
      "  Effect.sync(() => {",
      "    fs.appendFileSync(eventsFile, `${stage}:${pluginName}\\n`);",
      "  });",
      "",
      `export const ${pluginName}Plugin = {`,
      "  name: pluginName,",
      '  initialize: _ctx => record("initialize"),',
      "  generate: _ctx =>",
      "    Effect.gen(function* () {",
      '      yield* record("generate");',
      "      return yield* Effect.fail(",
      "        new PluginExecutionError({",
      "          pluginName,",
      '          phase: "generate",',
      '          cause: new Error("intentional generate failure"),',
      "        })",
      "      );",
      "    }),",
      '  finalize: _ctx => record("finalize"),',
      "};",
      "",
    ].join("\n")
  );
  return pluginFile;
};

const writeFailingFinalizeOnlyPlugin = (
  workspace: string,
  pluginName: string
): string => {
  const eventsFile = path.join(workspace, "lifecycle-events.log");
  if (!fs.existsSync(eventsFile)) fs.writeFileSync(eventsFile, "");

  const pluginFile = path.join(workspace, "plugins", `${pluginName}.mjs`);
  fs.mkdirSync(path.dirname(pluginFile), { recursive: true });
  fs.writeFileSync(
    pluginFile,
    [
      'import fs from "node:fs";',
      'import { Effect } from "effect";',
      'import { PluginExecutionError } from "@rexeus/typeweaver-gen";',
      "",
      `const eventsFile = ${JSON.stringify(eventsFile)};`,
      `const pluginName = ${JSON.stringify(pluginName)};`,
      "",
      "const record = stage =>",
      "  Effect.sync(() => {",
      "    fs.appendFileSync(eventsFile, `${stage}:${pluginName}\\n`);",
      "  });",
      "",
      `export const ${pluginName}Plugin = {`,
      "  name: pluginName,",
      '  initialize: _ctx => record("initialize"),',
      "  finalize: _ctx =>",
      "    Effect.gen(function* () {",
      '      yield* record("finalize");',
      "      return yield* Effect.fail(",
      "        new PluginExecutionError({",
      "          pluginName,",
      '          phase: "finalize",',
      '          cause: new Error("intentional finalize failure"),',
      "        })",
      "      );",
      "    }),",
      "};",
      "",
    ].join("\n")
  );
  return pluginFile;
};

const readEvents = (workspace: string): readonly string[] => {
  const file = path.join(workspace, "lifecycle-events.log");
  if (!fs.existsSync(file)) return [];
  return fs
    .readFileSync(file, "utf8")
    .split("\n")
    .filter(line => line.length > 0);
};

describe("Generator.generate (plugin lifecycle ordering)", () => {
  afterEach(() => {
    for (const tempDir of tempDirs) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    tempDirs.length = 0;
  });

  test("runs every plugin through each phase before advancing to the next phase", async () => {
    const workspace = createTempWorkspace("ordering");
    writeTinySpec(workspace);
    const pluginFiles = writeRecordingPlugins(workspace);

    await effectRuntime.runPromise(
      Generator.generate({
        inputFile: "spec/index.ts",
        outputDir: "generated/output",
        config: {
          input: "spec/index.ts",
          output: "generated/output",
          format: false,
          plugins: pluginFiles,
        },
        currentWorkingDirectory: workspace,
      })
    );

    const events = readEvents(workspace);
    const stageIndex = (stage: string, plugin: string): number =>
      events.indexOf(`${stage}:${plugin}`);

    // Every initialize precedes every collectResources;
    // every collectResources precedes every generate;
    // every generate precedes every finalize.
    const lastInitialize = Math.max(
      stageIndex("initialize", "alpha"),
      stageIndex("initialize", "beta")
    );
    const firstCollect = Math.min(
      stageIndex("collectResources", "alpha"),
      stageIndex("collectResources", "beta")
    );
    const lastCollect = Math.max(
      stageIndex("collectResources", "alpha"),
      stageIndex("collectResources", "beta")
    );
    const firstGenerate = Math.min(
      stageIndex("generate", "alpha"),
      stageIndex("generate", "beta")
    );
    const lastGenerate = Math.max(
      stageIndex("generate", "alpha"),
      stageIndex("generate", "beta")
    );
    const firstFinalize = Math.min(
      stageIndex("finalize", "alpha"),
      stageIndex("finalize", "beta")
    );

    expect(lastInitialize).toBeGreaterThanOrEqual(0);
    expect(lastInitialize).toBeLessThan(firstCollect);
    expect(lastCollect).toBeLessThan(firstGenerate);
    expect(lastGenerate).toBeLessThan(firstFinalize);
  });

  test("runs finalize for plugins that initialized even when a later plugin's generate fails", async () => {
    const workspace = createTempWorkspace("finalize-on-failure");
    writeTinySpec(workspace);
    const pluginFile = writeFailingFinalizePlugin(workspace);

    const exit = await effectRuntime.runPromiseExit(
      Generator.generate({
        inputFile: "spec/index.ts",
        outputDir: "generated/output",
        config: {
          input: "spec/index.ts",
          output: "generated/output",
          format: false,
          plugins: [pluginFile],
        },
        currentWorkingDirectory: workspace,
      })
    );

    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      const failure = Cause.failureOption(exit.cause);
      expect(failure._tag).toBe("Some");
    }

    const events = readEvents(workspace);
    expect(events).toContain("initialize:failing-finalize-plugin");
    expect(events).toContain("generate:failing-finalize-plugin");
    expect(events).toContain("finalize:failing-finalize-plugin");

    const initIdx = events.indexOf("initialize:failing-finalize-plugin");
    const genIdx = events.indexOf("generate:failing-finalize-plugin");
    const finIdx = events.indexOf("finalize:failing-finalize-plugin");
    expect(initIdx).toBeLessThan(genIdx);
    expect(genIdx).toBeLessThan(finIdx);
  });

  test("surfaces the original generate failure and logs a WARN when a sibling plugin's finalize also fails", async () => {
    const workspace = createTempWorkspace("finalize-failure-after-generate");
    writeTinySpec(workspace);
    const pluginA = writeFailingGeneratePlugin(workspace, "alphaFails");
    const pluginB = writeFailingFinalizeOnlyPlugin(workspace, "betaFinalize");

    // Capture the pipeline's exit alongside the captured logs in a single
    // scope: wrap `Generator.generate` in `Effect.exit` so the inner
    // failure does not short-circuit `withCapturedLogs` — the logger
    // replacement stays active across the finalize-on-failure block.
    const { result: innerExit, logs } = await effectRuntime.runPromise(
      withCapturedLogs(
        Effect.exit(
          Generator.generate({
            inputFile: "spec/index.ts",
            outputDir: "generated/output",
            config: {
              input: "spec/index.ts",
              output: "generated/output",
              format: false,
              plugins: [pluginA, pluginB],
            },
            currentWorkingDirectory: workspace,
          })
        )
      )
    );

    expect(Exit.isFailure(innerExit)).toBe(true);
    if (!Exit.isFailure(innerExit)) return;

    const failure = Cause.failureOption(innerExit.cause);
    expect(failure._tag).toBe("Some");
    if (failure._tag !== "Some") return;
    const error = failure.value as {
      readonly _tag: string;
      readonly pluginName: string;
      readonly phase: string;
    };
    expect(error._tag).toBe("PluginExecutionError");
    expect(error.pluginName).toBe("alphaFails");
    expect(error.phase).toBe("generate");

    const events = readEvents(workspace);
    expect(events).toContain("initialize:alphaFails");
    expect(events).toContain("initialize:betaFinalize");
    expect(events).toContain("generate:alphaFails");
    expect(events).toContain("finalize:alphaFails");
    expect(events).toContain("finalize:betaFinalize");

    const finalizeWarn = logs.find(
      log =>
        log.level === "WARN" &&
        log.message.includes("betaFinalize") &&
        log.message.includes("failed during finalize")
    );
    expect(finalizeWarn).toBeDefined();
  });
});
