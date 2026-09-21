import type {
  NormalizedHttpBody,
  NormalizedOperation,
} from "@rexeus/typeweaver-gen";
import { describe, expect, test } from "vitest";
import { z } from "zod";
import { buildOpenApiDocument } from "../../src/index.js";
import {
  aNormalizedSpecWith,
  anInlineResponseUsage,
  anOperationWith,
  aResponseWith,
  aTodoSpecWith,
  todoApiOptions,
} from "./buildOpenApiDocument.helpers.js";

function buildCoercingHttpBoundaryDocument() {
  const normalizedSpec = aTodoSpecWith({
    operations: [
      anOperationWith({
        operationId: "getMetric",
        path: "/metrics/:metricId",
        request: {
          param: z.object({
            metricId: z.coerce.number().int().positive(),
          }),
          query: z.object({
            enabled: z.stringbool().optional(),
            capturedAt: z.coerce.date().optional(),
            samples: z.array(z.coerce.number()).optional(),
          }),
          header: z.object({
            "X-Attempt": z.coerce.number().int(),
            "X-Enabled": z.stringbool().optional(),
          }),
        },
        responses: [anInlineResponseUsage(aResponseWith())],
      }),
    ],
  });

  return buildOpenApiDocument(normalizedSpec, todoApiOptions());
}

function aTextBody(schema: z.ZodType, mediaType: string): NormalizedHttpBody {
  return {
    schema,
    mediaType,
    mediaTypeSource: "content-type-header",
    transport: "text",
  };
}

describe("buildOpenApiDocument shell and request parameters", () => {
  test("builds the default OpenAPI 3.1.2 document shell from spec metadata", () => {
    const normalizedSpec = aNormalizedSpecWith();

    const result = buildOpenApiDocument(normalizedSpec);

    expect(result).toEqual({
      document: {
        openapi: "3.1.2",
        jsonSchemaDialect: "https://json-schema.org/draft/2020-12/schema",
        info: { title: "Todo API", version: "1.0.0" },
        tags: [],
        paths: {},
      },
      warnings: [],
    });
  });

  test("maps request path, query, and header parameters in OpenAPI order", () => {
    const normalizedSpec = aTodoSpecWith({
      operations: [
        anOperationWith({
          operationId: "updateTodo",
          method: "PATCH" as NormalizedOperation["method"],
          path: "/todos/:id",
          request: {
            param: z.object({ id: z.string() }),
            query: z.object({
              include: z.string(),
              cursor: z.string().optional(),
            }),
            header: z.object({ "x-trace-id": z.string() }).optional(),
          },
          responses: [anInlineResponseUsage(aResponseWith())],
        }),
      ],
    });

    const result = buildOpenApiDocument(normalizedSpec, todoApiOptions());

    expect(result.document.paths["/todos/{id}"]?.patch?.parameters).toEqual([
      { name: "id", in: "path", required: true, schema: { type: "string" } },
      {
        name: "include",
        in: "query",
        required: true,
        schema: { type: "string" },
      },
      {
        name: "cursor",
        in: "query",
        required: false,
        schema: { type: "string" },
      },
      {
        name: "x-trace-id",
        in: "header",
        required: false,
        schema: { type: "string" },
      },
    ]);
    expect(result.warnings).toEqual([]);
  });
});

describe("buildOpenApiDocument coercing request parameters", () => {
  test("projects coercing HTTP fields and warns for lossy Date output", () => {
    const result = buildCoercingHttpBoundaryDocument();

    expect(
      result.document.paths["/metrics/{metricId}"]?.get?.parameters
    ).toEqual([
      {
        name: "metricId",
        in: "path",
        required: true,
        schema: {
          type: "integer",
          exclusiveMinimum: 0,
          maximum: Number.MAX_SAFE_INTEGER,
        },
      },
      {
        name: "enabled",
        in: "query",
        required: false,
        schema: { type: "boolean" },
      },
      {
        name: "capturedAt",
        in: "query",
        required: false,
        schema: {},
      },
      {
        name: "samples",
        in: "query",
        required: false,
        schema: { type: "array", items: { type: "number" } },
      },
      {
        name: "X-Attempt",
        in: "header",
        required: true,
        schema: {
          type: "integer",
          minimum: Number.MIN_SAFE_INTEGER,
          maximum: Number.MAX_SAFE_INTEGER,
        },
      },
      {
        name: "X-Enabled",
        in: "header",
        required: false,
        schema: { type: "boolean" },
      },
    ]);
    expect(result.warnings).toEqual([
      expect.objectContaining({
        origin: "schema-conversion",
        code: "unsupported-schema",
        schemaType: "pipe",
        documentPath: "/paths/~1metrics~1{metricId}/get/parameters/1/schema",
        location: expect.objectContaining({
          operationId: "getMetric",
          part: "request.query",
          parameterName: "enabled",
        }) as unknown,
      }) as unknown,
      expect.objectContaining({
        origin: "schema-conversion",
        code: "unsupported-schema",
        schemaType: "date",
        documentPath: "/paths/~1metrics~1{metricId}/get/parameters/2/schema",
        location: expect.objectContaining({
          operationId: "getMetric",
          part: "request.query",
          parameterName: "capturedAt",
        }) as unknown,
      }) as unknown,
      expect.objectContaining({
        origin: "schema-conversion",
        code: "unsupported-schema",
        schemaType: "pipe",
        documentPath: "/paths/~1metrics~1{metricId}/get/parameters/5/schema",
        location: expect.objectContaining({
          operationId: "getMetric",
          part: "request.header",
          parameterName: "X-Enabled",
        }) as unknown,
      }) as unknown,
    ]);
  });
});

