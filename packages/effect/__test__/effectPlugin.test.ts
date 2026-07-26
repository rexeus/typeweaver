import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { HttpMethod, HttpStatusCode } from "@rexeus/typeweaver-core";
import { createPluginTestKit } from "@rexeus/typeweaver-gen";
import type {
  NormalizedSecurity,
  NormalizedSpec,
} from "@rexeus/typeweaver-gen";
import { Effect } from "effect";
import { afterEach, describe, expect, test } from "vitest";
import effectPlugin from "../src/index.js";

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

const temporaryOutput = (): string => {
  const outputDir = fs.mkdtempSync(
    path.join(os.tmpdir(), "typeweaver-effect-test-")
  );
  temporaryDirectories.push(outputDir);
  return outputDir;
};

const noSecurity: NormalizedSecurity = {
  requirements: [],
  source: "none",
};

const normalizedSpec: NormalizedSpec = {
  metadata: { title: "Effect Test API", version: "1.0.0" },
  securitySchemes: [],
  security: noSecurity,
  resources: [
    {
      name: "health",
      tags: [],
      security: noSecurity,
      operations: [
        {
          operationId: "getHealth",
          method: HttpMethod.GET,
          path: "/health",
          summary: "Get health",
          deprecated: false,
          tags: [],
          security: noSecurity,
          responses: [
            {
              responseName: "HealthSuccess",
              source: "inline",
              response: {
                name: "HealthSuccess",
                statusCode: HttpStatusCode.OK,
                statusCodeName: "OK",
                description: "Healthy",
                kind: "response",
              },
            },
          ],
        },
      ],
    },
  ],
  responses: [],
  warnings: [],
};

describe("Effect plugin contract", () => {
  test("depends on server and emits typed adapters without runtime boundaries", () => {
    const kit = createPluginTestKit({
      normalizedSpec,
      outputDir: temporaryOutput(),
    });

    const result = Effect.runSync(kit.run(effectPlugin));
    const source = kit.files.read("health/EffectHealthApiHandler.ts");

    expect(effectPlugin.name).toBe("effect");
    expect(effectPlugin.depends).toEqual(["server"]);
    expect(result.generatedFiles).toContain("health/EffectHealthApiHandler.ts");
    expect(source).toContain(
      "EffectRequestHandler<IGetHealthRequest, GetHealthResponse"
    );
    expect(source).toContain("adaptHealthEffectHandlers");
    expect(source).not.toContain("ManagedRuntime.make");
    expect(source).not.toContain("Effect.runPromise");
  });

  test("owns the only managed runtime at the adapter factory boundary", () => {
    const testDirectory = path.dirname(fileURLToPath(import.meta.url));
    const source = fs.readFileSync(
      path.join(testDirectory, "..", "src", "runtime.ts"),
      "utf8"
    );

    expect(source.match(/ManagedRuntime\.make/gu)).toHaveLength(1);
    expect(source).not.toContain("Effect.runPromise");
    expect(source).toContain("runtime.runPromiseExit");
  });
});
