import { readFileSync } from "node:fs";
import path from "node:path";
import { HttpMethod, HttpStatusCode } from "@rexeus/typeweaver-core";
import { renderTemplate } from "@rexeus/typeweaver-gen";
import type {
  NormalizedHttpBody,
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

function aCanonicalResponse(
  overrides: ResponseOverrides = {}
): NormalizedResponse {
  const defaultBody = aJsonNormalizedBody(z.object({ message: z.string() }));

  return {
    name: "SharedError",
    kind: "response",
    statusCode: HttpStatusCode.BAD_REQUEST,
    statusCodeName: "BAD_REQUEST",
    description: "Shared error",
    ...overrides,
    body: hasBodyOverride(overrides)
      ? normalizeBodyForBuilder(overrides.body)
      : defaultBody,
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
    tags: overrides.tags ?? [],
    security: overrides.security ?? {
      requirements: [],
      source: "none" as const,
    },
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

describe("ResponseGenerator derived responses", () => {
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

    const writtenFiles = renderResponseSources(
      aNormalizedSpecWith({
        responses: [todoNotFoundError],
        resources: [],
      })
    );
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
    const normalizedSpec: NormalizedSpec = aNormalizedSpecWith({
      responses: [notFoundError],
      resources: [
        aResourceWithOperationResponses([
          aCanonicalResponseUsage(notFoundError.name),
          anInlineResponseUsage(todoNotFoundError),
        ]),
      ],
    });

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
});
