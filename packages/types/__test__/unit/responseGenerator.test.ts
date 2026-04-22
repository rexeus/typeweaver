import path from "node:path";
import { HttpMethod, HttpStatusCode } from "@rexeus/typeweaver-core";
import type { GeneratorContext, NormalizedSpec } from "@rexeus/typeweaver-gen";
import { describe, expect, test } from "vitest";
import { z } from "zod";
import { generate } from "../../src/responseGenerator.js";

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
      getSpecImportPath: () => "../spec/spec",
      getOperationDefinitionAccessor: ({
        operationId,
        resourceName,
      }: {
        readonly operationId: string;
        readonly resourceName: string;
      }) => {
        return `spec.resources[${JSON.stringify(resourceName)}]!.operations.find(operation => operation.operationId === ${JSON.stringify(operationId)})!`;
      },
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

    generate(context);

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

  test("emits response helpers for all four signature variants: header+body, header-only, body-only, neither", () => {
    const writtenFiles = new Map<string, string>();
    const normalizedSpec: NormalizedSpec = {
      responses: [
        {
          name: "SharedBodyOnly",
          kind: "response",
          statusCode: HttpStatusCode.OK,
          statusCodeName: "OK",
          description: "Shared body-only response",
          body: z.object({ message: z.string() }),
          // header intentionally omitted
        },
        {
          name: "SharedNeither",
          kind: "response",
          statusCode: HttpStatusCode.NO_CONTENT,
          statusCodeName: "NO_CONTENT",
          description: "Shared neither response",
          // both header and body intentionally omitted
        },
      ],
      resources: [
        {
          name: "todos",
          operations: [
            {
              operationId: "deleteTodo",
              method: HttpMethod.DELETE,
              path: "/todos/:todoId",
              summary: "Delete todo",
              request: undefined,
              responses: [
                {
                  responseName: "SharedBodyOnly",
                  source: "canonical",
                },
                {
                  responseName: "SharedNeither",
                  source: "canonical",
                },
                // Inline header-only response
                {
                  responseName: "InlineHeaderOnly",
                  source: "inline",
                  response: {
                    name: "InlineHeaderOnly",
                    kind: "response",
                    statusCode: HttpStatusCode.ACCEPTED,
                    statusCodeName: "ACCEPTED",
                    description: "Accepted",
                    header: z.object({ "x-request-id": z.string() }),
                    // body intentionally omitted
                  },
                },
                // Inline body-only response
                {
                  responseName: "InlineBodyOnly",
                  source: "inline",
                  response: {
                    name: "InlineBodyOnly",
                    kind: "response",
                    statusCode: HttpStatusCode.OK,
                    statusCodeName: "OK",
                    description: "Success",
                    body: z.object({ id: z.string() }),
                    // header intentionally omitted
                  },
                },
                // Inline neither response
                {
                  responseName: "InlineNeither",
                  source: "inline",
                  response: {
                    name: "InlineNeither",
                    kind: "response",
                    statusCode: HttpStatusCode.NO_CONTENT,
                    statusCodeName: "NO_CONTENT",
                    description: "No content",
                    // both header and body intentionally omitted
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
      coreDir: "@rexeus/typeweaver-core",
      responsesOutputDir: "/out/responses",
      specOutputDir: "/out/spec",
      getCanonicalResponse: (name: string) =>
        normalizedSpec.responses.find((r) => r.name === name)!,
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
      getSpecImportPath: () => "../spec/spec",
      getOperationDefinitionAccessor: ({
        operationId,
        resourceName,
      }: {
        readonly operationId: string;
        readonly resourceName: string;
      }) => {
        return `spec.resources[${JSON.stringify(resourceName)}]!.operations.find(operation => operation.operationId === ${JSON.stringify(operationId)})!`;
      },
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

    generate(context);

    // Verify canonical/shared body-only response is generated correctly
    const sharedBodyOnlyContent = writtenFiles.get(
      "responses/SharedBodyOnlyResponse.ts"
    );
    expect(sharedBodyOnlyContent).toBeDefined();
    const sharedBodyOnlyData = JSON.parse(sharedBodyOnlyContent!);
    expect(sharedBodyOnlyData).toEqual(
      expect.objectContaining({
        pascalCaseName: "SharedBodyOnly",
        sharedResponse: expect.objectContaining({
          name: "SharedBodyOnly",
          statusCode: HttpStatusCode.OK,
        }),
      })
    );
    // Body-only: body is defined, header is undefined/missing
    expect(sharedBodyOnlyData.sharedResponse.body).toBeDefined();
    expect(sharedBodyOnlyData.sharedResponse.header).toBeUndefined();

    // Verify canonical/shared neither response is generated correctly
    const sharedNeitherContent = writtenFiles.get(
      "responses/SharedNeitherResponse.ts"
    );
    expect(sharedNeitherContent).toBeDefined();
    const sharedNeitherData = JSON.parse(sharedNeitherContent!);
    expect(sharedNeitherData).toEqual(
      expect.objectContaining({
        pascalCaseName: "SharedNeither",
        sharedResponse: expect.objectContaining({
          name: "SharedNeither",
          statusCode: HttpStatusCode.NO_CONTENT,
        }),
      })
    );
    // Neither: both body and header are undefined/missing
    expect(sharedNeitherData.sharedResponse.body).toBeUndefined();
    expect(sharedNeitherData.sharedResponse.header).toBeUndefined();

    // Verify operation response includes all response types
    const operationResponseContent = writtenFiles.get(
      "todos/deleteTodoResponse.ts"
    );
    expect(operationResponseContent).toBeDefined();
    const operationData = JSON.parse(operationResponseContent!);

    // Check shared responses
    expect(operationData.sharedResponses).toContainEqual({
      name: "SharedBodyOnly",
      path: "../responses/SharedBodyOnlyResponse",
    });
    expect(operationData.sharedResponses).toContainEqual({
      name: "SharedNeither",
      path: "../responses/SharedNeitherResponse",
    });

    // Check inline responses - body-only
    const inlineBodyOnly = operationData.ownResponses?.find(
      (r: { name: string }) => r.name === "InlineBodyOnly"
    );
    expect(inlineBodyOnly).toBeDefined();
    expect(inlineBodyOnly.statusCode).toBe(HttpStatusCode.OK);
    expect(inlineBodyOnly.body).toBeDefined();
    expect(inlineBodyOnly.header).toBeUndefined();

    // Check inline responses - neither
    const inlineNeither = operationData.ownResponses?.find(
      (r: { name: string }) => r.name === "InlineNeither"
    );
    expect(inlineNeither).toBeDefined();
    expect(inlineNeither.statusCode).toBe(HttpStatusCode.NO_CONTENT);
    expect(inlineNeither.body).toBeUndefined();
    expect(inlineNeither.header).toBeUndefined();

    // Check inline responses - header-only (existing case)
    const inlineHeaderOnly = operationData.ownResponses?.find(
      (r: { name: string }) => r.name === "InlineHeaderOnly"
    );
    expect(inlineHeaderOnly).toBeDefined();
    expect(inlineHeaderOnly.statusCode).toBe(HttpStatusCode.ACCEPTED);
    expect(inlineHeaderOnly.header).toBeDefined();
    expect(inlineHeaderOnly.body).toBeUndefined();
  });
});
