import fs from "node:fs";
import path from "node:path";
import { Cause, Exit } from "effect";
import { afterEach, describe, expect, test } from "vitest";
import { effectRuntime } from "../../../src/effectRuntime.js";
import { Generator } from "../../../src/services/Generator.js";
import { writeTinySpec } from "../../helpers/specFiles.js";
import {
  createTempWorkspace,
  readEvents,
  removeTempDirs,
  writeRecordingPlugins,
} from "./fixtures.js";

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

const writeFailingInitializePlugin = (workspace: string): string => {
  const eventsFile = path.join(workspace, "lifecycle-events.log");
  if (!fs.existsSync(eventsFile)) fs.writeFileSync(eventsFile, "");

  // Named so it sorts AFTER the recording plugins (alpha, beta) in the
  // registry's alphabetical order — its initialize failure must hit once
  // earlier plugins have already initialized successfully.
  const pluginFile = path.join(workspace, "plugins", "omega-failing-init.mjs");
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
      "    fs.appendFileSync(eventsFile, `${stage}:omega-failing-init\\n`);",
      "  });",
      "",
      "export const omegaFailingInitPlugin = {",
      '  name: "omega-failing-init",',
      "  initialize: _ctx =>",
      "    Effect.gen(function* () {",
      '      yield* record("initialize");',
      "      return yield* Effect.fail(",
      "        new PluginExecutionError({",
      '          pluginName: "omega-failing-init",',
      '          phase: "initialize",',
      '          cause: new Error("intentional initialize failure"),',
      "        })",
      "      );",
      "    }),",
      '  generate: _ctx => record("generate"),',
      '  finalize: _ctx => record("finalize"),',
      "};",
      "",
    ].join("\n")
  );
  return pluginFile;
};

afterEach(removeTempDirs);

describe("Generator plugin lifecycle phase ordering", () => {
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
          plugins: [...pluginFiles],
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
    expect(events.filter(event => event.startsWith("finalize:"))).toEqual([
      "finalize:beta",
      "finalize:alpha",
    ]);
  });
});

describe("Generator plugin lifecycle recovery", () => {
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
      const failure = Cause.findErrorOption(exit.cause);
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
  test("runs finalize for already-initialized plugins when a later plugin's initialize fails", async () => {
    const workspace = createTempWorkspace("init-failure");
    writeTinySpec(workspace);
    const recordingPlugins = writeRecordingPlugins(workspace);
    const failingPlugin = writeFailingInitializePlugin(workspace);

    const exit = await effectRuntime.runPromiseExit(
      Generator.generate({
        inputFile: "spec/index.ts",
        outputDir: "generated/output",
        config: {
          input: "spec/index.ts",
          output: "generated/output",
          format: false,
          plugins: [...recordingPlugins, failingPlugin],
        },
        currentWorkingDirectory: workspace,
      })
    );

    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      const failure = Cause.findErrorOption(exit.cause);
      expect(failure._tag).toBe("Some");
      if (failure._tag === "Some") {
        expect(failure.value).toMatchObject({
          pluginName: "omega-failing-init",
          phase: "initialize",
        });
      }
    }

    const events = readEvents(workspace);
    // alpha and beta initialized before omega's initialize failed...
    expect(events).toContain("initialize:alpha");
    expect(events).toContain("initialize:beta");
    expect(events).toContain("initialize:omega-failing-init");
    // ...so their finalize cleanup must still run (try/finally semantics).
    expect(events).toContain("finalize:alpha");
    expect(events).toContain("finalize:beta");
    // The plugin whose own initialize failed never initialized
    // successfully — no finalize for it, and no later stage ran at all.
    expect(events).not.toContain("finalize:omega-failing-init");
    expect(events.filter(event => event.startsWith("finalize:"))).toEqual([
      "finalize:beta",
      "finalize:alpha",
    ]);
    expect(events.some(event => event.startsWith("collectResources:"))).toBe(
      false
    );
    expect(events.some(event => event.startsWith("generate:"))).toBe(false);
  });
});
