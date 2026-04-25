import { readFileSync } from "node:fs";
import path from "node:path";
import { HttpMethod, HttpStatusCode } from "@rexeus/typeweaver-core";
import { renderTemplate } from "@rexeus/typeweaver-gen";
import type {
  GeneratorContext,
  NormalizedOperation,
  NormalizedResponse,
  NormalizedSpec,
} from "@rexeus/typeweaver-gen";
import { pascalCase } from "polycase";
import { describe, expect, test } from "vitest";
import { z } from "zod";
import { generate } from "../../src/responseGenerator.js";

function aCanonicalResponse(
  overrides: Partial<NormalizedResponse> = {}
): NormalizedResponse {
  return {
    name: "SharedError",
    kind: "response",
    statusCode: HttpStatusCode.BAD_REQUEST,
    statusCodeName: "BAD_REQUEST",
    description: "Shared error",
    body: z.object({ message: z.string() }),
    ...overrides,
  };
}

function anInlineOperationResponse(
  overrides: Partial<NormalizedResponse> = {}
): NormalizedResponse {
  return {
    name: "CreateTodoSuccess",
    kind: "response",
    statusCode: HttpStatusCode.CREATED,
    statusCodeName: "CREATED",
    description: "Created",
    body: z.object({ id: z.string() }),
    ...overrides,
  };
}

function anOperationWithResponses(
  responses: NormalizedOperation["responses"],
  overrides: Partial<NormalizedOperation> = {}
): NormalizedOperation {
  return {
    operationId: "createTodo",
    method: HttpMethod.POST,
    path: "/todos",
    summary: "Create todo",
    request: undefined,
    responses,
    ...overrides,
  };
}

type ResponseGeneratorContextOptions = {
  readonly normalizedSpec: NormalizedSpec;
  readonly renderSource?: boolean;
};

function aResponseGeneratorContext({
  normalizedSpec,
  renderSource = false,
}: ResponseGeneratorContextOptions): {
  readonly context: GeneratorContext;
  readonly writtenFiles: Map<string, string>;
} {
  const writtenFiles = new Map<string, string>();

  const context = {
    outputDir: "/out",
    inputDir: "/in",
    config: {},
    normalizedSpec,
    coreDir: "@rexeus/typeweaver-core",
    responsesOutputDir: "/out/responses",
    specOutputDir: "/out/spec",
    getCanonicalResponse: (name: string) =>
      normalizedSpec.responses.find(response => response.name === name)!,
    getCanonicalResponseOutputFile: (responseName: string) => {
      return path.join(
        "/out/responses",
        `${pascalCase(responseName)}Response.ts`
      );
    },
    getCanonicalResponseImportPath: ({
      responseName,
    }: {
      readonly responseName: string;
    }) => {
      return `../responses/${pascalCase(responseName)}Response`;
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
      const fileBase = pascalCase(operationId);
      const requestFileName = `${fileBase}Request.ts`;
      const responseFileName = `${fileBase}Response.ts`;
      const requestValidationFileName = `${fileBase}RequestValidator.ts`;
      const responseValidationFileName = `${fileBase}ResponseValidator.ts`;
      const clientFileName = `${fileBase}Client.ts`;

      return {
        outputDir,
        requestFile: path.join(outputDir, requestFileName),
        requestFileName,
        responseFile: path.join(outputDir, responseFileName),
        responseFileName,
        requestValidationFile: path.join(outputDir, requestValidationFileName),
        requestValidationFileName,
        responseValidationFile: path.join(
          outputDir,
          responseValidationFileName
        ),
        responseValidationFileName,
        clientFile: path.join(outputDir, clientFileName),
        clientFileName,
      };
    },
    getResourceOutputDir: (resourceName: string) =>
      path.join("/out", resourceName),
    writeFile: (relativePath: string, content: string) => {
      writtenFiles.set(relativePath, content);
    },
    renderTemplate: (templatePath: string, data: unknown) => {
      if (!renderSource) {
        return JSON.stringify(data);
      }

      return renderTemplate(
        readFileSync(templatePath, "utf8"),
        (data ?? {}) as Record<string, unknown>
      );
    },
    addGeneratedFile: () => {},
    getGeneratedFiles: () => [],
  } satisfies GeneratorContext;

  return { context, writtenFiles };
}

function generateResponses(
  normalizedSpec: NormalizedSpec,
  options: { readonly renderSource?: boolean } = {}
): Map<string, string> {
  const { context, writtenFiles } = aResponseGeneratorContext({
    normalizedSpec,
    renderSource: options.renderSource,
  });

  generate(context);

  return writtenFiles;
}

function renderCanonicalResponseSource(response: NormalizedResponse): string {
  const writtenFiles = generateResponses(
    {
      responses: [response],
      resources: [],
    },
    { renderSource: true }
  );
  const source = writtenFiles.get(
    `responses/${pascalCase(response.name)}Response.ts`
  );

  if (source === undefined) {
    throw new Error(
      `Expected ${response.name} response source to be generated`
    );
  }

  return source;
}

