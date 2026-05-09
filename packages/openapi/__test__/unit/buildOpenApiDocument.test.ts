import type {
  NormalizedOperation,
  NormalizedResponse,
  NormalizedResponseUsage,
  NormalizedSpec,
} from "@rexeus/typeweaver-gen";
import { describe, expect, test } from "vitest";
import { z } from "zod";
import { buildOpenApiDocument } from "../../src/index.js";

describe("buildOpenApiDocument", () => {
  test("builds an OpenAPI 3.1.1 document shell for an empty spec", () => {
    const normalizedSpec = aNormalizedSpecWith();

    const result = buildOpenApiDocument(normalizedSpec, {
      info: { title: "Todo API", version: "1.0.0" },
    });

    expect(result).toEqual({
      document: {
        openapi: "3.1.1",
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

    const result = buildOpenApiDocument(normalizedSpec, todoApiInfo());

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

    const result = buildOpenApiDocument(normalizedSpec, todoApiInfo());

    expect(result.document.paths["/todos"]?.post?.requestBody).toEqual({
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: { title: { type: "string" } },
            required: ["title"],
            additionalProperties: false,
          },
        },
      },
    });
    expect(result.warnings).toEqual([]);
  });

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

    const result = buildOpenApiDocument(normalizedSpec, todoApiInfo());

    expect(result.document.paths["/todos"]?.post?.requestBody).toEqual({
      required: false,
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: { title: { type: "string" } },
            required: ["title"],
            additionalProperties: false,
          },
        },
      },
    });
    expect(result.warnings).toEqual([]);
  });

  test("maps canonical response references", () => {
    const successResponse = aResponseWith({
      name: "TodoResponse",
      statusCode: 200 as NormalizedResponse["statusCode"],
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
          responses: [{ responseName: "TodoResponse", source: "canonical" }],
        }),
      ],
    });

    const result = buildOpenApiDocument(normalizedSpec, todoApiInfo());

    expect(result.document.components?.responses).toEqual({
      TodoResponse: {
        description: "Todo found",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: { id: { type: "string" } },
              required: ["id"],
              additionalProperties: false,
            },
          },
        },
      },
    });
    expect(result.document.paths["/todos/{id}"]?.get?.responses).toEqual({
      "200": { $ref: "#/components/responses/TodoResponse" },
    });
    expect(result.warnings).toEqual([]);
  });

  test("escapes canonical response references without changing component keys", () => {
    const successResponse = aResponseWith({
      name: "Todo/Success~Response",
      statusCode: 200 as NormalizedResponse["statusCode"],
    });
    const normalizedSpec = aTodoSpecWith({
      responses: [successResponse],
      operations: [
        anOperationWith({
          responses: [
            { responseName: "Todo/Success~Response", source: "canonical" },
          ],
        }),
      ],
    });

    const result = buildOpenApiDocument(normalizedSpec, todoApiInfo());

    expect(result.document.components?.responses).toEqual({
      "Todo/Success~Response": { description: "OK" },
    });
    expect(result.document.paths["/todos"]?.get?.responses).toEqual({
      "200": { $ref: "#/components/responses/Todo~1Success~0Response" },
    });
    expect(result.warnings).toEqual([]);
  });

  test("maps inline response bodies", () => {
    const normalizedSpec = aTodoSpecWith({
      operations: [
        anOperationWith({
          responses: [
            anInlineResponseUsage(
              aResponseWith({
                description: "Todo found",
                body: z.object({ id: z.string() }),
              })
            ),
          ],
        }),
      ],
    });

    const result = buildOpenApiDocument(normalizedSpec, todoApiInfo());

    expect(result.document.paths["/todos"]?.get?.responses).toEqual({
      "200": {
        description: "Todo found",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: { id: { type: "string" } },
              required: ["id"],
              additionalProperties: false,
            },
          },
        },
      },
    });
    expect(result.warnings).toEqual([]);
  });

  test("maps required and optional inline response headers", () => {
    const normalizedSpec = aTodoSpecWith({
      operations: [
        anOperationWith({
          responses: [
            anInlineResponseUsage(
              aResponseWith({
                header: z.object({
                  etag: z.string(),
                  "x-cache": z.string().optional(),
                }),
              })
            ),
          ],
        }),
      ],
    });

    const result = buildOpenApiDocument(normalizedSpec, todoApiInfo());

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

    const result = buildOpenApiDocument(normalizedSpec, todoApiInfo());

    expect(result.document.paths["/todos"]).toEqual({
      get: {
        operationId: "listTodos",
        tags: ["Todos"],
        responses: { "200": { description: "OK" } },
      },
      post: {
        operationId: "createTodo",
        tags: ["Todos"],
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

    const result = buildOpenApiDocument(normalizedSpec, todoApiInfo());

    expect(result.document.paths["/todos"]?.get).toEqual({
      operationId: "getTodo",
      tags: ["Todos"],
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

    const result = buildOpenApiDocument(normalizedSpec, todoApiInfo());

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

    const result = buildOpenApiDocument(normalizedSpec, todoApiInfo());

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

  test("emits a required path parameter with an empty schema when its schema is missing", () => {
    const normalizedSpec = aTodoSpecWith({
      operations: [
        anOperationWith({
          path: "/todos/:id",
          responses: [anInlineResponseUsage(aResponseWith())],
        }),
      ],
    });

    const result = buildOpenApiDocument(normalizedSpec, todoApiInfo());

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

    const result = buildOpenApiDocument(normalizedSpec, todoApiInfo());

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

  test("omits missing canonical response usages and emits a diagnostic", () => {
    const normalizedSpec = aTodoSpecWith({
      operations: [
        anOperationWith({
          responses: [{ responseName: "MissingResponse", source: "canonical" }],
        }),
      ],
    });

    const result = buildOpenApiDocument(normalizedSpec, todoApiInfo());

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

  test("keeps the first response when duplicate status codes are used", () => {
    const normalizedSpec = aTodoSpecWith({
      operations: [
        anOperationWith({
          responses: [
            anInlineResponseUsage(aResponseWith({ description: "First" })),
            anInlineResponseUsage(aResponseWith({ description: "Second" })),
          ],
        }),
      ],
    });

    const result = buildOpenApiDocument(normalizedSpec, todoApiInfo());

    expect(result.document.paths["/todos"]?.get?.responses).toEqual({
      "200": { description: "First" },
    });
    expect(result.warnings).toEqual([
      {
        origin: "openapi-builder",
        code: "duplicate-response-status",
        message: "Response status '200' is already defined for this operation.",
        documentPath: "/paths/~1todos/get/responses/200",
        location: {
          resourceName: "Todos",
          operationId: "getTodo",
          method: "GET",
          path: "/todos",
          openApiPath: "/todos",
          part: "response",
          responseName: "OkResponse",
          statusCode: "200",
        },
      },
    ]);
  });

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

    const result = buildOpenApiDocument(normalizedSpec, todoApiInfo());

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

    const result = buildOpenApiDocument(normalizedSpec, todoApiInfo());

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

    const result = buildOpenApiDocument(normalizedSpec, todoApiInfo());

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

  test("rebases schema conversion warnings to the OpenAPI request body path", () => {
    const normalizedSpec = aTodoSpecWith({
      operations: [
        anOperationWith({
          operationId: "createTodo",
          method: "POST" as NormalizedOperation["method"],
          request: { body: z.object({ value: z.custom<string>() }) },
          responses: [anInlineResponseUsage(aResponseWith())],
        }),
      ],
    });

    const result = buildOpenApiDocument(normalizedSpec, todoApiInfo());

    expect(result.warnings).toEqual([
      {
        origin: "schema-conversion",
        code: "unsupported-schema",
        message:
          "Zod custom falls back to a broader JSON Schema representation.",
        schemaType: "custom",
        schemaPath: "/properties/value",
        documentPath:
          "/paths/~1todos/post/requestBody/content/application~1json/schema/properties/value",
        location: {
          resourceName: "Todos",
          operationId: "createTodo",
          method: "POST",
          path: "/todos",
          openApiPath: "/todos",
          part: "request.body",
        },
      },
    ]);
  });

  test("rebases schema conversion warnings for canonical component response bodies", () => {
    const warningResponse = aResponseWith({
      name: "WarningResponse",
      body: z.object({ value: z.custom<string>() }),
    });
    const normalizedSpec = aTodoSpecWith({ responses: [warningResponse] });

    const result = buildOpenApiDocument(normalizedSpec, todoApiInfo());

    expect(result.warnings).toEqual([
      {
        origin: "schema-conversion",
        code: "unsupported-schema",
        message:
          "Zod custom falls back to a broader JSON Schema representation.",
        schemaType: "custom",
        schemaPath: "/properties/value",
        documentPath:
          "/components/responses/WarningResponse/content/application~1json/schema/properties/value",
        location: {
          resourceName: "components.responses",
          operationId: "WarningResponse",
          method: "components",
          path: "#/components/responses",
          openApiPath: "#/components/responses",
          part: "response.body",
          responseName: "WarningResponse",
          statusCode: "200",
        },
      },
    ]);
  });

  test("rebases schema conversion warnings for inline response bodies", () => {
    const normalizedSpec = aTodoSpecWith({
      operations: [
        anOperationWith({
          responses: [
            anInlineResponseUsage(
              aResponseWith({ body: z.object({ value: z.custom<string>() }) })
            ),
          ],
        }),
      ],
    });

    const result = buildOpenApiDocument(normalizedSpec, todoApiInfo());

    expect(result.warnings).toEqual([
      {
        origin: "schema-conversion",
        code: "unsupported-schema",
        message:
          "Zod custom falls back to a broader JSON Schema representation.",
        schemaType: "custom",
        schemaPath: "/properties/value",
        documentPath:
          "/paths/~1todos/get/responses/200/content/application~1json/schema/properties/value",
        location: {
          resourceName: "Todos",
          operationId: "getTodo",
          method: "GET",
          path: "/todos",
          openApiPath: "/todos",
          part: "response.body",
          responseName: "OkResponse",
          statusCode: "200",
        },
      },
    ]);
  });

  test("rebases response header schema warnings to the specific header schema", () => {
    const normalizedSpec = aTodoSpecWith({
      operations: [
        anOperationWith({
          responses: [
            anInlineResponseUsage(
              aResponseWith({
                header: z.object({
                  id: z.string(),
                  identifier: z
                    .string()
                    .refine(value => value.startsWith("ok")),
                }),
              })
            ),
          ],
        }),
      ],
    });

    const result = buildOpenApiDocument(normalizedSpec, todoApiInfo());

    expect(result.warnings).toEqual([
      {
        origin: "schema-conversion",
        code: "unsupported-check",
        message:
          "Zod string check custom cannot be represented exactly in JSON Schema.",
        schemaType: "string",
        schemaPath: "/properties/identifier",
        documentPath:
          "/paths/~1todos/get/responses/200/headers/identifier/schema",
        location: {
          resourceName: "Todos",
          operationId: "getTodo",
          method: "GET",
          path: "/todos",
          openApiPath: "/todos",
          part: "response.header",
          parameterName: "identifier",
          responseName: "OkResponse",
          statusCode: "200",
        },
      },
    ]);
  });

  test("uses JSON Pointer segment boundaries when rebasing query parameter warnings", () => {
    const normalizedSpec = aTodoSpecWith({
      operations: [
        anOperationWith({
          request: {
            query: z.object({
              id: z.string(),
              identifier: z.string().refine(value => value.startsWith("ok")),
            }),
          },
          responses: [anInlineResponseUsage(aResponseWith())],
        }),
      ],
    });

    const result = buildOpenApiDocument(normalizedSpec, todoApiInfo());

    expect(result.warnings).toEqual([
      {
        origin: "schema-conversion",
        code: "unsupported-check",
        message:
          "Zod string check custom cannot be represented exactly in JSON Schema.",
        schemaType: "string",
        schemaPath: "/properties/identifier",
        documentPath: "/paths/~1todos/get/parameters/1/schema",
        location: {
          resourceName: "Todos",
          operationId: "getTodo",
          method: "GET",
          path: "/todos",
          openApiPath: "/todos",
          part: "request.query",
          parameterName: "identifier",
        },
      },
    ]);
  });

  test("rebases local JSON Schema refs in recursive request bodies", () => {
    const treeNodeSchema = aRecursiveTreeNodeSchema();
    const normalizedSpec = aTodoSpecWith({
      operations: [
        anOperationWith({
          operationId: "createTree",
          method: "POST" as NormalizedOperation["method"],
          path: "/trees",
          request: { body: treeNodeSchema },
          responses: [anInlineResponseUsage(aResponseWith())],
        }),
      ],
    });

    const result = buildOpenApiDocument(normalizedSpec, todoApiInfo());

    expect(result.document.paths["/trees"]?.post?.requestBody).toEqual({
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              name: { type: "string" },
              children: {
                type: "array",
                items: {
                  $ref: "#/paths/~1trees/post/requestBody/content/application~1json/schema",
                },
              },
            },
            required: ["name", "children"],
            additionalProperties: false,
          },
        },
      },
    });
    expect(result.warnings).toEqual([]);
  });

  test("rebases local JSON Schema refs in recursive inline response bodies", () => {
    const treeNodeSchema = aRecursiveTreeNodeSchema();
    const normalizedSpec = aTodoSpecWith({
      operations: [
        anOperationWith({
          operationId: "getTree",
          path: "/trees/:id",
          request: { param: z.object({ id: z.string() }) },
          responses: [
            anInlineResponseUsage(aResponseWith({ body: treeNodeSchema })),
          ],
        }),
      ],
    });

    const result = buildOpenApiDocument(normalizedSpec, todoApiInfo());

    expect(result.document.paths["/trees/{id}"]?.get?.responses["200"]).toEqual(
      {
        description: "OK",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                name: { type: "string" },
                children: {
                  type: "array",
                  items: {
                    $ref: "#/paths/~1trees~1{id}/get/responses/200/content/application~1json/schema",
                  },
                },
              },
              required: ["name", "children"],
              additionalProperties: false,
            },
          },
        },
      }
    );
    expect(result.warnings).toEqual([]);
  });

  test("preserves root definitions used by recursive query parameter schemas", () => {
    const treeNodeSchema = aRecursiveTreeNodeSchema();
    const normalizedSpec = aTodoSpecWith({
      operations: [
        anOperationWith({
          operationId: "searchTrees",
          path: "/trees",
          request: {
            query: aQuerySchemaForBuilder(z.object({ tree: treeNodeSchema })),
          },
          responses: [anInlineResponseUsage(aResponseWith())],
        }),
      ],
    });

    const result = buildOpenApiDocument(normalizedSpec, todoApiInfo());

    expect(result.document.paths["/trees"]?.get?.parameters).toEqual([
      {
        name: "tree",
        in: "query",
        required: true,
        schema: {
          $ref: "#/paths/~1trees/get/parameters/0/schema/$defs/__schema0",
          $defs: {
            __schema0: {
              type: "object",
              properties: {
                name: { type: "string" },
                children: {
                  type: "array",
                  items: {
                    $ref: "#/paths/~1trees/get/parameters/0/schema/$defs/__schema0",
                  },
                },
              },
              required: ["name", "children"],
              additionalProperties: false,
            },
          },
        },
      },
    ]);
    expect(result.warnings).toEqual([]);
  });

  test("preserves root definitions used by recursive response header schemas", () => {
    const treeNodeSchema = aRecursiveTreeNodeSchema();
    const normalizedSpec = aTodoSpecWith({
      operations: [
        anOperationWith({
          operationId: "getTree",
          path: "/trees",
          responses: [
            anInlineResponseUsage(
              aResponseWith({
                header: aHeaderSchemaForBuilder(
                  z.object({ "x-tree": treeNodeSchema })
                ),
              })
            ),
          ],
        }),
      ],
    });

    const result = buildOpenApiDocument(normalizedSpec, todoApiInfo());

    expect(result.document.paths["/trees"]?.get?.responses["200"]).toEqual({
      description: "OK",
      headers: {
        "x-tree": {
          required: true,
          schema: {
            $ref: "#/paths/~1trees/get/responses/200/headers/x-tree/schema/$defs/__schema0",
            $defs: {
              __schema0: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  children: {
                    type: "array",
                    items: {
                      $ref: "#/paths/~1trees/get/responses/200/headers/x-tree/schema/$defs/__schema0",
                    },
                  },
                },
                required: ["name", "children"],
                additionalProperties: false,
              },
            },
          },
        },
      },
    });
    expect(result.warnings).toEqual([]);
  });

  test("returns deterministic output for the same normalized spec", () => {
    const normalizedSpec = aTodoSpecWith({
      operations: [
        anOperationWith({
          responses: [anInlineResponseUsage(aResponseWith())],
        }),
      ],
    });

    const firstResult = buildOpenApiDocument(normalizedSpec, todoApiInfo());
    const secondResult = buildOpenApiDocument(normalizedSpec, todoApiInfo());

    expect(secondResult).toEqual(firstResult);
  });

  test("does not mutate the normalized spec", () => {
    const operation = anOperationWith({
      path: "/todos//",
      responses: [anInlineResponseUsage(aResponseWith())],
    });
    const resources = [{ name: "Todos", operations: [operation] }];
    const normalizedSpec = aNormalizedSpecWith({ resources });

    buildOpenApiDocument(normalizedSpec, todoApiInfo());

    expect(normalizedSpec.resources).toBe(resources);
    expect(normalizedSpec.resources[0]?.operations[0]).toBe(operation);
    expect(operation.path).toBe("/todos//");
  });

  test("normalizes duplicate and trailing path slashes", () => {
    const normalizedSpec = aTodoSpecWith({
      operations: [
        anOperationWith({
          path: "/todos//",
          responses: [anInlineResponseUsage(aResponseWith())],
        }),
      ],
    });

    const result = buildOpenApiDocument(normalizedSpec, todoApiInfo());

    expect(result.document.paths).toEqual({
      "/todos": {
        get: {
          operationId: "getTodo",
          tags: ["Todos"],
          responses: { "200": { description: "OK" } },
        },
      },
    });
  });
});

