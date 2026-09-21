import type { NormalizedOperation } from "@rexeus/typeweaver-gen";
import { describe, expect, test } from "vitest";
import { z } from "zod";
import { buildOpenApiDocument } from "../../src/index.js";
import {
  anInlineResponseUsage,
  anOperationWith,
  aResponseWith,
  aTodoSpecWith,
  todoApiOptions,
} from "./buildOpenApiDocument.helpers.js";

describe("buildOpenApiDocument operation and path ordering", () => {
  test("merges operations on the same normalized path without overwriting methods", () => {
    const normalizedSpec = aTodoSpecWith({
      operations: [
        anOperationWith({
          operationId: "listTodos",
          method: "GET" as NormalizedOperation["method"],
          path: "/todos//",
          responses: [anInlineResponseUsage(aResponseWith())],
        }),
        anOperationWith({
          operationId: "createTodo",
          method: "POST" as NormalizedOperation["method"],
          path: "todos",
          responses: [anInlineResponseUsage(aResponseWith())],
        }),
      ],
    });

    const result = buildOpenApiDocument(normalizedSpec, todoApiOptions());

    expect(result.document.paths["/todos"]).toEqual({
      get: {
        operationId: "listTodos",
        tags: [],
        responses: { "200": { description: "OK" } },
      },
      post: {
        operationId: "createTodo",
        tags: [],
        responses: { "200": { description: "OK" } },
      },
    });
    expect(result.warnings).toEqual([]);
  });

  test("adds a leading slash to paths without one", () => {
    const normalizedSpec = aTodoSpecWith({
      operations: [
        anOperationWith({
          path: "todos",
          responses: [anInlineResponseUsage(aResponseWith())],
        }),
      ],
    });

    const result = buildOpenApiDocument(normalizedSpec, todoApiOptions());

    expect(result.document.paths["/todos"]?.get).toEqual({
      operationId: "getTodo",
      tags: [],
      responses: { "200": { description: "OK" } },
    });
    expect(result.warnings).toEqual([]);
  });

  test("keeps path parameters in path order", () => {
    const normalizedSpec = aTodoSpecWith({
      operations: [
        anOperationWith({
          path: "/todos/:todoId/comments/:commentId",
          request: {
            param: z.object({ commentId: z.string(), todoId: z.string() }),
          },
          responses: [anInlineResponseUsage(aResponseWith())],
        }),
      ],
    });

    const result = buildOpenApiDocument(normalizedSpec, todoApiOptions());

    expect(
      result.document.paths["/todos/{todoId}/comments/{commentId}"]?.get
        ?.parameters
    ).toEqual([
      {
        name: "todoId",
        in: "path",
        required: true,
        schema: { type: "string" },
      },
      {
        name: "commentId",
        in: "path",
        required: true,
        schema: { type: "string" },
      },
    ]);
    expect(result.warnings).toEqual([]);
  });
});

describe("buildOpenApiDocument Typeweaver path syntax", () => {
  test("maps Typeweaver path parameters that start with digits", () => {
    const normalizedSpec = aTodoSpecWith({
      operations: [
        anOperationWith({
          path: "/todos/:123id",
          request: { param: z.object({ "123id": z.string() }) },
          responses: [anInlineResponseUsage(aResponseWith())],
        }),
      ],
    });

    const result = buildOpenApiDocument(normalizedSpec, todoApiOptions());

    expect(result.document.paths["/todos/{123id}"]?.get?.parameters).toEqual([
      {
        name: "123id",
        in: "path",
        required: true,
        schema: { type: "string" },
      },
    ]);
    expect(result.warnings).toEqual([]);
  });

  test("maps embedded Typeweaver path parameters within a segment", () => {
    const normalizedSpec = aTodoSpecWith({
      operations: [
        anOperationWith({
          operationId: "getFile",
          path: "/files/:name.:ext",
          request: { param: z.object({ name: z.string(), ext: z.string() }) },
          responses: [anInlineResponseUsage(aResponseWith())],
        }),
      ],
    });

    const result = buildOpenApiDocument(normalizedSpec, todoApiOptions());

    expect(
      result.document.paths["/files/{name}.{ext}"]?.get?.parameters
    ).toEqual([
      {
        name: "name",
        in: "path",
        required: true,
        schema: { type: "string" },
      },
      {
        name: "ext",
        in: "path",
        required: true,
        schema: { type: "string" },
      },
    ]);
    expect(result.warnings).toEqual([]);
  });
});

describe("buildOpenApiDocument missing path schemas", () => {
  test("emits a required path parameter with an empty schema when its schema is missing", () => {
    const normalizedSpec = aTodoSpecWith({
      operations: [
        anOperationWith({
          path: "/todos/:id",
          responses: [anInlineResponseUsage(aResponseWith())],
        }),
      ],
    });

    const result = buildOpenApiDocument(normalizedSpec, todoApiOptions());

    expect(result.document.paths["/todos/{id}"]?.get?.parameters).toEqual([
      { name: "id", in: "path", required: true, schema: {} },
    ]);
    expect(result.warnings).toEqual([
      {
        origin: "openapi-builder",
        code: "missing-path-parameter-schema",
        message: "Path parameter 'id' is missing a schema.",
        documentPath: "/paths/~1todos~1{id}/get/parameters/0/schema",
        location: {
          resourceName: "Todos",
          operationId: "getTodo",
          method: "GET",
          path: "/todos/:id",
          openApiPath: "/todos/{id}",
          part: "request.path",
          parameterName: "id",
          responseName: undefined,
          statusCode: undefined,
        },
      },
    ]);
  });

  test("warns about unused path parameter schemas without emitting extra parameters", () => {
    const normalizedSpec = aTodoSpecWith({
      operations: [
        anOperationWith({
          request: { param: z.object({ id: z.string() }) },
          responses: [anInlineResponseUsage(aResponseWith())],
        }),
      ],
    });

    const result = buildOpenApiDocument(normalizedSpec, todoApiOptions());

    expect(result.document.paths["/todos"]?.get?.parameters).toBeUndefined();
    expect(result.warnings).toEqual([
      {
        origin: "openapi-builder",
        code: "unused-path-parameter-schema",
        message: "Path parameter schema 'id' is not used by '/todos'.",
        documentPath: "/paths/~1todos/get/parameters",
        location: {
          resourceName: "Todos",
          operationId: "getTodo",
          method: "GET",
          path: "/todos",
          openApiPath: "/todos",
          part: "request.path",
          parameterName: "id",
          responseName: undefined,
          statusCode: undefined,
        },
      },
    ]);
  });
});

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
