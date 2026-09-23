import fs from "node:fs";
import path from "node:path";
import { Cause, Effect, Exit, Fiber } from "effect";
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

const causeDefects = (cause: Cause.Cause<unknown>): ReadonlyArray<unknown> =>
  cause.reasons.filter(Cause.isDieReason).map(reason => reason.defect);

const writeDefectingGeneratePlugin = (workspace: string): string => {
  const eventsFile = path.join(workspace, "lifecycle-events.log");
  const pluginFile = path.join(workspace, "plugins", "omega-defect.mjs");
  fs.mkdirSync(path.dirname(pluginFile), { recursive: true });
  fs.writeFileSync(
    pluginFile,
    [
      'import fs from "node:fs";',
      'import { Effect } from "effect";',
      "",
      `const eventsFile = ${JSON.stringify(eventsFile)};`,
      "const record = stage =>",
      "  Effect.sync(() => {",
      "    fs.appendFileSync(eventsFile, `${stage}:omega-defect\\n`);",
      "  });",
      "",
      "export const omegaDefectPlugin = {",
      '  name: "omega-defect",',
      '  depends: ["beta"],',
      '  initialize: _ctx => record("initialize"),',
      "  generate: _ctx =>",
      "    Effect.gen(function* () {",
      '      yield* record("generate");',
      '      return yield* Effect.die(new Error("intentional generate defect"));',
      "    }),",
      '  finalize: _ctx => record("finalize"),',
      "};",
      "",
    ].join("\n")
  );
  return pluginFile;
};

const writeInterruptibleGeneratePlugin = (
  workspace: string,
  enteredEvent: string
): string => {
  const eventsFile = path.join(workspace, "lifecycle-events.log");
  const pluginFile = path.join(workspace, "plugins", "omega-interrupt.mjs");
  fs.mkdirSync(path.dirname(pluginFile), { recursive: true });
  fs.writeFileSync(
    pluginFile,
    [
      'import fs from "node:fs";',
      'import { Effect } from "effect";',
      "",
      `const eventsFile = ${JSON.stringify(eventsFile)};`,
      `const enteredEvent = ${JSON.stringify(enteredEvent)};`,
      "const record = stage =>",
      "  Effect.sync(() => {",
      "    fs.appendFileSync(eventsFile, `${stage}:omega-interrupt\\n`);",
      "  });",
      "",
      "export const omegaInterruptPlugin = {",
      '  name: "omega-interrupt",',
      '  depends: ["beta"],',
      '  initialize: _ctx => record("initialize"),',
      "  generate: _ctx =>",
      "    Effect.sync(() => {",
      '      fs.appendFileSync(eventsFile, "generate:omega-interrupt\\n");',
      "      process.emit(enteredEvent);",
      "    }).pipe(Effect.andThen(Effect.never)),",
      '  finalize: _ctx => record("finalize"),',
      "};",
      "",
    ].join("\n")
  );
  return pluginFile;
};

const writeDefectingFinalizePlugin = (workspace: string): string => {
  const eventsFile = path.join(workspace, "lifecycle-events.log");
  const pluginFile = path.join(
    workspace,
    "plugins",
    "omega-finalize-defect.mjs"
  );
  fs.mkdirSync(path.dirname(pluginFile), { recursive: true });
  fs.writeFileSync(
    pluginFile,
    [
      'import fs from "node:fs";',
      'import { Effect } from "effect";',
      "",
      `const eventsFile = ${JSON.stringify(eventsFile)};`,
      "const record = stage =>",
      "  Effect.sync(() => {",
      "    fs.appendFileSync(eventsFile, `${stage}:omega-finalize-defect\\n`);",
      "  });",
      "",
      "export const omegaFinalizeDefectPlugin = {",
      '  name: "omega-finalize-defect",',
      '  depends: ["beta"],',
      '  initialize: _ctx => record("initialize"),',
      "  finalize: _ctx =>",
      '    record("finalize").pipe(',
      '      Effect.andThen(Effect.die(new Error("intentional finalize defect")))',
      "    ),",
      "};",
      "",
    ].join("\n")
  );
  return pluginFile;
};

afterEach(removeTempDirs);

describe("Generator plugin lifecycle finalization", () => {
  test("finalizes every initialized plugin in reverse dependency order after a defect", async () => {
    const workspace = createTempWorkspace("finalize-on-defect");
    writeTinySpec(workspace);
    const recordingPlugins = writeRecordingPlugins(workspace);
    const defectingPlugin = writeDefectingGeneratePlugin(workspace);

    const exit = await effectRuntime.runPromiseExit(
      Generator.generate({
        inputFile: "spec/index.ts",
        outputDir: "generated/output",
        config: {
          input: "spec/index.ts",
          output: "generated/output",
          format: false,
          plugins: [...recordingPlugins, defectingPlugin],
        },
        currentWorkingDirectory: workspace,
      })
    );

    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      expect(causeDefects(exit.cause)).toHaveLength(1);
    }
    expect(
      readEvents(workspace).filter(event => event.startsWith("finalize:"))
    ).toEqual(["finalize:omega-defect", "finalize:beta", "finalize:alpha"]);
  });
  test("finalizes every initialized plugin in reverse dependency order after interruption", async () => {
    const workspace = createTempWorkspace("finalize-on-interrupt");
    writeTinySpec(workspace);
    const recordingPlugins = writeRecordingPlugins(workspace);
    const enteredEvent = `typeweaver-test-interrupt-${process.pid}-${Date.now()}`;
    const interruptiblePlugin = writeInterruptibleGeneratePlugin(
      workspace,
      enteredEvent
    );
    const enteredGenerate = new Promise<void>(resolve => {
      process.once(enteredEvent, () => resolve());
    });

    const fiber = effectRuntime.runFork(
      Generator.generate({
        inputFile: "spec/index.ts",
        outputDir: "generated/output",
        config: {
          input: "spec/index.ts",
          output: "generated/output",
          format: false,
          plugins: [...recordingPlugins, interruptiblePlugin],
        },
        currentWorkingDirectory: workspace,
      })
    );
    await enteredGenerate;
    await Effect.runPromise(Fiber.interrupt(fiber));
    const interrupted = await Effect.runPromise(Fiber.await(fiber));

    expect(Exit.isFailure(interrupted)).toBe(true);
    if (Exit.isFailure(interrupted)) {
      expect(Cause.hasInterruptsOnly(interrupted.cause)).toBe(true);
    }
    expect(
      readEvents(workspace).filter(event => event.startsWith("finalize:"))
    ).toEqual(["finalize:omega-interrupt", "finalize:beta", "finalize:alpha"]);
  });
  test("attempts every finalizer before surfacing a finalizer defect", async () => {
    const workspace = createTempWorkspace("finalizer-defect");
    writeTinySpec(workspace);
    const recordingPlugins = writeRecordingPlugins(workspace);
    const defectingFinalizer = writeDefectingFinalizePlugin(workspace);

    const exit = await effectRuntime.runPromiseExit(
      Generator.generate({
        inputFile: "spec/index.ts",
        outputDir: "generated/output",
        config: {
          input: "spec/index.ts",
          output: "generated/output",
          format: false,
          plugins: [...recordingPlugins, defectingFinalizer],
        },
        currentWorkingDirectory: workspace,
      })
    );

    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      expect(causeDefects(exit.cause)).toHaveLength(1);
    }
    expect(
      readEvents(workspace).filter(event => event.startsWith("finalize:"))
    ).toEqual([
      "finalize:omega-finalize-defect",
      "finalize:beta",
      "finalize:alpha",
    ]);
  });
});
