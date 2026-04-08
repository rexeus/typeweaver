import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import type { NormalizedSpec } from "../src/NormalizedSpec.js";
import { createPluginContextBuilder } from "../src/plugins/pluginContext.js";

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
      importerDir: path.join("C:", "project", "generated", "todo"),
    });

    expect(specImportPath).toBe("../spec/spec.js");
    expect(specImportPath).not.toContain("\\");
  });

  test("returns a POSIX spec import path for deeper nested directories", () => {
    const generatorContext = pluginContextBuilder.createGeneratorContext({
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
      importerDir: path.join("C:", "project", "generated", "todo", "validators", "nested"),
    });

    expect(specImportPath).toBe("../../../spec/spec.js");
    expect(specImportPath).not.toContain("\\");
  });
});
