import type {
  NormalizedHttpBody,
  NormalizedOperation,
  NormalizedResponse,
  NormalizedResponseUsage,
} from "@rexeus/typeweaver-gen";
import { describe, expect, test } from "vitest";
import { z } from "zod";
import { buildOpenApiDocument } from "../../src/index.js";
import {
  aHeaderSchemaForBuilder,
  anInlineResponseUsage,
  anOperationWith,
  aResponseWith,
  aTodoSpecWith,
  todoApiOptions,
} from "./buildOpenApiDocument.helpers.js";

const OK_STATUS = 200 as NormalizedResponse["statusCode"];

const NOT_FOUND_STATUS = 404 as NormalizedResponse["statusCode"];

type ResponseBuilderOverrides = Parameters<typeof aResponseWith>[0];

type OperationBuilderOverrides = Parameters<typeof anOperationWith>[0];

function anInlineOkResponse(
  overrides: ResponseBuilderOverrides = {}
): NormalizedResponseUsage {
  return anInlineResponseUsage(
    aResponseWith({ statusCode: OK_STATUS, ...overrides })
  );
}

function anOperationWithDuplicateOkResponses(
  responses: readonly NormalizedResponseUsage[],
  overrides: OperationBuilderOverrides = {}
): NormalizedOperation {
  return anOperationWith({ ...overrides, responses });
}

function anOctetStreamBody(schema: z.ZodType): NormalizedHttpBody {
  return {
    schema,
    mediaType: "application/octet-stream",
    mediaTypeSource: "content-type-header",
    transport: "raw",
  };
}

test("registers transform raw pipe outputs without binary fallback", () => {
  const normalizedSpec = aTodoSpecWith({
    operations: [
      anOperationWith({
        operationId: "downloadFile",
        responses: [
          anInlineOkResponse({
            description: "File downloaded",
            body: anOctetStreamBody(
              z.any().pipe(z.string().transform(value => value.length))
            ),
          }),
        ],
      }),
    ],
  });

  const result = buildOpenApiDocument(normalizedSpec, todoApiOptions());

  expect(result.document.paths["/todos"]?.get?.responses).toEqual({
    "200": {
      description: "File downloaded",
      content: {
        "application/octet-stream": {
          schema: {
            $ref: "#/components/schemas/DownloadFileOkResponseBody",
          },
        },
      },
    },
  });
  expect(result.document.components?.schemas).toEqual({
    DownloadFileOkResponseBody: {},
  });
  expect(result.warnings).toEqual([
    {
      origin: "schema-conversion",
      code: "unsupported-schema",
      message: "Zod pipe falls back to a broader JSON Schema representation.",
      schemaType: "pipe",
      schemaPath: "",
      documentPath: "/components/schemas/DownloadFileOkResponseBody",
      location: {
        resourceName: "Todos",
        operationId: "downloadFile",
        method: "GET",
        path: "/todos",
        openApiPath: "/todos",
        parameterName: undefined,
        part: "response.body",
        responseName: "OkResponse",
        statusCode: "200",
      },
    },
    {
      origin: "schema-conversion",
      code: "unsupported-schema",
      message: "Zod pipe falls back to a broader JSON Schema representation.",
      schemaType: "pipe",
      schemaPath: "/x-typeweaver/pipeOut",
      documentPath:
        "/components/schemas/DownloadFileOkResponseBody/x-typeweaver/pipeOut",
      location: {
        resourceName: "Todos",
        operationId: "downloadFile",
        method: "GET",
        path: "/todos",
        openApiPath: "/todos",
        parameterName: undefined,
        part: "response.body",
        responseName: "OkResponse",
        statusCode: "200",
      },
    },
    {
      origin: "schema-conversion",
      code: "unsupported-schema",
      message:
        "Zod transform falls back to a broader JSON Schema representation.",
      schemaType: "transform",
      schemaPath: "/x-typeweaver/pipeOut/x-typeweaver/pipeOut",
      documentPath:
        "/components/schemas/DownloadFileOkResponseBody/x-typeweaver/pipeOut/x-typeweaver/pipeOut",
      location: {
        resourceName: "Todos",
        operationId: "downloadFile",
        method: "GET",
        path: "/todos",
        openApiPath: "/todos",
        parameterName: undefined,
        part: "response.body",
        responseName: "OkResponse",
        statusCode: "200",
      },
    },
  ]);
});

