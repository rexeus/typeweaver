import fs from "node:fs";
import path from "node:path";
import { Cause, Effect, Exit } from "effect";
import { afterEach, describe, expect, test } from "vitest";
import { effectRuntime } from "../../../src/effectRuntime.js";
import { Generator } from "../../../src/services/Generator.js";
import { withCapturedLogs } from "../../helpers/index.js";
import { writeTinySpec } from "../../helpers/specFiles.js";
import { createTempWorkspace, readEvents, removeTempDirs } from "./fixtures.js";

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
      "    fs.appendFileSync(eventsFile, stage + ':' + pluginName + '\\n');",
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
      "    fs.appendFileSync(eventsFile, stage + ':' + pluginName + '\\n');",
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

afterEach(removeTempDirs);

describe("Generator plugin lifecycle failure reporting", () => {
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

    const failure = Cause.findErrorOption(innerExit.cause);
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
        log.level === "Warn" &&
        log.message.includes("betaFinalize") &&
        log.message.includes("failed during finalize")
    );
    expect(finalizeWarn).toBeDefined();
  });
});
