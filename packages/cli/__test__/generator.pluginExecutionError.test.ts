import fs from "node:fs";
import path from "node:path";
import type { PluginExecutionPhase } from "@rexeus/typeweaver-gen";
import { PluginExecutionError } from "@rexeus/typeweaver-gen";
import { Cause, Effect, Exit, Option } from "effect";
import { afterEach, describe, expect, test } from "vitest";
import { effectRuntime } from "../src/effectRuntime.js";
import { Generator } from "../src/services/Generator.js";

const tempDirs: string[] = [];

const createTempWorkspace = (): string => {
  const tempDir = fs.mkdtempSync(
    path.join(process.cwd(), ".typeweaver-phase-error-")
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

const writePhaseFailingPlugin = (
  workspace: string,
  phase: PluginExecutionPhase
): string => {
  const pluginFile = path.join(
    workspace,
    "plugins",
    "phase-failing-plugin.mjs"
  );
  fs.mkdirSync(path.dirname(pluginFile), { recursive: true });
  fs.writeFileSync(
    pluginFile,
    [
      'import { Effect } from "effect";',
      'import { PluginExecutionError } from "@rexeus/typeweaver-gen";',
      "",
      "const failWith = phase =>",
      "  Effect.fail(new PluginExecutionError({",
      '    pluginName: "phase-failing-plugin",',
      "    phase,",
      '    cause: new Error("boom"),',
      "  }));",
      "",
      "export const phaseFailingPlugin = {",
      '  name: "phase-failing-plugin",',
      `  ${phase}: ${phase === "collectResources" ? "normalizedSpec" : "_context"} => failWith(${JSON.stringify(phase)}),`,
      "};",
      "",
    ].join("\n")
  );
  return pluginFile;
};

const expectedCauseFor = (phase: PluginExecutionPhase) => ({
  phase,
  pluginName: "phase-failing-plugin",
});

const runPhaseFailingGeneration = async (
  phase: PluginExecutionPhase
): Promise<Exit.Exit<unknown, unknown>> => {
  const workspace = createTempWorkspace();
  const pluginFile = writePhaseFailingPlugin(workspace, phase);
  writeTinySpec(workspace);

  return effectRuntime.runPromiseExit(
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
};

const cleanupTempDirs = (): void => {
  for (const tempDir of tempDirs) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
  tempDirs.length = 0;
};

describe("Generator.generate surfaces PluginExecutionError for hard-fail phases", () => {
  afterEach(cleanupTempDirs);

  // `finalize` is excluded here: under the post-fix contract a finalize
  // failure surfaces at WARN instead of failing the run, so the original
  // pipeline error (or success) is preserved for callers. See the
  // best-effort cleanup describe below for the WARN assertion.
  const failingPhases: readonly PluginExecutionPhase[] = [
    "initialize",
    "collectResources",
    "generate",
  ];

  test.each(failingPhases)(
    "fails the run with a PluginExecutionError tagged with phase '%s'",
    async phase => {
      const exit = await runPhaseFailingGeneration(phase);

      expect(Exit.isFailure(exit)).toBe(true);
      if (!Exit.isFailure(exit)) return;

      const failure = Cause.failureOption(exit.cause);
      expect(Option.isSome(failure)).toBe(true);
      if (!Option.isSome(failure)) return;

      expect(failure.value).toBeInstanceOf(PluginExecutionError);
      expect(failure.value).toMatchObject(expectedCauseFor(phase));
    }
  );
});

describe("Generator.generate treats finalize as best-effort cleanup", () => {
  afterEach(cleanupTempDirs);

  test("does not fail the run when only finalize fails; the failure surfaces via the WARN log", async () => {
    const exit = await runPhaseFailingGeneration("finalize");
    expect(Exit.isSuccess(exit)).toBe(true);
  });
});
