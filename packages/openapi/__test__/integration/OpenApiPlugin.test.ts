import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { normalizeSpec } from "@rexeus/typeweaver-gen";
import { createPluginContextBuilder } from "@rexeus/typeweaver-gen";
import { spec } from "test-utils/src/test-project/spec/index.js";
import { OpenApiPlugin } from "../../src/index.js";

describe("OpenApiPlugin", () => {
  const tempDirectories: string[] = [];

  afterEach(() => {
    for (const directory of tempDirectories) {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });

  test("writes a useful OpenAPI artifact for a real normalized spec", () => {
    const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), "typeweaver-openapi-"));
    tempDirectories.push(outputDir);

    const contextBuilder = createPluginContextBuilder();
    const normalizedSpec = normalizeSpec(spec);
    const plugin = new OpenApiPlugin({
      info: {
        title: "Test Utils API",
        version: "0.10.1",
      },
      servers: [{ url: "https://example.test" }],
    });

    const context = contextBuilder.createGeneratorContext({
      pluginName: "openapi",
      outputDir,
      inputDir: path.join(outputDir, "input"),
      config: {
        info: {
          title: "Test Utils API",
          version: "0.10.1",
        },
        servers: [{ url: "https://example.test" }],
      },
      normalizedSpec,
      templateDir: outputDir,
      coreDir: "@rexeus/typeweaver-core",
      responsesOutputDir: path.join(outputDir, "responses"),
      specOutputDir: path.join(outputDir, "spec"),
    });

    plugin.generate(context);

    const artifactPath = path.join(outputDir, "openapi", "openapi.json");
    const document = JSON.parse(fs.readFileSync(artifactPath, "utf8")) as Record<string, unknown>;
    const paths = document.paths as Record<string, Record<string, unknown>>;
    const components = document.components as {
      readonly schemas: Record<string, unknown>;
      readonly responses: Record<string, unknown>;
    };

    expect(document).toMatchObject({
      openapi: "3.1.1",
      info: {
        title: "Test Utils API",
        version: "0.10.1",
      },
      servers: [{ url: "https://example.test" }],
    });
    expect(paths["/todos/{todoId}"]).toBeDefined();
    expect(paths["/todos/{todoId}"]?.get).toMatchObject({
      operationId: expect.any(String),
      summary: expect.any(String),
    });
    expect(Object.keys(components.schemas).length).toBeGreaterThan(0);
    expect(Object.keys(components.responses).length).toBeGreaterThan(0);
  });
});
