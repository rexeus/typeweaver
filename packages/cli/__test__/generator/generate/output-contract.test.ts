import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import {
  createTempWorkspace,
  expectFileContains,
  expectFileExists,
  generateTypesInWorkspace,
  readFile,
  removeTempDirs,
  runGenerator,
  writeTinySpec,
} from "./fixtures.js";

afterEach(removeTempDirs);

describe("Generator output contract", () => {
  test("generates TypeWeaver output from paths relative to the provided working directory", async () => {
    const workspace = createTempWorkspace();
    writeTinySpec(workspace);
    const outputDir = path.join(workspace, "generated", "output");

    await runGenerator({
      inputFile: "spec/index.ts",
      outputDir: "generated/output",
      config: {
        input: "spec/index.ts",
        output: "generated/output",
      },
      currentWorkingDirectory: workspace,
    });

    expectFileExists(outputDir);
    expectFileExists(path.join(outputDir, "spec", "spec.js"));
    expectFileExists(path.join(outputDir, "spec", "spec.d.ts"));
    expectFileExists(
      path.join(outputDir, "responses", "ItemLoadedResponse.ts")
    );
    expectFileExists(path.join(outputDir, "item", "GetItemRequest.ts"));
    expectFileExists(path.join(outputDir, "item", "GetItemResponse.ts"));
    expectFileExists(
      path.join(outputDir, "item", "GetItemRequestValidator.ts")
    );
    expectFileExists(
      path.join(outputDir, "item", "GetItemResponseValidator.ts")
    );
    expectFileExists(path.join(outputDir, "item", "index.ts"));
    expectFileExists(path.join(outputDir, "responses", "index.ts"));
    expectFileExists(path.join(outputDir, "index.ts"));
    expectFileContains(
      path.join(outputDir, "item", "GetItemRequest.ts"),
      "export type IGetItemRequestParam"
    );
    expectFileContains(
      path.join(outputDir, "responses", "ItemLoadedResponse.ts"),
      "export type IItemLoadedResponse"
    );
  });
});

describe("Generator validator and OpenAPI output", () => {
  test("imports operation definitions in validators generated for schema-backed requests and responses", async () => {
    const workspace = createTempWorkspace();
    writeTinySpec(workspace);

    const outputDir = await generateTypesInWorkspace(workspace);
    const requestValidator = readFile(
      path.join(outputDir, "item", "GetItemRequestValidator.ts")
    );
    const responseValidator = readFile(
      path.join(outputDir, "item", "GetItemResponseValidator.ts")
    );

    expect(requestValidator).toContain(
      'import { spec } from "../spec/spec.js";'
    );
    expect(requestValidator).toContain(
      'getOperationDefinition(spec, "item", "getItem")'
    );
    expect(responseValidator).toContain(
      'import { spec } from "../spec/spec.js";'
    );
    expect(responseValidator).toContain(
      'getOperationDefinition(spec, "item", "getItem")'
    );
  });
  test("generates OpenAPI JSON without adding it to TypeScript barrels", async () => {
    const workspace = createTempWorkspace();
    writeTinySpec(workspace);
    const outputDir = path.join(workspace, "generated", "output");

    await runGenerator({
      inputFile: "spec/index.ts",
      outputDir: "generated/output",
      config: {
        input: "spec/index.ts",
        output: "generated/output",
        format: false,
        plugins: ["openapi"],
      },
      currentWorkingDirectory: workspace,
    });

    const openApiFile = path.join(outputDir, "openapi", "openapi.json");
    const document = JSON.parse(readFile(openApiFile)) as Record<
      string,
      unknown
    >;
    const rootIndex = readFile(path.join(outputDir, "index.ts"));

    expectFileExists(openApiFile);
    expect(document["openapi"]).toBe("3.1.2");
    expect(document["paths"]).toHaveProperty("/items/{itemId}");
    expect(rootIndex).not.toContain("openapi.json");
    expect(rootIndex).not.toContain("./openapi/index.js");
    expect(fs.existsSync(path.join(outputDir, "openapi", "index.ts"))).toBe(
      false
    );
  });
});
