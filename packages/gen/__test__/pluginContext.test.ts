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
      importerDir: path.join(
        "C:",
        "project",
        "generated",
        "todo",
        "validators",
        "nested"
      ),
    });

    expect(specImportPath).toBe("../../../spec/spec.js");
    expect(specImportPath).not.toContain("\\");
  });

  describe("getOperationOutputPaths", () => {
    const createContext = () =>
      pluginContextBuilder.createGeneratorContext({
        outputDir: path.join("project", "generated"),
        inputDir: path.join("project", "definitions"),
        config: {},
        normalizedSpec,
        templateDir: path.join("project", "templates"),
        coreDir: "@rexeus/typeweaver-core",
        responsesOutputDir: path.join("project", "generated", "responses"),
        specOutputDir: path.join("project", "generated", "spec"),
      });

    test.each([
      ["camelCase operation IDs", "optionsTodo"],
      ["PascalCase operation IDs", "OptionsTodo"],
      ["separator-delimited operation IDs", "options-todo"],
    ])("normalizes %s to PascalCase file names", (_label, operationId) => {
      const paths = createContext().getOperationOutputPaths({
        resourceName: "todo",
        operationId,
      });

      expect(paths.requestFileName).toBe("OptionsTodoRequest.ts");
      expect(paths.responseFileName).toBe("OptionsTodoResponse.ts");
      expect(paths.requestValidationFileName).toBe(
        "OptionsTodoRequestValidator.ts"
      );
      expect(paths.responseValidationFileName).toBe(
        "OptionsTodoResponseValidator.ts"
      );
      expect(paths.clientFileName).toBe("OptionsTodoClient.ts");
    });

    test("joins PascalCase file names under the resource output directory", () => {
      const paths = createContext().getOperationOutputPaths({
        resourceName: "todo",
        operationId: "getTodo",
      });

      const expectedDir = path.join("project", "generated", "todo");
      expect(paths.outputDir).toBe(expectedDir);
      expect(paths.requestFile).toBe(
        path.join(expectedDir, "GetTodoRequest.ts")
      );
      expect(paths.clientFile).toBe(path.join(expectedDir, "GetTodoClient.ts"));
    });
  });

  describe("getCanonicalResponseOutputFile", () => {
    test.each([
      ["camelCase response names", "validationError"],
      ["PascalCase response names", "ValidationError"],
    ])("normalizes %s to PascalCase response files", (_label, responseName) => {
      const generatorContext = pluginContextBuilder.createGeneratorContext({
        outputDir: path.join("project", "generated"),
        inputDir: path.join("project", "definitions"),
        config: {},
        normalizedSpec,
        templateDir: path.join("project", "templates"),
        coreDir: "@rexeus/typeweaver-core",
        responsesOutputDir: path.join("project", "generated", "responses"),
        specOutputDir: path.join("project", "generated", "spec"),
      });

      const outputFile =
        generatorContext.getCanonicalResponseOutputFile(responseName);

      expect(outputFile).toBe(
        path.join(
          "project",
          "generated",
          "responses",
          "ValidationErrorResponse.ts"
        )
      );
    });
  });
});
