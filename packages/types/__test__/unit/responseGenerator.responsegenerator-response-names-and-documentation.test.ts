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

function renderCanonicalResponseSource(response: NormalizedResponse): string {
  const writtenFiles = renderResponseSources(
    aNormalizedSpecWith({
      responses: [response],
      resources: [],
    })
  );
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

describe("ResponseGenerator response names and documentation", () => {
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

  test("renders response descriptions as JSDoc above response aliases and factories", () => {
    const source = renderCanonicalResponseSource(
      aCanonicalResponse({
        name: "documentedResponse",
        description: "Documented response",
      })
    );

    expect(source).toContain(
      "/**\n * Documented response\n */\nexport type IDocumentedResponseResponse"
    );
    expect(source).toContain(
      "/**\n * Documented response\n */\nexport const createDocumentedResponseResponse"
    );
  });

  test("preserves multiline response descriptions in generated JSDoc", () => {
    const source = renderCanonicalResponseSource(
      aCanonicalResponse({
        name: "multilineResponse",
        description: "First line\n\nSecond line",
      })
    );

    expect(source).toContain("/**\n * First line\n * \n * Second line\n */");
  });

  test("sanitizes response descriptions before emitting generated JSDoc", () => {
    const source = renderCanonicalResponseSource(
      aCanonicalResponse({
        name: "sanitizedResponse",
        description: "Do not close */ comments",
      })
    );

    expect(source).toContain("Do not close *\\/ comments");
    expect(source).not.toContain("Do not close */ comments");
  });
});
