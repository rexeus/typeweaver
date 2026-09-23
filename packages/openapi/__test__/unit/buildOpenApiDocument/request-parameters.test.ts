import { describe, expect, test } from "vitest";
import { z } from "zod";
import { buildOpenApiDocument } from "../../../src/index.js";
import {
  anHttpMethod,
  anInlineResponseUsage,
  anOperationWith,
  aNormalizedSpecWith,
  aQuerySchemaForBuilder,
  aRequestHeaderSchemaForBuilder,
  aResponseWith,
  aTodoSpecWith,
  todoApiOptions,
} from "../../helpers.js";

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
          method: anHttpMethod("PATCH"),
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

describe("buildOpenApiDocument optional parameter containers", () => {
  test("marks query parameters from default containers as not required", () => {
    const normalizedSpec = aTodoSpecWith({
      operations: [
        anOperationWith({
          request: {
            query: aQuerySchemaForBuilder(
              z.object({ search: z.string() }).default({ search: "all" })
            ),
          },
          responses: [anInlineResponseUsage(aResponseWith())],
        }),
      ],
    });

    const result = buildOpenApiDocument(normalizedSpec, todoApiOptions());

    expect(result.document.paths["/todos"]?.get?.parameters).toEqual([
      {
        name: "search",
        in: "query",
        required: false,
        schema: { type: "string" },
      },
    ]);
    expect(result.warnings).toEqual([]);
  });

  test("marks request headers from nonoptional prefault containers as not required", () => {
    const normalizedSpec = aTodoSpecWith({
      operations: [
        anOperationWith({
          request: {
            header: aRequestHeaderSchemaForBuilder(
              z
                .object({ "x-trace-id": z.string() })
                .prefault({ "x-trace-id": "trace" })
                .nonoptional()
            ),
          },
          responses: [anInlineResponseUsage(aResponseWith())],
        }),
      ],
    });

    const result = buildOpenApiDocument(normalizedSpec, todoApiOptions());

    expect(result.document.paths["/todos"]?.get?.parameters).toEqual([
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
