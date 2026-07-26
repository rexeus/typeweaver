import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { HttpMethod } from "@rexeus/typeweaver-core";
import { createPluginTestKit } from "@rexeus/typeweaver-gen";
import type {
  NormalizedOperation,
  NormalizedRequest,
  NormalizedSecurity,
  NormalizedSpec,
} from "@rexeus/typeweaver-gen";
import { Effect } from "effect";
import { afterEach, describe, expect, test } from "vitest";
import { z } from "zod";
import commandPlugin from "../src/index.js";

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

const temporaryOutput = (): string => {
  const outputDir = fs.mkdtempSync(
    path.join(os.tmpdir(), "typeweaver-command-test-")
  );
  temporaryDirectories.push(outputDir);
  return outputDir;
};

const noSecurity: NormalizedSecurity = {
  requirements: [],
  source: "none",
};

const operation = (
  operationId: string,
  request?: NormalizedRequest
): NormalizedOperation => ({
  operationId,
  method: HttpMethod.GET,
  path: request?.param === undefined ? "/health" : "/health/:healthId",
  summary: `Run ${operationId}`,
  deprecated: false,
  tags: [],
  security: noSecurity,
  ...(request === undefined ? {} : { request }),
  responses: [],
});

const normalizedSpec = (
  operations: readonly NormalizedOperation[]
): NormalizedSpec => ({
  metadata: { title: "Command Test API", version: "1.0.0" },
  securitySchemes: [],
  security: noSecurity,
  resources: [
    {
      name: "health",
      tags: [],
      security: noSecurity,
      operations,
    },
  ],
  responses: [],
  warnings: [],
});

describe("command plugin contract", () => {
  test("depends on generated clients and emits one adapter per operation", () => {
    const spec = normalizedSpec([
      operation("getHealth", {
        param: z.object({ healthId: z.string() }),
        query: z.object({ verbose: z.string().optional() }),
      }),
    ]);
    const outputDir = temporaryOutput();
    const kit = createPluginTestKit({ normalizedSpec: spec, outputDir });

    const result = Effect.runSync(kit.run(commandPlugin));

    expect(commandPlugin.name).toBe("command");
    expect(commandPlugin.depends).toEqual(["clients"]);
    expect(result.generatedFiles).toContain(
      "command/operations/GetHealthCommand.ts"
    );
    expect(result.generatedFiles).toContain("command/cli.mts");
    expect(kit.files.read("command/operations/GetHealthCommand.ts")).toContain(
      '"get-health"'
    );
  });

  test("reports reserved command names with a stable issue", () => {
    const spec = normalizedSpec([operation("help")]);
    const kit = createPluginTestKit({
      normalizedSpec: spec,
      outputDir: temporaryOutput(),
    });

    const result = Effect.runSync(kit.run(commandPlugin));

    expect(result.issues).toContainEqual({
      code: "TW-PLUGIN-COMMAND-001",
      severity: "error",
      message: "Operation 'help' maps to reserved command name 'help'.",
      path: "/resources/0/operations/0/operationId",
      hint: "Rename the operation ID so its kebab-case command is not reserved.",
      fixable: false,
    });
  });

  test("reports command and flag collisions deterministically", () => {
    const spec = normalizedSpec([
      operation("getThing"),
      operation("GetThing"),
      operation("queryHealth", {
        query: z.object({
          userId: z.string(),
          UserId: z.string(),
        }),
      }),
    ]);
    const kit = createPluginTestKit({
      normalizedSpec: spec,
      outputDir: temporaryOutput(),
    });

    const result = Effect.runSync(kit.run(commandPlugin));

    expect(result.issues.map(issue => issue.code)).toEqual([
      "TW-PLUGIN-COMMAND-002",
      "TW-PLUGIN-COMMAND-003",
    ]);
    expect(result.issues.map(issue => issue.path)).toEqual([
      "/resources/0/operations/1/operationId",
      "/resources/0/operations/2/request/query",
    ]);
  });
});