function renderOperationResponseSource(
  responses: NormalizedOperation["responses"]
): string {
  const writtenFiles = generateResponses(
    {
      responses: [],
      resources: [
        {
          name: "todos",
          operations: [anOperationWithResponses(responses)],
        },
      ],
    },
    { renderSource: true }
  );
  const source = writtenFiles.get("todos/CreateTodoResponse.ts");

  if (source === undefined) {
    throw new Error("Expected createTodo response source to be generated");
  }

  return source;
}

function parseGeneratedData(
  writtenFiles: Map<string, string>,
  relativePath: string
): unknown {
  const content = writtenFiles.get(relativePath);
  if (content === undefined) {
    throw new Error(`Expected ${relativePath} to be generated`);
  }

  return JSON.parse(content);
}

describe("ResponseGenerator", () => {
  test("emits canonical responses separately from inline operation responses", () => {
    const sharedError = aCanonicalResponse();
    const createTodoSuccess = anInlineOperationResponse();
    const normalizedSpec: NormalizedSpec = {
      responses: [sharedError],
      resources: [
        {
          name: "todos",
          operations: [
            anOperationWithResponses([
              {
                responseName: sharedError.name,
                source: "canonical",
              },
              {
                responseName: createTodoSuccess.name,
                source: "inline",
                response: createTodoSuccess,
              },
            ]),
          ],
        },
      ],
    };

    const writtenFiles = generateResponses(normalizedSpec);

    expect(writtenFiles.has("responses/SharedErrorResponse.ts")).toBe(true);
    expect(writtenFiles.has("todos/CreateTodoResponse.ts")).toBe(true);
    expect(
      parseGeneratedData(writtenFiles, "responses/SharedErrorResponse.ts")
    ).toEqual(
      expect.objectContaining({
        identifierName: "SharedError",
        typeValue: "SharedError",
        statusCodeKey: "BAD_REQUEST",
      })
    );
    expect(
      parseGeneratedData(writtenFiles, "todos/CreateTodoResponse.ts")
    ).toEqual(
      expect.objectContaining({
        operationId: "createTodo",
        ownResponses: [
          expect.objectContaining({
            identifierName: "CreateTodoSuccess",
            typeValue: "CreateTodoSuccess",
            statusCode: HttpStatusCode.CREATED,
          }),
        ],
        sharedResponses: [
          {
            identifierName: "SharedError",
            path: "../responses/SharedErrorResponse",
          },
        ],
      })
    );
  });

  test("uses PascalCase identifiers and raw discriminants for camelCase canonical responses", () => {
    const validationError = aCanonicalResponse({
      name: "validationError",
      header: z.object({ "Content-Type": z.literal("application/json") }),
      body: z.object({ code: z.literal("VALIDATION_ERROR") }),
    });
    const normalizedSpec: NormalizedSpec = {
      responses: [validationError],
      resources: [
        {
          name: "todos",
          operations: [
            anOperationWithResponses([
              {
                responseName: validationError.name,
                source: "canonical",
              },
            ]),
          ],
        },
      ],
    };

    const writtenFiles = generateResponses(normalizedSpec, {
      renderSource: true,
    });

    const sharedResponse = writtenFiles.get(
      "responses/ValidationErrorResponse.ts"
    );
    const operationResponse = writtenFiles.get("todos/CreateTodoResponse.ts");
    expect(sharedResponse).toContain("export type IValidationErrorResponse");
    expect(sharedResponse).toContain('ITypedHttpResponse<\n"validationError"');
    expect(sharedResponse).toContain(
      "export const createValidationErrorResponse"
    );
    expect(sharedResponse).toContain('type: "validationError"');
    expect(operationResponse).toContain(
      'import type { IValidationErrorResponse } from "../responses/ValidationErrorResponse";'
    );
    expect(operationResponse).toContain("| IValidationErrorResponse");
  });

  test("renders a header and body response factory signature", () => {
    const response = aCanonicalResponse({
      name: "headerAndBody",
      statusCode: HttpStatusCode.OK,
      statusCodeName: "OK",
      header: z.object({ "x-request-id": z.string() }),
      body: z.object({ id: z.string() }),
    });
    const source = renderCanonicalResponseSource(response);
    expect(source).toContain("input: {");
    expect(source).toContain("header: IHeaderAndBodyResponseHeader;");
    expect(source).toContain("body: IHeaderAndBodyResponseBody;");
    expect(source).toContain("header: input.header");
    expect(source).toContain("body: input.body");
  });

  test("renders a header-only response factory signature", () => {
    const response = aCanonicalResponse({
      name: "headerOnly",
      statusCode: HttpStatusCode.ACCEPTED,
      statusCodeName: "ACCEPTED",
      header: z.object({ "x-request-id": z.string() }),
      body: undefined,
    });
    const source = renderCanonicalResponseSource(response);
    expect(source).toContain("input: {");
    expect(source).toContain("header: IHeaderOnlyResponseHeader;");
    expect(source).not.toContain("body: IHeaderOnlyResponseBody;");
    expect(source).toContain("header: input.header");
    expect(source).toContain("body: undefined");
  });

  test("renders a body-only response factory signature", () => {
    const response = aCanonicalResponse({
      name: "bodyOnly",
      statusCode: HttpStatusCode.OK,
      statusCodeName: "OK",
      header: undefined,
      body: z.object({ id: z.string() }),
    });
    const source = renderCanonicalResponseSource(response);
    expect(source).toContain("input: {");
    expect(source).not.toContain("header: IBodyOnlyResponseHeader;");
    expect(source).toContain("body: IBodyOnlyResponseBody;");
    expect(source).toContain("header: undefined");
    expect(source).toContain("body: input.body");
  });

  test("renders a response factory without input for responses with no header or body", () => {
    const response = aCanonicalResponse({
      name: "emptyResponse",
      statusCode: HttpStatusCode.NO_CONTENT,
      statusCodeName: "NO_CONTENT",
      header: undefined,
      body: undefined,
    });
    const source = renderCanonicalResponseSource(response);
    expect(source).toContain(
      "export const createEmptyResponseResponse = (): IEmptyResponseResponse"
    );
    expect(source).not.toContain("input: {");
    expect(source).toContain("header: undefined");
    expect(source).toContain("body: undefined");
  });

  test("renders inline operation response factories for every header and body shape", () => {
    const source = renderOperationResponseSource([
      {
        responseName: "headerAndBody",
        source: "inline",
        response: anInlineOperationResponse({
          name: "headerAndBody",
          statusCode: HttpStatusCode.OK,
          statusCodeName: "OK",
          header: z.object({ "x-request-id": z.string() }),
          body: z.object({ id: z.string() }),
        }),
      },
      {
        responseName: "headerOnly",
        source: "inline",
        response: anInlineOperationResponse({
          name: "headerOnly",
          statusCode: HttpStatusCode.ACCEPTED,
          statusCodeName: "ACCEPTED",
          header: z.object({ "x-request-id": z.string() }),
          body: undefined,
        }),
      },
      {
        responseName: "bodyOnly",
        source: "inline",
        response: anInlineOperationResponse({
          name: "bodyOnly",
          statusCode: HttpStatusCode.OK,
          statusCodeName: "OK",
          header: undefined,
          body: z.object({ id: z.string() }),
        }),
      },
      {
        responseName: "emptyResponse",
        source: "inline",
        response: anInlineOperationResponse({
          name: "emptyResponse",
          statusCode: HttpStatusCode.NO_CONTENT,
          statusCodeName: "NO_CONTENT",
          header: undefined,
          body: undefined,
        }),
      },
    ]);

    expect(source).toContain("export const createHeaderAndBodyResponse = (");
    expect(source).toContain("\n    input: {\n");
    expect(source).not.toContain("\ninput: {\n");
    expect(source).toContain("\n    ): IHeaderAndBodyResponse");
    expect(source).not.toContain("\n): IHeaderAndBodyResponse");
    expect(source).toContain("header: IHeaderAndBodyResponseHeader;");
    expect(source).toContain("body: IHeaderAndBodyResponseBody;");
    expect(source).toContain("header: input.header");
    expect(source).toContain("body: input.body");
    expect(source).toContain("export const createHeaderOnlyResponse = (");
    expect(source).toContain("header: IHeaderOnlyResponseHeader;");
    expect(source).not.toContain("body: IHeaderOnlyResponseBody;");
    expect(source).toContain("export const createBodyOnlyResponse = (");
    expect(source).not.toContain("header: IBodyOnlyResponseHeader;");
    expect(source).toContain("body: IBodyOnlyResponseBody;");
    expect(source).toContain(
      "export const createEmptyResponseResponse = (): IEmptyResponseResponse"
    );
    expect(source).toContain("header: undefined");
    expect(source).toContain("body: undefined");
  });

  test("uses PascalCase exports and raw discriminants for camelCase inline responses", () => {
    const source = renderOperationResponseSource([
      {
        responseName: "createdTodo",
        source: "inline",
        response: anInlineOperationResponse({
          name: "createdTodo",
          header: z.object({ "x-request-id": z.string() }),
          body: z.object({ id: z.string() }),
        }),
      },
    ]);

    expect(source).toContain("export type ICreatedTodoResponse");
    expect(source).toContain("export const createCreatedTodoResponse");
    expect(source).toMatch(/ITypedHttpResponse<\s*"createdTodo"/);
    expect(source).toContain('type: "createdTodo"');
  });
});