describe("buildOpenApiDocument embedded path parameters", () => {
  test("maps embedded digit-prefixed path parameters in path order", () => {
    const normalizedSpec = aTodoSpecWith({
      operations: [
        anOperationWith({
          operationId: "downloadFile",
          path: "/files/:123id.:format",
          request: {
            param: z.object({ "123id": z.string(), format: z.string() }),
          },
          responses: [anInlineResponseUsage(aResponseWith())],
        }),
      ],
    });

    const result = buildOpenApiDocument(normalizedSpec, todoApiOptions());

    expect(
      result.document.paths["/files/{123id}.{format}"]?.get?.parameters
    ).toEqual([
      {
        name: "123id",
        in: "path",
        required: true,
        schema: { type: "string" },
      },
      {
        name: "format",
        in: "path",
        required: true,
        schema: { type: "string" },
      },
    ]);
    expect(result.warnings).toEqual([]);
  });
});

describe("buildOpenApiDocument required request bodies", () => {
  test("maps required request body schemas", () => {
    const normalizedSpec = aTodoSpecWith({
      operations: [
        anOperationWith({
          operationId: "createTodo",
          method: "POST" as NormalizedOperation["method"],
          request: { body: z.object({ title: z.string() }) },
          responses: [anInlineResponseUsage(aResponseWith())],
        }),
      ],
    });

    const result = buildOpenApiDocument(normalizedSpec, todoApiOptions());

    expect(result.document.paths["/todos"]?.post?.requestBody).toEqual({
      required: true,
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/CreateTodoRequestBody" },
        },
      },
    });
    expect(result.document.components?.schemas).toEqual({
      CreateTodoRequestBody: {
        type: "object",
        properties: { title: { type: "string" } },
        required: ["title"],
        additionalProperties: false,
      },
    });
    expect(result.warnings).toEqual([]);
  });

  test("uses the normalized request body media type as the OpenAPI content key", () => {
    const body = z.string();
    const normalizedSpec = aTodoSpecWith({
      operations: [
        anOperationWith({
          operationId: "uploadCsv",
          method: "POST" as NormalizedOperation["method"],
          request: { body: aTextBody(body, "text/csv") },
          responses: [anInlineResponseUsage(aResponseWith())],
        }),
      ],
    });

    const result = buildOpenApiDocument(normalizedSpec, todoApiOptions());

    expect(result.document.paths["/todos"]?.post?.requestBody).toEqual({
      required: true,
      content: {
        "text/csv": {
          schema: { $ref: "#/components/schemas/UploadCsvRequestBody" },
        },
      },
    });
  });
});

describe("buildOpenApiDocument optional request bodies", () => {
  test("maps optional request bodies to non-required unwrapped schemas", () => {
    const normalizedSpec = aTodoSpecWith({
      operations: [
        anOperationWith({
          operationId: "createTodo",
          method: "POST" as NormalizedOperation["method"],
          request: { body: z.object({ title: z.string() }).optional() },
          responses: [anInlineResponseUsage(aResponseWith())],
        }),
      ],
    });

    const result = buildOpenApiDocument(normalizedSpec, todoApiOptions());

    expect(result.document.paths["/todos"]?.post?.requestBody).toEqual({
      required: false,
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/CreateTodoRequestBody" },
        },
      },
    });
    expect(result.document.components?.schemas).toEqual({
      CreateTodoRequestBody: {
        type: "object",
        properties: { title: { type: "string" } },
        required: ["title"],
        additionalProperties: false,
      },
    });
    expect(result.warnings).toEqual([]);
  });

  test("emits literal request body schemas as single-value enums", () => {
    const normalizedSpec = aTodoSpecWith({
      operations: [
        anOperationWith({
          operationId: "uploadJson",
          method: "POST" as NormalizedOperation["method"],
          request: { body: z.literal("application/json") },
          responses: [anInlineResponseUsage(aResponseWith())],
        }),
      ],
    });

    const result = buildOpenApiDocument(normalizedSpec, todoApiOptions());

    expect(
      result.document.components?.schemas?.["UploadJsonRequestBody"]
    ).toEqual({
      type: "string",
      enum: ["application/json"],
    });
    expect(
      result.document.paths["/todos"]?.post?.requestBody?.content[
        "application/json"
      ]?.schema
    ).toEqual({ $ref: "#/components/schemas/UploadJsonRequestBody" });
    expect(result.warnings).toEqual([]);
  });
});
