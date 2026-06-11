import fs from "node:fs";
import path from "node:path";
import { withCapturedLogs } from "test-utils";
import { afterEach, describe, expect, test } from "vitest";
import { effectRuntime } from "../src/effectRuntime.js";
import { Generator } from "../src/services/Generator.js";

const tempDirs: string[] = [];

const createTempWorkspace = (): string => {
  const tempDir = fs.mkdtempSync(
    path.join(process.cwd(), ".typeweaver-genlogs-")
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

describe("Generator Generated-file logging", () => {
  afterEach(() => {
    for (const tempDir of tempDirs) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    tempDirs.length = 0;
  });

  test("routes Generated: lines through the Effect logger pipeline", async () => {
    const workspace = createTempWorkspace();
    writeTinySpec(workspace);

    const { logs } = await effectRuntime.runPromise(
      withCapturedLogs(
        Generator.generate({
          inputFile: "spec/index.ts",
          outputDir: "generated/output",
          config: {
            input: "spec/index.ts",
            output: "generated/output",
            format: false,
            clean: true,
          },
          currentWorkingDirectory: workspace,
        })
      )
    );

    const messages = logs.map(log => log.message);
    const generatedLines = messages.filter(message =>
      message.startsWith("Generated: ")
    );

    // The sync writeFile callback queues these lines; the orchestrator
    // flushes them via Effect.logInfo, so a capturing logger layer must
    // observe them — previously they bypassed the pipeline via console.info.
    expect(generatedLines.length).toBeGreaterThan(0);
    expect(generatedLines).toContain("Generated: index.ts");

    // Plugin writes surface after that plugin's "Running plugin" line.
    const runningPluginIndex = messages.indexOf("Running plugin: types");
    const firstGeneratedIndex = messages.findIndex(message =>
      message.startsWith("Generated: ")
    );
    expect(runningPluginIndex).toBeGreaterThanOrEqual(0);
    expect(firstGeneratedIndex).toBeGreaterThan(runningPluginIndex);
  });
});
