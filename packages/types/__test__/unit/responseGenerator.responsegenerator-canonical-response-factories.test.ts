import { readFileSync } from "node:fs";
import path from "node:path";
import { HttpStatusCode } from "@rexeus/typeweaver-core";
import { renderTemplate } from "@rexeus/typeweaver-gen";
import type {
  NormalizedHttpBody,
  NormalizedResponse,
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

describe("ResponseGenerator canonical response factories", () => {
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
});
