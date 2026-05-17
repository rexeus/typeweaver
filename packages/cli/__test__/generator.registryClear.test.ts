import fs from "node:fs";
import path from "node:path";
import { Effect, Logger } from "effect";
import { afterEach, describe, expect, test } from "vitest";
import { effectRuntime } from "../src/effectRuntime.js";
import { Generator } from "../src/services/Generator.js";

type CapturedLog = {
  readonly level: string;
  readonly message: string;
};

const tempDirs: string[] = [];

const createTempWorkspace = (label: string): string => {
  const tempDir = fs.mkdtempSync(
    path.join(process.cwd(), `.typeweaver-registry-clear-${label}-`)
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

const renderMessage = (message: unknown): string =>
  Array.isArray(message) ? message.map(String).join(" ") : String(message);

// Provides a layer that appends every log line into `sink` while the
// generator runs through the shared `effectRuntime`. The default
// CliLoggerLayer is replaced for the duration of the run.
const capturingLogger = (sink: CapturedLog[]) =>
  Logger.replace(
    Logger.defaultLogger,
    Logger.make<unknown, void>(({ message, logLevel }) => {
      sink.push({
        level: logLevel.label,
        message: renderMessage(message),
      });
    })
  );

describe("Generator.generate (registry-clear-per-call invariant)", () => {
  afterEach(() => {
    for (const tempDir of tempDirs) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    tempDirs.length = 0;
  });

  test("does not log duplicate-registration warnings across sequential invocations", async () => {
    const workspace = createTempWorkspace("seq");
    writeTinySpec(workspace);

    const logsFirst: CapturedLog[] = [];
    const logsSecond: CapturedLog[] = [];

    const run = (sink: CapturedLog[]): Promise<void> =>
      effectRuntime.runPromise(
        Generator.generate({
          inputFile: "spec/index.ts",
          outputDir: "generated/output",
          config: {
            input: "spec/index.ts",
            output: "generated/output",
            format: false,
          },
          currentWorkingDirectory: workspace,
        }).pipe(Effect.provide(capturingLogger(sink)))
      );

    await run(logsFirst);
    await run(logsSecond);

    const isDuplicateRegistrationWarning = (entry: CapturedLog): boolean =>
      entry.level === "WARN" && entry.message.includes("is already registered");

    expect(logsFirst.some(isDuplicateRegistrationWarning)).toBe(false);
    expect(logsSecond.some(isDuplicateRegistrationWarning)).toBe(false);

    // Also assert: the second run still registers plugins (i.e. the
    // registry was cleared first; otherwise the second `register` would
    // short-circuit on the same names and emit no "Registered plugin"
    // info lines).
    const registeredCount = (sink: CapturedLog[]): number =>
      sink.filter(
        entry =>
          entry.level === "INFO" &&
          entry.message.startsWith("Registered plugin:")
      ).length;

    expect(registeredCount(logsFirst)).toBeGreaterThan(0);
    expect(registeredCount(logsSecond)).toBe(registeredCount(logsFirst));
  });
});
