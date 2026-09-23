import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { MissingCanonicalResponseError } from "../../../../src/plugins/errors/MissingCanonicalResponseError.js";
import {
  aBuilder,
  aGeneratedProjectContext,
  generatedProjectParams,
  removeTempDirs,
  validationErrorResponse,
} from "./fixtures.js";

afterEach(removeTempDirs);

describe("createPluginContextBuilder context metadata and imports", () => {
  test("creates plugin contexts with the configured directories and config", () => {
    const pluginContext = aBuilder().createPluginContext({
      outputDir: path.join("project", "generated"),
      inputDir: path.join("project", "definitions"),
      config: { emitRuntimeTypes: true },
    });

    expect(pluginContext).toEqual({
      outputDir: path.join("project", "generated"),
      inputDir: path.join("project", "definitions"),
      config: { emitRuntimeTypes: true },
    });
  });

  test("exposes configured generator metadata unchanged", () => {
    const generatorContext = aGeneratedProjectContext();

    expect({
      outputDir: generatorContext.outputDir,
      inputDir: generatorContext.inputDir,
      config: generatorContext.config,
      normalizedSpec: generatorContext.normalizedSpec,
      coreDir: generatorContext.coreDir,
      responsesOutputDir: generatorContext.responsesOutputDir,
      specOutputDir: generatorContext.specOutputDir,
    }).toEqual({
      outputDir: generatedProjectParams.outputDir,
      inputDir: generatedProjectParams.inputDir,
      config: generatedProjectParams.config,
      normalizedSpec: generatedProjectParams.normalizedSpec,
      coreDir: generatedProjectParams.coreDir,
      responsesOutputDir: generatedProjectParams.responsesOutputDir,
      specOutputDir: generatedProjectParams.specOutputDir,
    });
  });

  test.each([
    {
      scenario: "sibling resource directory",
      importerDir: path.join("project", "generated", "todo"),
      expected: "../spec/spec.js",
    },
    {
      scenario: "deeply nested generated directory",
      importerDir: path.join(
        "project",
        "generated",
        "todo",
        "validators",
        "nested"
      ),
      expected: "../../../spec/spec.js",
    },
    {
      scenario: "same spec output directory",
      importerDir: path.join("project", "generated", "spec"),
      expected: "./spec.js",
    },
  ])(
    "returns a POSIX spec import path from a $scenario",
    ({ importerDir, expected }) => {
      const generatorContext = aGeneratedProjectContext();

      const specImportPath = generatorContext.getSpecImportPath({
        importerDir,
      });

      expect(specImportPath).toBe(expected);
      expect(specImportPath).not.toContain("\\");
    }
  );

  test.each([
    {
      scenario: "same responses directory",
      importerDir: path.join("project", "generated", "responses"),
      expected: "./ValidationErrorResponse.js",
    },
    {
      scenario: "nested resource directory",
      importerDir: path.join("project", "generated", "todo", "validators"),
      expected: "../../responses/ValidationErrorResponse.js",
    },
    {
      scenario: "parent generated directory",
      importerDir: path.join("project", "generated"),
      expected: "./responses/ValidationErrorResponse.js",
    },
  ])(
    "returns a POSIX canonical response import path from a $scenario",
    ({ importerDir, expected }) => {
      const generatorContext = aGeneratedProjectContext();

      const responseImportPath =
        generatorContext.getCanonicalResponseImportPath({
          importerDir,
          responseName: "validationError",
        });

      expect(responseImportPath).toBe(expected);
      expect(responseImportPath).not.toContain("\\");
    }
  );
});

describe("createPluginContextBuilder canonical response metadata", () => {
  test("names canonical response output files with PascalCase response names under the responses output directory", () => {
    const generatorContext = aGeneratedProjectContext();

    const outputFile =
      generatorContext.getCanonicalResponseOutputFile("validationError");

    expect(outputFile).toBe(
      path.join(
        "project",
        "generated",
        "responses",
        "ValidationErrorResponse.ts"
      )
    );
  });

  test("returns canonical response definitions by normalized response name", () => {
    const generatorContext = aGeneratedProjectContext();

    const response = generatorContext.getCanonicalResponse("validationError");

    expect(response).toBe(validationErrorResponse);
  });

  test("reports the missing canonical response name", () => {
    const generatorContext = aGeneratedProjectContext();

    const readMissingResponse = () =>
      generatorContext.getCanonicalResponse("unauthorized");

    expect(readMissingResponse).toThrowError(MissingCanonicalResponseError);
    expect(readMissingResponse).toThrowError(
      "Missing canonical response 'unauthorized' in the normalized spec."
    );

    // Discriminating field assertion: the tagged error carries the missing
    // response name so a downstream handler can report which key was
    // requested, not just that something was missing.
    let captured: MissingCanonicalResponseError | undefined;
    try {
      readMissingResponse();
    } catch (error) {
      if (error instanceof MissingCanonicalResponseError) captured = error;
    }
    expect(captured?.responseName).toBe("unauthorized");
  });
});

describe("createPluginContextBuilder operation output paths", () => {
  test.each([
    {
      scenario: "camelCase operation id",
      operationId: "getTodo",
      fileBase: "GetTodo",
    },
    {
      scenario: "PascalCase operation id",
      operationId: "GetTodo",
      fileBase: "GetTodo",
    },
    {
      scenario: "operation id with numeric segment",
      operationId: "getV2Todo",
      fileBase: "GetV2Todo",
    },
  ])(
    "names $scenario outputs with PascalCase TypeScript file names",
    ({ operationId, fileBase }) => {
      const paths = aGeneratedProjectContext().getOperationOutputPaths({
        resourceName: "todo",
        operationId,
      });

      expect({
        requestFileName: paths.requestFileName,
        responseFileName: paths.responseFileName,
        requestValidationFileName: paths.requestValidationFileName,
        responseValidationFileName: paths.responseValidationFileName,
        clientFileName: paths.clientFileName,
      }).toEqual({
        requestFileName: `${fileBase}Request.ts`,
        responseFileName: `${fileBase}Response.ts`,
        requestValidationFileName: `${fileBase}RequestValidator.ts`,
        responseValidationFileName: `${fileBase}ResponseValidator.ts`,
        clientFileName: `${fileBase}Client.ts`,
      });
    }
  );

  test("places operation output files under the resource output directory", () => {
    const paths = aGeneratedProjectContext().getOperationOutputPaths({
      resourceName: "todo",
      operationId: "getTodo",
    });

    const outputDir = path.join("project", "generated", "todo");
    expect({
      outputDir: paths.outputDir,
      requestFile: paths.requestFile,
      responseFile: paths.responseFile,
      requestValidationFile: paths.requestValidationFile,
      responseValidationFile: paths.responseValidationFile,
      clientFile: paths.clientFile,
    }).toEqual({
      outputDir,
      requestFile: path.join(outputDir, "GetTodoRequest.ts"),
      responseFile: path.join(outputDir, "GetTodoResponse.ts"),
      requestValidationFile: path.join(outputDir, "GetTodoRequestValidator.ts"),
      responseValidationFile: path.join(
        outputDir,
        "GetTodoResponseValidator.ts"
      ),
      clientFile: path.join(outputDir, "GetTodoClient.ts"),
    });
  });
});
