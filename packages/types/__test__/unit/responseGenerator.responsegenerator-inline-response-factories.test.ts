import { readFileSync } from "node:fs";
import path from "node:path";
import { HttpMethod, HttpStatusCode } from "@rexeus/typeweaver-core";
import { renderTemplate } from "@rexeus/typeweaver-gen";
import type {
  NormalizedHttpBody,
  NormalizedOperation,
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

type ResponseOverrides = Omit<Partial<NormalizedResponse>, "body"> & {
  readonly body?: z.ZodType | NormalizedHttpBody | undefined;
};

function aJsonNormalizedBody(schema: z.ZodType): NormalizedHttpBody {
  return {
    schema,
    mediaType: "application/json",
    mediaTypeSource: "body-schema",
    transport: "json",
  };
}

function normalizeBodyForBuilder(
  body: z.ZodType | NormalizedHttpBody | undefined
): NormalizedHttpBody | undefined {
  if (body === undefined) {
    return undefined;
  }

  return "schema" in body ? body : aJsonNormalizedBody(body);
}

function hasBodyOverride(overrides: ResponseOverrides): boolean {
  return Object.prototype.hasOwnProperty.call(overrides, "body");
}

function aNormalizedSpecWith(
  overrides: Partial<NormalizedSpec> = {}
): NormalizedSpec {
  return {
    metadata: { title: "Response API", version: "1.0.0" },
    securitySchemes: [],
    security: { requirements: [], source: "none" },
    resources: [],
    responses: [],
    warnings: [],
    ...overrides,
  };
}

function anInlineOperationResponse(
  overrides: ResponseOverrides = {}
): NormalizedResponse {
  const defaultBody = aJsonNormalizedBody(z.object({ id: z.string() }));

  return {
    name: "CreateTodoSuccess",
    kind: "response",
    statusCode: HttpStatusCode.CREATED,
    statusCodeName: "CREATED",
    description: "Created",
    ...overrides,
    body: hasBodyOverride(overrides)
      ? normalizeBodyForBuilder(overrides.body)
      : defaultBody,
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
    deprecated: overrides.deprecated ?? false,
    tags: overrides.tags ?? [],
    security: overrides.security ?? {
      requirements: [],
      source: "none" as const,
    },
    request: undefined,
    responses,
    ...overrides,
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

function renderResponseSources(
  normalizedSpec: NormalizedSpec
): Map<string, string> {
  const { context, writtenFiles } =
    aTemplateRenderingResponseGeneratorContext(normalizedSpec);

  generate(context);

  return writtenFiles;
}

function renderOperationResponseSource(
  responses: NormalizedOperation["responses"]
): string {
  const writtenFiles = renderResponseSources(
    aNormalizedSpecWith({
      responses: [],
      resources: [
        {
          name: "todos",
          tags: [],
          security: { requirements: [], source: "none" },
          operations: [anOperationWithResponses(responses)],
        },
      ],
    })
  );
  const source = writtenFiles.get("todos/CreateTodoResponse.ts");

  if (source === undefined) {
    throw new TestAssertionError(
      "Expected createTodo response source to be generated"
    );
  }

  return source;
}

describe("ResponseGenerator inline response factories", () => {
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
});
