import { readFileSync } from "node:fs";
import path from "node:path";
import { HttpMethod, HttpStatusCode } from "@rexeus/typeweaver-core";
import { renderTemplate } from "@rexeus/typeweaver-gen";
import type {
  NormalizedOperation,
  NormalizedResource,
  NormalizedResponse,
  NormalizedResponseUsage,
  NormalizedSpec,
} from "@rexeus/typeweaver-gen";
import { pascalCase } from "polycase";
import { TestAssertionError } from "test-utils";
import { describe, expect, test } from "vitest";
import { z } from "zod";
import { generate } from "../../src/responseGenerator.js";
import type { ResponseGenerationContext } from "../../src/responseGenerator.js";

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

function aCanonicalResponseUsage(
  responseName: string
): NormalizedResponseUsage {
  return {
    responseName,
    source: "canonical",
  };
}

function anInlineResponseUsage(
  response: NormalizedResponse
): NormalizedResponseUsage {
  return {
    responseName: response.name,
    source: "inline",
    response,
  };
}

function aResourceWithOperationResponses(
  responses: NormalizedOperation["responses"],
  overrides: Partial<NormalizedResource> = {}
): NormalizedResource {
  return {
    name: "todos",
    operations: [anOperationWithResponses(responses)],
    ...overrides,
  };
}

type ResponseGeneratorTestContext = {
  readonly context: ResponseGenerationContext;
  readonly writtenFiles: Map<string, string>;
};

function createResponseGeneratorContext(
  normalizedSpec: NormalizedSpec,
  renderResponseTemplate: (templatePath: string, data: unknown) => string
): ResponseGeneratorTestContext {
  const writtenFiles = new Map<string, string>();

  const context = {
    outputDir: "/out",
    normalizedSpec,
    coreDir: "@rexeus/typeweaver-core",
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
    getOperationOutputPaths: ({
      operationId,
      resourceName,
    }: {
      readonly operationId: string;
      readonly resourceName: string;
    }) => {
      const outputDir = path.join("/out", resourceName);
      const fileBase = pascalCase(operationId);
      const responseFileName = `${fileBase}Response.ts`;

      return {
        outputDir,
        responseFile: path.join(outputDir, responseFileName),
        responseFileName,
      };
    },
    writeFile: (relativePath: string, content: string) => {
      writtenFiles.set(relativePath, content);
    },
    renderTemplate: renderResponseTemplate,
  } satisfies ResponseGenerationContext;

  return { context, writtenFiles };
}

function aDataCapturingResponseGeneratorContext(
  normalizedSpec: NormalizedSpec
): ResponseGeneratorTestContext {
  return createResponseGeneratorContext(normalizedSpec, (_templatePath, data) =>
    JSON.stringify(data)
  );
}

function aTemplateRenderingResponseGeneratorContext(
  normalizedSpec: NormalizedSpec
): ResponseGeneratorTestContext {
  return createResponseGeneratorContext(normalizedSpec, (templatePath, data) =>
    renderTemplate(
      readFileSync(templatePath, "utf8"),
      (data ?? {}) as Record<string, unknown>
    )
  );
}

function captureResponseGeneratorData(
  normalizedSpec: NormalizedSpec
): Map<string, string> {
  const { context, writtenFiles } =
    aDataCapturingResponseGeneratorContext(normalizedSpec);

  generate(context);

  return writtenFiles;
}

function renderResponseSources(
  normalizedSpec: NormalizedSpec
): Map<string, string> {
  const { context, writtenFiles } =
    aTemplateRenderingResponseGeneratorContext(normalizedSpec);

  generate(context);

  return writtenFiles;
}

function renderCanonicalResponseSource(response: NormalizedResponse): string {
  const writtenFiles = renderResponseSources({
    responses: [response],
    resources: [],
  });
  const source = writtenFiles.get(
    `responses/${pascalCase(response.name)}Response.ts`
  );

  if (source === undefined) {
    throw new TestAssertionError(
      `Expected ${response.name} response source to be generated`
    );
  }

  return source;
}

function renderOperationResponseSource(
  responses: NormalizedOperation["responses"]
): string {
  const writtenFiles = renderResponseSources({
    responses: [],
    resources: [
      {
        name: "todos",
        operations: [anOperationWithResponses(responses)],
      },
    ],
  });
  const source = writtenFiles.get("todos/CreateTodoResponse.ts");

  if (source === undefined) {
    throw new TestAssertionError(
      "Expected createTodo response source to be generated"
    );
  }

  return source;
}

function parseGeneratedData(
  writtenFiles: Map<string, string>,
  relativePath: string
): unknown {
  const content = writtenFiles.get(relativePath);
  if (content === undefined) {
    throw new TestAssertionError(`Expected ${relativePath} to be generated`);
  }

  return JSON.parse(content);
}

