import type {
  NormalizedHttpBody,
  NormalizedResponse,
  NormalizedResponseUsage,
} from "@rexeus/typeweaver-gen";
import { describe, expect, test } from "vitest";
import { z } from "zod";
import { buildOpenApiDocument } from "../../src/index.js";
import {
  aCanonicalResponseUsage,
  anInlineResponseUsage,
  anOperationWith,
  aResponseWith,
  aTodoSpecWith,
  todoApiOptions,
} from "./buildOpenApiDocument.helpers.js";

const OK_STATUS = 200 as NormalizedResponse["statusCode"];

type ResponseBuilderOverrides = Parameters<typeof aResponseWith>[0];

function anInlineOkResponse(
  overrides: ResponseBuilderOverrides = {}
): NormalizedResponseUsage {
  return anInlineResponseUsage(
    aResponseWith({ statusCode: OK_STATUS, ...overrides })
  );
}

function aCanonicalOkResponse(
  overrides: ResponseBuilderOverrides = {}
): NormalizedResponse {
  return aResponseWith({ statusCode: OK_STATUS, ...overrides });
}

function aTextBody(schema: z.ZodType, mediaType: string): NormalizedHttpBody {
  return {
    schema,
    mediaType,
    mediaTypeSource: "content-type-header",
    transport: "text",
  };
}

function anOctetStreamBody(schema: z.ZodType): NormalizedHttpBody {
  return {
    schema,
    mediaType: "application/octet-stream",
    mediaTypeSource: "content-type-header",
    transport: "raw",
  };
}

describe("buildOpenApiDocument canonical response references", () => {
  test("maps canonical response references", () => {
    const successResponse = aCanonicalOkResponse({
      name: "TodoResponse",
      description: "Todo found",
      body: z.object({ id: z.string() }),
    });
    const normalizedSpec = aTodoSpecWith({
      responses: [successResponse],
      operations: [
        anOperationWith({
          operationId: "getTodo",
          path: "/todos/:id",
          request: { param: z.object({ id: z.string() }) },
          responses: [aCanonicalResponseUsage("TodoResponse")],
        }),
      ],
    });

    const result = buildOpenApiDocument(normalizedSpec, todoApiOptions());

    expect(result.document.components?.responses).toEqual({
      TodoResponse: {
        description: "Todo found",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/TodoResponseBody" },
          },
        },
      },
    });
    expect(result.document.components?.schemas).toEqual({
      TodoResponseBody: {
        type: "object",
        properties: { id: { type: "string" } },
        required: ["id"],
        additionalProperties: false,
      },
    });
    expect(result.document.paths["/todos/{id}"]?.get?.responses).toEqual({
      "200": { $ref: "#/components/responses/TodoResponse" },
    });
    expect(result.warnings).toEqual([]);
  });

  test("escapes canonical response references without changing component keys", () => {
    const successResponse = aCanonicalOkResponse({
      name: "Todo/Success~Response",
    });
    const normalizedSpec = aTodoSpecWith({
      responses: [successResponse],
      operations: [
        anOperationWith({
          responses: [aCanonicalResponseUsage("Todo/Success~Response")],
        }),
      ],
    });

    const result = buildOpenApiDocument(normalizedSpec, todoApiOptions());

    expect(result.document.components?.responses).toEqual({
      "Todo/Success~Response": { description: "OK" },
    });
    expect(result.document.paths["/todos"]?.get?.responses).toEqual({
      "200": { $ref: "#/components/responses/Todo~1Success~0Response" },
    });
    expect(result.warnings).toEqual([]);
  });
});

describe("buildOpenApiDocument inline response bodies", () => {
  test("maps inline response bodies", () => {
    const normalizedSpec = aTodoSpecWith({
      operations: [
        anOperationWith({
          responses: [
            anInlineOkResponse({
              description: "Todo found",
              body: z.object({ id: z.string() }),
            }),
          ],
        }),
      ],
    });

    const result = buildOpenApiDocument(normalizedSpec, todoApiOptions());

    expect(result.document.paths["/todos"]?.get?.responses).toEqual({
      "200": {
        description: "Todo found",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/GetTodoOkResponseBody" },
          },
        },
      },
    });
    expect(result.document.components?.schemas).toEqual({
      GetTodoOkResponseBody: {
        type: "object",
        properties: { id: { type: "string" } },
        required: ["id"],
        additionalProperties: false,
      },
    });
    expect(result.warnings).toEqual([]);
  });

  test("uses the normalized response body media type as the OpenAPI content key", () => {
    const normalizedSpec = aTodoSpecWith({
      operations: [
        anOperationWith({
          responses: [
            anInlineOkResponse({
              description: "Todo found",
              body: aTextBody(z.string(), "text/plain"),
            }),
          ],
        }),
      ],
    });

    const result = buildOpenApiDocument(normalizedSpec, todoApiOptions());

    expect(result.document.paths["/todos"]?.get?.responses).toEqual({
      "200": {
        description: "Todo found",
        content: {
          "text/plain": {
            schema: { $ref: "#/components/schemas/GetTodoOkResponseBody" },
          },
        },
      },
    });
    expect(result.warnings).toEqual([]);
  });
});

describe("buildOpenApiDocument raw response fallbacks", () => {
  test("emits binary schema for octet-stream raw file responses", () => {
    const normalizedSpec = aTodoSpecWith({
      operations: [
        anOperationWith({
          operationId: "downloadFile",
          responses: [
            anInlineOkResponse({
              description: "File downloaded",
              body: anOctetStreamBody(z.any()),
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
            schema: { type: "string", format: "binary" },
          },
        },
      },
    });
    expect(result.document.components).toBeUndefined();
    expect(result.warnings).toEqual([]);
  });

  test("emits a binary octet-stream schema for raw pipes with broad outputs", () => {
    const normalizedSpec = aTodoSpecWith({
      operations: [
        anOperationWith({
          operationId: "downloadFile",
          responses: [
            anInlineOkResponse({
              description: "File downloaded",
              body: anOctetStreamBody(z.string().pipe(z.any())),
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
            schema: { type: "string", format: "binary" },
          },
        },
      },
    });
    expect(result.document.components).toBeUndefined();
    expect(result.warnings).toEqual([]);
  });
});

describe("buildOpenApiDocument concrete raw pipe responses", () => {
  test("registers concrete raw pipe outputs for octet-stream responses", () => {
    const normalizedSpec = aTodoSpecWith({
      operations: [
        anOperationWith({
          operationId: "downloadFile",
          responses: [
            anInlineOkResponse({
              description: "File downloaded",
              body: anOctetStreamBody(z.any().pipe(z.string())),
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
      DownloadFileOkResponseBody: { type: "string" },
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
    ]);
  });
});
