import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { HttpMethod } from "@rexeus/typeweaver-core";
import { afterEach, describe, expect, test } from "vitest";
import { MissingCanonicalResponseError } from "../src/plugins/errors/MissingCanonicalResponseError.js";
import { createPluginContextBuilder } from "../src/plugins/pluginContext.js";
import type {
  NormalizedResponse,
  NormalizedSpec,
} from "../src/NormalizedSpec.js";

const validationErrorResponse: NormalizedResponse = {
  name: "validationError",
  statusCode: 400,
  statusCodeName: "BadRequest",
  description: "The request failed validation.",
  kind: "response",
};

const todoSpec: NormalizedSpec = {
  resources: [
    {
      name: "todo",
      operations: [
        {
          operationId: "getTodo",
          method: HttpMethod.GET,
          path: "/todos/{todoId}",
          summary: "Get a todo item.",
          responses: [
            {
              source: "canonical",
              responseName: "validationError",
            },
          ],
        },
      ],
    },
  ],
  responses: [validationErrorResponse],
};

type GeneratorContextParams = Parameters<
  ReturnType<typeof createPluginContextBuilder>["createGeneratorContext"]
>[0];

const generatedProjectParams: GeneratorContextParams = {
  outputDir: path.join("project", "generated"),
  inputDir: path.join("project", "definitions"),
  config: { emitRuntimeTypes: true },
  normalizedSpec: todoSpec,
  templateDir: path.join("project", "templates"),
  coreDir: "@rexeus/typeweaver-core",
  responsesOutputDir: path.join("project", "generated", "responses"),
  specOutputDir: path.join("project", "generated", "spec"),
};

const aGeneratedProjectContext = (
  overrides: Partial<GeneratorContextParams> = {}
) =>
  createPluginContextBuilder().createGeneratorContext({
    ...generatedProjectParams,
    ...overrides,
  });

const tempDirs: string[] = [];

const aTempDir = (): string => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "typeweaver-gen-"));
  tempDirs.push(tempDir);
  return tempDir;
};

describe("createPluginContextBuilder", () => {
  afterEach(() => {
    for (const tempDir of tempDirs.splice(0)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test("creates plugin contexts with the configured directories and config", () => {
    const pluginContext = createPluginContextBuilder().createPluginContext({
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
  });

  describe("getOperationOutputPaths", () => {
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
        requestValidationFile: path.join(
          outputDir,
          "GetTodoRequestValidator.ts"
        ),
        responseValidationFile: path.join(
          outputDir,
          "GetTodoResponseValidator.ts"
        ),
        clientFile: path.join(outputDir, "GetTodoClient.ts"),
      });
    });
  });

  test("returns resource output directories under the generator output directory", () => {
    const generatorContext = aGeneratedProjectContext();

    const outputDir = generatorContext.getResourceOutputDir("todo");

    expect(outputDir).toBe(path.join("project", "generated", "todo"));
  });

  test("builds JSON-safe operation definition accessors", () => {
    const generatorContext = aGeneratedProjectContext();

    const accessor = generatorContext.getOperationDefinitionAccessor({
      resourceName: "todo/item",
      operationId: 'get"Todo',
    });

    expect(accessor).toBe(
      'getOperationDefinition(spec, "todo/item", "get\\"Todo")'
    );
  });

  test("writes files relative to the generator output directory and records them", () => {
    const outputDir = aTempDir();
    const generatorContext = aGeneratedProjectContext({ outputDir });
    const generatedFile = path.join("todo", "GetTodoClient.ts");

    generatorContext.writeFile(generatedFile, "export const client = true;\n");

    expect(fs.readFileSync(path.join(outputDir, generatedFile), "utf8")).toBe(
      "export const client = true;\n"
    );
    expect(generatorContext.getGeneratedFiles()).toEqual([generatedFile]);
  });

  test("returns defensive arrays for generated file tracking", () => {
    const generatorContext = aGeneratedProjectContext();

    generatorContext.addGeneratedFile("todo/GetTodoClient.ts");
    const generatedFiles = generatorContext.getGeneratedFiles();

    generatedFiles.push("mutated.ts");

    expect(generatorContext.getGeneratedFiles()).toEqual([
      "todo/GetTodoClient.ts",
    ]);
  });

  test("builder-level clearGeneratedFiles clears files added through a context", () => {
    const pluginContextBuilder = createPluginContextBuilder();
    const generatorContext = pluginContextBuilder.createGeneratorContext(
      generatedProjectParams
    );

    generatorContext.addGeneratedFile("todo/GetTodoClient.ts");
    expect(pluginContextBuilder.getGeneratedFiles()).toEqual([
      "todo/GetTodoClient.ts",
    ]);

    pluginContextBuilder.clearGeneratedFiles();

    expect(generatorContext.getGeneratedFiles()).toEqual([]);
    expect(pluginContextBuilder.getGeneratedFiles()).toEqual([]);
  });

  test("renders relative template paths from the configured template directory", () => {
    const templateDir = aTempDir();
    fs.writeFileSync(
      path.join(templateDir, "message.ejs"),
      "Hello <%= name %>!"
    );
    const generatorContext = aGeneratedProjectContext({ templateDir });

    const result = generatorContext.renderTemplate("message.ejs", {
      name: "Ada",
    });

    expect(result).toBe("Hello Ada!");
  });

  test("renders absolute template paths without prefixing the template directory", () => {
    const templateDir = aTempDir();
    const absoluteTemplatePath = path.join(aTempDir(), "absolute.ejs");
    fs.writeFileSync(path.join(templateDir, "absolute.ejs"), "wrong template");
    fs.writeFileSync(absoluteTemplatePath, "Absolute <%= name %>");
    const generatorContext = aGeneratedProjectContext({ templateDir });

    const result = generatorContext.renderTemplate(absoluteTemplatePath, {
      name: "template",
    });

    expect(result).toBe("Absolute template");
  });

  test.each([
    { scenario: "null data", data: null },
    { scenario: "undefined data", data: undefined },
  ])("renders static templates with $scenario as empty data", ({ data }) => {
    const templateDir = aTempDir();
    fs.writeFileSync(path.join(templateDir, "static.ejs"), "static output");
    const generatorContext = aGeneratedProjectContext({ templateDir });

    const result = generatorContext.renderTemplate("static.ejs", data);

    expect(result).toBe("static output");
  });
});