function getGeneratedSource(
  writtenFiles: Map<string, string>,
  relativePath: string
): string {
  const content = writtenFiles.get(relativePath);
  if (content === undefined) {
    throw new TestAssertionError(`Expected ${relativePath} to be generated`);
  }

  return content;
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
              aCanonicalResponseUsage(sharedError.name),
              anInlineResponseUsage(createTodoSuccess),
            ]),
          ],
        },
      ],
    };

    const writtenFiles = captureResponseGeneratorData(normalizedSpec);

    expect(writtenFiles.has("responses/SharedErrorResponse.ts")).toBe(true);
    expect(writtenFiles.has("responses/CreateTodoSuccessResponse.ts")).toBe(
      false
    );
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
            statusCodeKey: "CREATED",
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

  test("renders operation response unions from inline and shared responses", () => {
    const sharedError = aCanonicalResponse();
    const createTodoSuccess = anInlineOperationResponse();
    const normalizedSpec: NormalizedSpec = {
      responses: [sharedError],
      resources: [
        aResourceWithOperationResponses([
          anInlineResponseUsage(createTodoSuccess),
          aCanonicalResponseUsage(sharedError.name),
        ]),
      ],
    };

    const writtenFiles = renderResponseSources(normalizedSpec);
    const source = getGeneratedSource(
      writtenFiles,
      "todos/CreateTodoResponse.ts"
    );

    expect(source).toContain("export type ICreateTodoSuccessResponse");
    expect(source).toContain(
      'import type { ISharedErrorResponse } from "../responses/SharedErrorResponse";'
    );
    expect(source).toMatch(
      /export type CreateTodoResponse =\s*\| ICreateTodoSuccessResponse\s*\| ISharedErrorResponse\s*;/
    );
  });

  test("reuses a canonical response across operation response unions", () => {
    const sharedError = aCanonicalResponse();
    const normalizedSpec: NormalizedSpec = {
      responses: [sharedError],
      resources: [
        {
          name: "todos",
          operations: [
            anOperationWithResponses([
              aCanonicalResponseUsage(sharedError.name),
            ]),
          ],
        },
        {
          name: "projects",
          operations: [
            anOperationWithResponses(
              [aCanonicalResponseUsage(sharedError.name)],
              {
                operationId: "createProject",
                path: "/projects",
              }
            ),
          ],
        },
      ],
    };

    const writtenFiles = renderResponseSources(normalizedSpec);
    const todoResponse = getGeneratedSource(
      writtenFiles,
      "todos/CreateTodoResponse.ts"
    );
    const projectResponse = getGeneratedSource(
      writtenFiles,
      "projects/CreateProjectResponse.ts"
    );

    expect(writtenFiles.has("responses/SharedErrorResponse.ts")).toBe(true);
    expect(writtenFiles.has("todos/SharedErrorResponse.ts")).toBe(false);
    expect(writtenFiles.has("projects/SharedErrorResponse.ts")).toBe(false);
    expect(todoResponse).toContain("| ISharedErrorResponse");
    expect(projectResponse).toContain("| ISharedErrorResponse");
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
              aCanonicalResponseUsage(validationError.name),
            ]),
          ],
        },
      ],
    };

    const writtenFiles = renderResponseSources(normalizedSpec);

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

  test("renders canonical derived responses as shared response files", () => {
    const todoNotFoundError = aCanonicalResponse({
      name: "TodoNotFoundError",
      kind: "derived-response",
      derivedFrom: "NotFoundError",
      lineage: ["TodoNotFoundError"],
      depth: 1,
      statusCode: HttpStatusCode.NOT_FOUND,
      statusCodeName: "NOT_FOUND",
      header: z.object({ "x-reason": z.string() }),
      body: z.object({ message: z.string(), todoId: z.string() }),
    });

    const writtenFiles = renderResponseSources({
      responses: [todoNotFoundError],
      resources: [],
    });
    const source = getGeneratedSource(
      writtenFiles,
      "responses/TodoNotFoundErrorResponse.ts"
    );

    expect(source).toContain("export type ITodoNotFoundErrorResponseHeader");
    expect(source).toContain("export type ITodoNotFoundErrorResponseBody");
    expect(source).toMatch(/ITypedHttpResponse<\s*"TodoNotFoundError"/);
    expect(source).toContain("HttpStatusCode.NOT_FOUND");
    expect(source).toContain("export const createTodoNotFoundErrorResponse");
    expect(source).toContain("header: input.header");
    expect(source).toContain("body: input.body");
  });

  test("keeps inline derived responses operation-local when mixed with a canonical parent", () => {
    const notFoundError = aCanonicalResponse({
      name: "NotFoundError",
      statusCode: HttpStatusCode.NOT_FOUND,
      statusCodeName: "NOT_FOUND",
    });
    const todoNotFoundError = anInlineOperationResponse({
      name: "TodoNotFoundError",
      kind: "derived-response",
      derivedFrom: "NotFoundError",
      lineage: ["TodoNotFoundError"],
      depth: 1,
      statusCode: HttpStatusCode.NOT_FOUND,
      statusCodeName: "NOT_FOUND",
      header: z.object({ "x-reason": z.string() }),
      body: z.object({ message: z.string(), todoId: z.string() }),
    });
    const normalizedSpec: NormalizedSpec = {
      responses: [notFoundError],
      resources: [
        aResourceWithOperationResponses([
          aCanonicalResponseUsage(notFoundError.name),
          anInlineResponseUsage(todoNotFoundError),
        ]),
      ],
    };

    const writtenFiles = renderResponseSources(normalizedSpec);
    const source = getGeneratedSource(
      writtenFiles,
      "todos/CreateTodoResponse.ts"
    );

    expect(source).toContain(
      'import type { INotFoundErrorResponse } from "../responses/NotFoundErrorResponse";'
    );
    expect(source).toContain("export type ITodoNotFoundErrorResponseHeader");
    expect(source).toContain("export type ITodoNotFoundErrorResponseBody");
    expect(source).toContain("export const createTodoNotFoundErrorResponse");
    expect(source).toMatch(/ITypedHttpResponse<\s*"TodoNotFoundError"/);
    expect(source).toMatch(
      /export type CreateTodoResponse =\s*\| ITodoNotFoundErrorResponse\s*\| INotFoundErrorResponse\s*;/
    );
    expect(writtenFiles.has("responses/NotFoundErrorResponse.ts")).toBe(true);
    expect(writtenFiles.has("responses/TodoNotFoundErrorResponse.ts")).toBe(
      false
    );
  });

  test("uses PascalCase exports and raw discriminants for non-identifier response names", () => {
    const validationError = aCanonicalResponse({
      name: "validation-error",
      statusCode: HttpStatusCode.UNPROCESSABLE_ENTITY,
      statusCodeName: "UNPROCESSABLE_ENTITY",
      body: z.object({ code: z.literal("VALIDATION_ERROR") }),
    });

    const writtenFiles = renderResponseSources({
      responses: [validationError],
      resources: [
        aResourceWithOperationResponses([
          aCanonicalResponseUsage(validationError.name),
        ]),
      ],
    });
    const sharedResponse = getGeneratedSource(
      writtenFiles,
      "responses/ValidationErrorResponse.ts"
    );
    const operationResponse = getGeneratedSource(
      writtenFiles,
      "todos/CreateTodoResponse.ts"
    );

    expect(sharedResponse).toContain("export type IValidationErrorResponse");
    expect(sharedResponse).toContain(
      "export const createValidationErrorResponse"
    );
    expect(sharedResponse).toMatch(/ITypedHttpResponse<\s*"validation-error"/);
    expect(sharedResponse).toContain('type: "validation-error"');
    expect(operationResponse).toContain(
      'import type { IValidationErrorResponse } from "../responses/ValidationErrorResponse";'
    );
  });

  test("renders a shared-only operation response union without inline factories", () => {
    const badRequest = aCanonicalResponse({ name: "BadRequestError" });
    const unauthorized = aCanonicalResponse({
      name: "UnauthorizedError",
      statusCode: HttpStatusCode.UNAUTHORIZED,
      statusCodeName: "UNAUTHORIZED",
    });
    const normalizedSpec: NormalizedSpec = {
      responses: [badRequest, unauthorized],
      resources: [
        aResourceWithOperationResponses([
          aCanonicalResponseUsage(badRequest.name),
          aCanonicalResponseUsage(unauthorized.name),
        ]),
      ],
    };

    const writtenFiles = renderResponseSources(normalizedSpec);
    const source = getGeneratedSource(
      writtenFiles,
      "todos/CreateTodoResponse.ts"
    );

    expect(source).toContain(
      'import type { IBadRequestErrorResponse } from "../responses/BadRequestErrorResponse";'
    );
    expect(source).toContain(
      'import type { IUnauthorizedErrorResponse } from "../responses/UnauthorizedErrorResponse";'
    );
    expect(source).not.toContain("export const create");
    expect(source).toMatch(
      /export type CreateTodoResponse =\s*\| IBadRequestErrorResponse\s*\| IUnauthorizedErrorResponse\s*;/
    );
  });

  test("renders a header-and-body response factory with typed input and payload mapping", () => {
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
    expect(source).toContain('type: "headerAndBody"');
    expect(source).toContain("statusCode: HttpStatusCode.OK");
    expect(source).toContain("header: input.header");
    expect(source).toContain("body: input.body");
  });

  test("renders a header-only response factory with header input and undefined body", () => {
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
    expect(source).toContain('type: "headerOnly"');
    expect(source).toContain("statusCode: HttpStatusCode.ACCEPTED");
    expect(source).toContain("header: input.header");
    expect(source).toContain("body: undefined");
  });

  test("renders a body-only response factory with body input and undefined header", () => {
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
    expect(source).toContain('type: "bodyOnly"');
    expect(source).toContain("statusCode: HttpStatusCode.OK");
    expect(source).toContain("header: undefined");
    expect(source).toContain("body: input.body");
  });

  test("renders header input for a response whose header fields are optional", () => {
    const response = aCanonicalResponse({
      name: "optionalHeader",
      statusCode: HttpStatusCode.OK,
      statusCodeName: "OK",
      header: z.object({ "x-trace-id": z.string().optional() }),
      body: undefined,
    });
    const source = renderCanonicalResponseSource(response);

    expect(source).toContain('"x-trace-id"?: string | undefined;');
    expect(source).toContain("input: {");
    expect(source).toContain("header: IOptionalHeaderResponseHeader;");
    expect(source).toContain("header: input.header");
    expect(source).toContain("body: undefined");
  });

  test("renders an empty response factory with no input and undefined payload", () => {
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
    expect(source).toContain('type: "emptyResponse"');
    expect(source).toContain("statusCode: HttpStatusCode.NO_CONTENT");
    expect(source).toContain("header: undefined");
    expect(source).toContain("body: undefined");
  });

  test.each([
    {
      case: "header-and-body",
      response: anInlineOperationResponse({
        name: "headerAndBody",
        statusCode: HttpStatusCode.OK,
        statusCodeName: "OK",
        header: z.object({ "x-request-id": z.string() }),
        body: z.object({ id: z.string() }),
      }),
      includes: [
        "export const createHeaderAndBodyResponse = (",
        "\n    input: {\n",
        "\n    ): IHeaderAndBodyResponse",
        "header: IHeaderAndBodyResponseHeader;",
        "body: IHeaderAndBodyResponseBody;",
        "header: input.header",
        "body: input.body",
      ],
      excludes: ["\ninput: {\n", "\n): IHeaderAndBodyResponse"],
    },
    {
      case: "header-only",
      response: anInlineOperationResponse({
        name: "headerOnly",
        statusCode: HttpStatusCode.ACCEPTED,
        statusCodeName: "ACCEPTED",
        header: z.object({ "x-request-id": z.string() }),
        body: undefined,
      }),
      includes: [
        "export const createHeaderOnlyResponse = (",
        "header: IHeaderOnlyResponseHeader;",
        "header: input.header",
        "body: undefined",
      ],
      excludes: ["body: IHeaderOnlyResponseBody;"],
    },
    {
      case: "body-only",
      response: anInlineOperationResponse({
        name: "bodyOnly",
        statusCode: HttpStatusCode.OK,
        statusCodeName: "OK",
        header: undefined,
        body: z.object({ id: z.string() }),
      }),
      includes: [
        "export const createBodyOnlyResponse = (",
        "body: IBodyOnlyResponseBody;",
        "header: undefined",
        "body: input.body",
      ],
      excludes: ["header: IBodyOnlyResponseHeader;"],
    },
    {
      case: "empty",
      response: anInlineOperationResponse({
        name: "emptyResponse",
        statusCode: HttpStatusCode.NO_CONTENT,
        statusCodeName: "NO_CONTENT",
        header: undefined,
        body: undefined,
      }),
      includes: [
        "export const createEmptyResponseResponse = (): IEmptyResponseResponse",
        "header: undefined",
        "body: undefined",
      ],
      excludes: ["input: {"],
    },
  ])(
    "renders inline $case response factory with operation-local indentation",
    ({ response, includes, excludes }) => {
      const source = renderOperationResponseSource([
        anInlineResponseUsage(response),
      ]);

      for (const expected of includes) {
        expect(source).toContain(expected);
      }
      for (const unexpected of excludes) {
        expect(source).not.toContain(unexpected);
      }
    }
  );

  test("uses PascalCase exports and raw discriminants for camelCase inline responses", () => {
    const source = renderOperationResponseSource([
      anInlineResponseUsage(
        anInlineOperationResponse({
          name: "createdTodo",
          header: z.object({ "x-request-id": z.string() }),
          body: z.object({ id: z.string() }),
        })
      ),
    ]);

    expect(source).toContain("export type ICreatedTodoResponse");
    expect(source).toContain("export const createCreatedTodoResponse");
    expect(source).toMatch(/ITypedHttpResponse<\s*"createdTodo"/);
    expect(source).toContain('type: "createdTodo"');
  });
});