describe("buildOpenApiDocument inline response headers", () => {
  test("maps required and optional inline response headers", () => {
    const normalizedSpec = aTodoSpecWith({
      operations: [
        anOperationWith({
          responses: [
            anInlineOkResponse({
              header: z.object({
                etag: z.string(),
                "x-cache": z.string().optional(),
              }),
            }),
          ],
        }),
      ],
    });

    const result = buildOpenApiDocument(normalizedSpec, todoApiOptions());

    expect(result.document.paths["/todos"]?.get?.responses).toEqual({
      "200": {
        description: "OK",
        headers: {
          etag: { required: true, schema: { type: "string" } },
          "x-cache": { required: false, schema: { type: "string" } },
        },
      },
    });
    expect(result.warnings).toEqual([]);
  });

  test("maps strict response header containers without a false catchall warning", () => {
    const normalizedSpec = aTodoSpecWith({
      operations: [
        anOperationWith({
          responses: [
            anInlineOkResponse({
              header: aHeaderSchemaForBuilder(
                z.strictObject({ etag: z.string() })
              ),
            }),
          ],
        }),
      ],
    });

    const result = buildOpenApiDocument(normalizedSpec, todoApiOptions());

    expect(result.document.paths["/todos"]?.get?.responses).toEqual({
      "200": {
        description: "OK",
        headers: {
          etag: { required: true, schema: { type: "string" } },
        },
      },
    });
    expect(result.warnings).toEqual([]);
  });

  test("marks response headers from catch containers as not required", () => {
    const normalizedSpec = aTodoSpecWith({
      operations: [
        anOperationWith({
          responses: [
            anInlineOkResponse({
              header: aHeaderSchemaForBuilder(
                z.object({ "x-cache": z.string() }).catch({ "x-cache": "miss" })
              ),
            }),
          ],
        }),
      ],
    });

    const result = buildOpenApiDocument(normalizedSpec, todoApiOptions());

    expect(result.document.paths["/todos"]?.get?.responses).toEqual({
      "200": {
        description: "OK",
        headers: {
          "x-cache": { required: false, schema: { type: "string" } },
        },
      },
    });
    expect(result.warnings).toEqual([]);
  });
});

describe("buildOpenApiDocument response status grouping", () => {
  test("omits missing canonical response usages and emits a diagnostic", () => {
    const normalizedSpec = aTodoSpecWith({
      operations: [
        anOperationWith({
          responses: [{ responseName: "MissingResponse", source: "canonical" }],
        }),
      ],
    });

    const result = buildOpenApiDocument(normalizedSpec, todoApiOptions());

    expect(result.document.paths["/todos"]?.get?.responses).toEqual({});
    expect(result.warnings).toEqual([
      {
        origin: "openapi-builder",
        code: "missing-canonical-response",
        message: "Canonical response 'MissingResponse' is not defined.",
        documentPath: "/paths/~1todos/get/responses",
        location: {
          resourceName: "Todos",
          operationId: "getTodo",
          method: "GET",
          path: "/todos",
          openApiPath: "/todos",
          part: "response",
          responseName: "MissingResponse",
          statusCode: undefined,
        },
      },
    ]);
  });

  test("merges duplicate inline response statuses without a diagnostic", () => {
    const normalizedSpec = aTodoSpecWith({
      operations: [
        anOperationWithDuplicateOkResponses([
          anInlineOkResponse({ description: "First" }),
          anInlineOkResponse({ description: "Second" }),
        ]),
      ],
    });

    const result = buildOpenApiDocument(normalizedSpec, todoApiOptions());

    expect(result.document.paths["/todos"]?.get?.responses).toEqual({
      "200": { description: "OkResponse: First\n\nOkResponse: Second" },
    });
    expect(result.warnings).toEqual([]);
  });

  test("keeps different response status codes separate", () => {
    const normalizedSpec = aTodoSpecWith({
      operations: [
        anOperationWith({
          responses: [
            anInlineResponseUsage(
              aResponseWith({
                name: "TodoFound",
                statusCode: OK_STATUS,
                description: "Todo found",
              })
            ),
            anInlineResponseUsage(
              aResponseWith({
                name: "TodoMissing",
                statusCode: NOT_FOUND_STATUS,
                description: "Todo missing",
              })
            ),
          ],
        }),
      ],
    });

    const result = buildOpenApiDocument(normalizedSpec, todoApiOptions());

    expect(result.document.paths["/todos"]?.get?.responses).toEqual({
      "200": { description: "Todo found" },
      "404": { description: "Todo missing" },
    });
    expect(result.warnings).toEqual([]);
  });
});