type TreeNode = {
  readonly name: string;
  readonly children: readonly TreeNode[];
};

function todoApiInfo() {
  return { info: { title: "Todo API", version: "1.0.0" } };
}

function aTodoSpecWith(
  overrides: {
    readonly operations?: readonly NormalizedOperation[];
    readonly responses?: readonly NormalizedResponse[];
  } = {}
): NormalizedSpec {
  return aNormalizedSpecWith({
    resources: [{ name: "Todos", operations: overrides.operations ?? [] }],
    responses: overrides.responses ?? [],
  });
}

function aNormalizedSpecWith(
  overrides: Partial<NormalizedSpec> = {}
): NormalizedSpec {
  return {
    resources: [],
    responses: [],
    ...overrides,
  };
}

function anOperationWith(
  overrides: Partial<NormalizedOperation> = {}
): NormalizedOperation {
  return {
    operationId: "getTodo",
    method: "GET" as NormalizedOperation["method"],
    path: "/todos",
    summary: "",
    responses: [],
    ...overrides,
  };
}

function aResponseWith(
  overrides: Partial<NormalizedResponse> = {}
): NormalizedResponse {
  return {
    name: "OkResponse",
    statusCode: 200 as NormalizedResponse["statusCode"],
    statusCodeName: "Ok",
    description: "OK",
    kind: "response",
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

function aQuerySchemaForBuilder(
  schema: z.core.$ZodType
): NonNullable<NormalizedOperation["request"]>["query"] {
  return schema as unknown as NonNullable<
    NormalizedOperation["request"]
  >["query"];
}

function aHeaderSchemaForBuilder(
  schema: z.core.$ZodType
): NormalizedResponse["header"] {
  return schema as unknown as NormalizedResponse["header"];
}

function aRecursiveTreeNodeSchema(): z.ZodType<TreeNode> {
  const treeNodeSchema: z.ZodType<TreeNode> = z.lazy(() =>
    z.object({ name: z.string(), children: z.array(treeNodeSchema) })
  );

  return treeNodeSchema;
}
