import path from "node:path";
import { HttpMethod, HttpStatusCode } from "@rexeus/typeweaver-core";
import type { GeneratorContext, NormalizedSpec } from "@rexeus/typeweaver-gen";
import { describe, expect, test } from "vitest";
import { z } from "zod";
import { ResponseGenerator } from "../../src/ResponseGenerator";

describe("ResponseGenerator", () => {
  test("emits canonical responses separately from inline operation responses", () => {
    const writtenFiles = new Map<string, string>();
    const normalizedSpec: NormalizedSpec = {
      responses: [
        {
          name: "SharedError",
          kind: "response",
          statusCode: HttpStatusCode.BAD_REQUEST,
          statusCodeName: "BAD_REQUEST",
          description: "Shared error",
          body: z.object({ message: z.string() }),
        },
      ],
      resources: [
        {
          name: "todos",
          operations: [
            {
              operationId: "createTodo",
              method: HttpMethod.POST,
              path: "/todos",
              summary: "Create todo",
              request: undefined,
              responses: [
                {
                  responseName: "SharedError",
                  source: "canonical",
                },
                {
                  responseName: "CreateTodoSuccess",
                  source: "inline",
                  response: {
                    name: "CreateTodoSuccess",
                    kind: "response",
                    statusCode: HttpStatusCode.CREATED,
                    statusCodeName: "CREATED",
                    description: "Created",
                    body: z.object({ id: z.string() }),
                  },
                },
              ],
            },
          ],
        },
      ],
    };

    const context = {
      outputDir: "/out",
      inputDir: "/in",
      config: {},
      normalizedSpec,
      templateDir: "/templates",
      coreDir: "@rexeus/typeweaver-core",
      responsesOutputDir: "/out/responses",
      specOutputDir: "/out/spec",
      getCanonicalResponse: () => normalizedSpec.responses[0]!,
      getCanonicalResponseOutputFile: (responseName: string) => {
        return path.join("/out/responses", `${responseName}Response.ts`);
      },
      getCanonicalResponseImportPath: ({
        responseName,
      }: {
        responseName: string;
      }) => {
        return `../responses/${responseName}Response`;
      },
      getOperationDefinitionImportPath: () =>
        "../../spec/todos/createTodoDefinition",
      getOperationOutputPaths: ({
        operationId,
        resourceName,
      }: {
        readonly operationId: string;
        readonly resourceName: string;
      }) => {
        const outputDir = path.join("/out", resourceName);

        return {
          outputDir,
          requestFile: path.join(outputDir, `${operationId}Request.ts`),
          requestFileName: `${operationId}Request.ts`,
          responseFile: path.join(outputDir, `${operationId}Response.ts`),
          responseFileName: `${operationId}Response.ts`,
          requestValidationFile: path.join(
            outputDir,
            `${operationId}RequestValidator.ts`
          ),
          requestValidationFileName: `${operationId}RequestValidator.ts`,
          responseValidationFile: path.join(
            outputDir,
            `${operationId}ResponseValidator.ts`
          ),
          responseValidationFileName: `${operationId}ResponseValidator.ts`,
          clientFile: path.join(outputDir, `${operationId}Client.ts`),
          clientFileName: `${operationId}Client.ts`,
        };
      },
      getResourceOutputDir: (resourceName: string) =>
        path.join("/out", resourceName),
      writeFile: (relativePath: string, content: string) => {
        writtenFiles.set(relativePath, content);
      },
      renderTemplate: (_templatePath: string, data: unknown) =>
        JSON.stringify(data),
      addGeneratedFile: () => {},
      getGeneratedFiles: () => [],
    } satisfies GeneratorContext;

    ResponseGenerator.generate(context);

    const sharedResponseContent = writtenFiles.get(
      "responses/SharedErrorResponse.ts"
    );
    const operationResponseContent = writtenFiles.get(
      "todos/createTodoResponse.ts"
    );

    expect(sharedResponseContent).toBeDefined();
    expect(operationResponseContent).toBeDefined();

    expect(JSON.parse(sharedResponseContent!)).toEqual(
      expect.objectContaining({
        pascalCaseName: "SharedError",
        sharedResponse: expect.objectContaining({
          name: "SharedError",
          statusCode: HttpStatusCode.BAD_REQUEST,
        }),
      })
    );
    expect(JSON.parse(operationResponseContent!)).toEqual(
      expect.objectContaining({
        operationId: "createTodo",
        ownResponses: [
          expect.objectContaining({
            name: "CreateTodoSuccess",
            statusCode: HttpStatusCode.CREATED,
          }),
        ],
        sharedResponses: [
          {
            name: "SharedError",
            path: "../responses/SharedErrorResponse",
          },
        ],
      })
    );
  });
});
