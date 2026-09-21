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

describe("ResponseGenerator canonical response identity", () => {
  test("reuses a canonical response across operation response unions", () => {
    const sharedError = aCanonicalResponse();
    const normalizedSpec: NormalizedSpec = aNormalizedSpecWith({
      responses: [sharedError],
      resources: [
        {
          name: "todos",
          tags: [],
          security: { requirements: [], source: "none" },
          operations: [
            anOperationWithResponses([
              aCanonicalResponseUsage(sharedError.name),
            ]),
          ],
        },
        {
          name: "projects",
          tags: [],
          security: { requirements: [], source: "none" },
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
    });

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
    const normalizedSpec: NormalizedSpec = aNormalizedSpecWith({
      responses: [validationError],
      resources: [
        {
          name: "todos",
          tags: [],
          security: { requirements: [], source: "none" },
          operations: [
            anOperationWithResponses([
              aCanonicalResponseUsage(validationError.name),
            ]),
          ],
        },
      ],
    });

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
});
