import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { createPluginContextBuilder } from "../src/plugins/pluginContext.js";
import type { NormalizedSpec } from "../src/NormalizedSpec.js";

const normalizedSpec: NormalizedSpec = {
  resources: [],
  responses: [],
};

describe("createPluginContextBuilder", () => {
  const pluginContextBuilder = createPluginContextBuilder();

  afterEach(() => {
    pluginContextBuilder.clearGeneratedFiles();
  });

  test("returns a POSIX spec import path for sibling directories", () => {
    const generatorContext = pluginContextBuilder.createGeneratorContext({
      pluginName: "types",
      outputDir: path.join("C:", "project", "generated"),
      inputDir: path.join("C:", "project", "definitions"),
      config: {},
      normalizedSpec,
      templateDir: path.join("C:", "project", "templates"),
      coreDir: "@rexeus/typeweaver-core",
      responsesOutputDir: path.join("C:", "project", "generated", "responses"),
      specOutputDir: path.join("C:", "project", "generated", "spec"),
    });

    const specImportPath = generatorContext.getSpecImportPath({
      importerDir: path.join("C:", "project", "generated", "types", "todo"),
    });

    expect(specImportPath).toBe("../../spec/spec.js");
    expect(specImportPath).not.toContain("\\");
  });

  test("returns a POSIX spec import path for deeper nested directories", () => {
    const generatorContext = pluginContextBuilder.createGeneratorContext({
      pluginName: "types",
      outputDir: path.join("C:", "project", "generated"),
      inputDir: path.join("C:", "project", "definitions"),
      config: {},
      normalizedSpec,
      templateDir: path.join("C:", "project", "templates"),
      coreDir: "@rexeus/typeweaver-core",
      responsesOutputDir: path.join("C:", "project", "generated", "responses"),
      specOutputDir: path.join("C:", "project", "generated", "spec"),
    });

    const specImportPath = generatorContext.getSpecImportPath({
      importerDir: path.join(
        "C:",
        "project",
        "generated",
        "types",
        "todo",
        "validators",
        "nested"
      ),
    });

    expect(specImportPath).toBe("../../../../spec/spec.js");
    expect(specImportPath).not.toContain("\\");
  });

  test("returns plugin-aware output and import paths", () => {
    const generatorContext = pluginContextBuilder.createGeneratorContext({
      pluginName: "clients",
      outputDir: path.join("C:", "project", "generated"),
      inputDir: path.join("C:", "project", "definitions"),
      config: {},
      normalizedSpec,
      templateDir: path.join("C:", "project", "templates"),
      coreDir: "@rexeus/typeweaver-core",
      responsesOutputDir: path.join("C:", "project", "generated", "responses"),
      specOutputDir: path.join("C:", "project", "generated", "spec"),
    });

    const clientOutputPaths = generatorContext.getOperationOutputPaths({
      resourceName: "todo",
      operationId: "getTodo",
    });
    const typeImportPaths = generatorContext.getOperationImportPaths({
      importerDir: clientOutputPaths.outputDir,
      pluginName: "types",
      resourceName: "todo",
      operationId: "getTodo",
    });

    expect(clientOutputPaths.outputDir).toBe(
      path.join("C:", "project", "generated", "clients", "todo")
    );
    expect(typeImportPaths.requestFile).toBe(
      "../../types/todo/getTodoRequest.js"
    );
    expect(
      generatorContext.getLibImportPath({
        importerDir: clientOutputPaths.outputDir,
        pluginName: "types",
      })
    ).toBe("../../lib/types/index.js");
  });
});
