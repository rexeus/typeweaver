import { describe, expect, test } from "vitest";
import { z } from "zod";
import { buildOpenApiDocument } from "../../../src/index.js";
import {
  anOperationWith,
  aTodoSpecWith,
  todoApiOptions,
} from "../../helpers.js";
import { anInlineOkResponse, anOctetStreamBody } from "./fixtures.js";

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
