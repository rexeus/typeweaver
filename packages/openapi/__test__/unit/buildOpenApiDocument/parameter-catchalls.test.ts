import { describe, expect, test } from "vitest";
import { z } from "zod";
import { buildOpenApiDocument } from "../../../src/index.js";
import {
  anInlineResponseUsage,
  anOperationWith,
  aResponseWith,
  aTodoSpecWith,
  todoApiOptions,
} from "../../helpers.js";

describe("buildOpenApiDocument query catchalls", () => {
  test("warns when record query parameters cannot be represented", () => {
    const normalizedSpec = aTodoSpecWith({
      operations: [
        anOperationWith({
          operationId: "searchTodos",
          request: { query: z.record(z.string(), z.string()) },
          responses: [anInlineResponseUsage(aResponseWith())],
        }),
      ],
    });

    const result = buildOpenApiDocument(normalizedSpec, todoApiOptions());

    expect(result.document.paths["/todos"]?.get?.parameters).toBeUndefined();
    expect(result.warnings).toEqual([
      {
        origin: "openapi-builder",
        code: "unrepresentable-parameter-container",
        message:
          "request.query record entries cannot be represented as finite OpenAPI parameters.",
        documentPath: "/paths/~1todos/get/parameters",
        location: {
          resourceName: "Todos",
          operationId: "searchTodos",
          method: "GET",
          path: "/todos",
          openApiPath: "/todos",
          part: "request.query",
          parameterName: undefined,
          responseName: undefined,
          statusCode: undefined,
        },
      },
    ]);
  });

  test("emits finite query parameters when query catchall entries are not representable", () => {
    const normalizedSpec = aTodoSpecWith({
      operations: [
        anOperationWith({
          request: {
            query: z.object({ id: z.string() }).catchall(z.string()),
          },
          responses: [anInlineResponseUsage(aResponseWith())],
        }),
      ],
    });

    const result = buildOpenApiDocument(normalizedSpec, todoApiOptions());

    expect(result.document.paths["/todos"]?.get?.parameters).toEqual([
      { name: "id", in: "query", required: true, schema: { type: "string" } },
    ]);
    expect(result.warnings).toEqual([
      {
        origin: "openapi-builder",
        code: "unrepresentable-parameter-additional-properties",
        message:
          "request.query additional properties cannot be represented as OpenAPI parameters.",
        documentPath: "/paths/~1todos/get/parameters",
        location: {
          resourceName: "Todos",
          operationId: "getTodo",
          method: "GET",
          path: "/todos",
          openApiPath: "/todos",
          part: "request.query",
          parameterName: undefined,
          responseName: undefined,
          statusCode: undefined,
        },
      },
    ]);
  });
});

describe("buildOpenApiDocument header catchalls", () => {
  test("emits finite header parameters when header catchall entries are not representable", () => {
    const normalizedSpec = aTodoSpecWith({
      operations: [
        anOperationWith({
          request: {
            header: z.object({ "x-id": z.string() }).catchall(z.string()),
          },
          responses: [anInlineResponseUsage(aResponseWith())],
        }),
      ],
    });

    const result = buildOpenApiDocument(normalizedSpec, todoApiOptions());

    expect(result.document.paths["/todos"]?.get?.parameters).toEqual([
      {
        name: "x-id",
        in: "header",
        required: true,
        schema: { type: "string" },
      },
    ]);
    expect(result.warnings).toEqual([
      {
        origin: "openapi-builder",
        code: "unrepresentable-parameter-additional-properties",
        message:
          "request.header additional properties cannot be represented as OpenAPI parameters.",
        documentPath: "/paths/~1todos/get/parameters",
        location: {
          resourceName: "Todos",
          operationId: "getTodo",
          method: "GET",
          path: "/todos",
          openApiPath: "/todos",
          part: "request.header",
          parameterName: undefined,
          responseName: undefined,
          statusCode: undefined,
        },
      },
    ]);
  });
});
