import type {
  NormalizedOperation,
  NormalizedResponse,
  NormalizedResponseUsage,
} from "@rexeus/typeweaver-gen";
import { describe, expect, test } from "vitest";
import { z } from "zod";
import { buildOpenApiDocument } from "../../src/index.js";
import {
  aCanonicalResponseUsage,
  aHeaderSchemaForBuilder,
  anInlineResponseUsage,
  anOperationWith,
  aRecursiveTreeNodeSchema,
  aResponseWith,
  aTodoSpecWith,
  todoApiInfo,
} from "./buildOpenApiDocument.helpers.js";

const OK_STATUS = 200 as NormalizedResponse["statusCode"];
const NOT_FOUND_STATUS = 404 as NormalizedResponse["statusCode"];

describe("buildOpenApiDocument responses", () => {
  describe("single responses and references", () => {
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

      const result = buildOpenApiDocument(normalizedSpec, todoApiInfo());

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
              anInlineOkResponse({
                description: "Todo found",
                body: z.object({ id: z.string() }),
              }),
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
  });

  describe("status grouping", () => {
    test("omits missing canonical response usages and emits a diagnostic", () => {
      const normalizedSpec = aTodoSpecWith({
        operations: [
          anOperationWith({
            responses: [
              { responseName: "MissingResponse", source: "canonical" },
            ],
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

    test("merges duplicate inline response statuses without a diagnostic", () => {
      const normalizedSpec = aTodoSpecWith({
        operations: [
          anOperationWithDuplicateOkResponses([
            anInlineOkResponse({ description: "First" }),
            anInlineOkResponse({ description: "Second" }),
          ]),
        ],
      });

      const result = buildOpenApiDocument(normalizedSpec, todoApiInfo());

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

      const result = buildOpenApiDocument(normalizedSpec, todoApiInfo());

      expect(result.document.paths["/todos"]?.get?.responses).toEqual({
        "200": { description: "Todo found" },
        "404": { description: "Todo missing" },
      });
      expect(result.warnings).toEqual([]);
    });
  });

  describe("duplicate response bodies", () => {
    test("merges duplicate inline response bodies with anyOf", () => {
      const normalizedSpec = aTodoSpecWith({
        operations: [
          anOperationWithDuplicateOkResponses([
            anInlineOkResponse({
              name: "TodoFound",
              description: "Todo found",
              body: z.object({ id: z.string() }),
            }),
            anInlineOkResponse({
              name: "ValidationError",
              description: "Validation failed",
              body: z.object({ message: z.string() }),
            }),
          ]),
        ],
      });

      const result = buildOpenApiDocument(normalizedSpec, todoApiInfo());

      expect(result.document.paths["/todos"]?.get?.responses["200"]).toEqual({
        description:
          "TodoFound: Todo found\n\nValidationError: Validation failed",
        content: {
          "application/json": {
            schema: {
              anyOf: [
                { $ref: "#/components/schemas/GetTodoTodoFoundBody" },
                { $ref: "#/components/schemas/GetTodoValidationErrorBody" },
              ],
            },
          },
        },
      });
      expect(result.warnings).toEqual([]);
    });

    test("merges duplicate canonical response bodies with anyOf refs", () => {
      const todoResponse = aCanonicalOkResponse({
        name: "TodoFound",
        description: "Todo found",
        body: z.object({ id: z.string() }),
      });
      const validationResponse = aCanonicalOkResponse({
        name: "ValidationError",
        description: "Validation failed",
        body: z.object({ message: z.string() }),
      });
      const normalizedSpec = aTodoSpecWith({
        responses: [todoResponse, validationResponse],
        operations: [
          anOperationWithDuplicateOkResponses([
            aCanonicalResponseUsage("TodoFound"),
            aCanonicalResponseUsage("ValidationError"),
          ]),
        ],
      });

      const result = buildOpenApiDocument(normalizedSpec, todoApiInfo());

      expect(result.document.paths["/todos"]?.get?.responses["200"]).toEqual({
        description:
          "TodoFound: Todo found\n\nValidationError: Validation failed",
        content: {
          "application/json": {
            schema: {
              anyOf: [
                { $ref: "#/components/schemas/TodoFoundBody" },
                { $ref: "#/components/schemas/ValidationErrorBody" },
              ],
            },
          },
        },
      });
      expect(result.warnings).toEqual([]);
    });

    test("merges mixed canonical and inline duplicate response bodies with anyOf refs", () => {
      const todoResponse = aCanonicalOkResponse({
        name: "TodoFound",
        description: "Todo found",
        body: z.object({ id: z.string() }),
      });
      const normalizedSpec = aTodoSpecWith({
        responses: [todoResponse],
        operations: [
          anOperationWithDuplicateOkResponses([
            aCanonicalResponseUsage("TodoFound"),
            anInlineOkResponse({
              name: "ValidationError",
              description: "Validation failed",
              body: z.object({ message: z.string() }),
            }),
          ]),
        ],
      });

      const result = buildOpenApiDocument(normalizedSpec, todoApiInfo());

      expect(result.document.paths["/todos"]?.get?.responses["200"]).toEqual({
        description:
          "TodoFound: Todo found\n\nValidationError: Validation failed",
        content: {
          "application/json": {
            schema: {
              anyOf: [
                { $ref: "#/components/schemas/TodoFoundBody" },
                { $ref: "#/components/schemas/GetTodoValidationErrorBody" },
              ],
            },
          },
        },
      });
      expect(result.warnings).toEqual([]);
    });

    test("dedupes duplicate response bodies with the same Zod schema object to a direct ref", () => {
      const sharedBody = z.object({ id: z.string() });
      const normalizedSpec = aTodoSpecWith({
        operations: [
          anOperationWithDuplicateOkResponses([
            anInlineOkResponse({
              name: "TodoFound",
              description: "Todo found",
              body: sharedBody,
            }),
            anInlineOkResponse({
              name: "TodoCached",
              description: "Todo cached",
              body: sharedBody,
            }),
          ]),
        ],
      });

      const result = buildOpenApiDocument(normalizedSpec, todoApiInfo());

      expect(result.document.paths["/todos"]?.get?.responses["200"]).toEqual({
        description: "TodoFound: Todo found\n\nTodoCached: Todo cached",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/GetTodoTodoFoundBody" },
          },
        },
      });
      expect(result.document.components?.schemas).toEqual({
        GetTodoTodoFoundBody: {
          type: "object",
          properties: { id: { type: "string" } },
          required: ["id"],
          additionalProperties: false,
        },
      });
      expect(result.warnings).toEqual([]);
    });

    test("rebases schema conversion warnings for merged duplicate response bodies to the component schema", () => {
      const normalizedSpec = aTodoSpecWith({
        operations: [
          anOperationWithDuplicateOkResponses([
            anInlineOkResponse({
              name: "WarningResponse",
              body: z.object({ value: z.custom<string>() }),
            }),
            anInlineOkResponse({
              name: "OkResponse",
              body: z.object({ id: z.string() }),
            }),
          ]),
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
            "/components/schemas/GetTodoWarningResponseBody/properties/value",
          location: {
            resourceName: "Todos",
            operationId: "getTodo",
            method: "GET",
            path: "/todos",
            openApiPath: "/todos",
            part: "response.body",
            responseName: "WarningResponse",
            statusCode: "200",
          },
        },
      ]);
    });

    test("merges duplicate bodyful and bodyless responses with a direct body ref", () => {
      const normalizedSpec = aTodoSpecWith({
        operations: [
          anOperationWithDuplicateOkResponses([
            anInlineOkResponse({ body: z.object({ id: z.string() }) }),
            anInlineOkResponse({ name: "NoBody" }),
          ]),
        ],
      });

      const result = buildOpenApiDocument(normalizedSpec, todoApiInfo());

      expect(result.document.paths["/todos"]?.get?.responses["200"]).toEqual({
        description: "OkResponse: OK\n\nNoBody: OK",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/GetTodoOkResponseBody" },
          },
        },
      });
      expect(result.warnings).toEqual([]);
    });

    test("merges duplicate bodyless responses without content", () => {
      const normalizedSpec = aTodoSpecWith({
        operations: [
          anOperationWithDuplicateOkResponses([
            anInlineOkResponse({ name: "OkResponse" }),
            anInlineOkResponse({ name: "NoBody" }),
          ]),
        ],
      });

      const result = buildOpenApiDocument(normalizedSpec, todoApiInfo());

      expect(result.document.paths["/todos"]?.get?.responses["200"]).toEqual({
        description: "OkResponse: OK\n\nNoBody: OK",
      });
      expect(result.warnings).toEqual([]);
    });
  });

  describe("merged response headers", () => {
    test("keeps a merged header description and direct schema when all variants match", () => {
      const normalizedSpec = aTodoSpecWith({
        operations: [
          anOperationWithDuplicateOkResponses([
            anInlineOkResponse({
              name: "OkResponse",
              header: z.object({
                "x-correlation-id": z
                  .string()
                  .describe("Correlation ID for the response."),
              }),
            }),
            anInlineOkResponse({
              name: "CachedResponse",
              header: z.object({
                "x-correlation-id": z
                  .string()
                  .describe("Correlation ID for the response."),
              }),
            }),
          ]),
        ],
      });

      const result = buildOpenApiDocument(normalizedSpec, todoApiInfo());

      expect(result.document.paths["/todos"]?.get?.responses["200"]).toEqual({
        description: "OkResponse: OK\n\nCachedResponse: OK",
        headers: {
          "x-correlation-id": {
            description: "Correlation ID for the response.",
            required: true,
            schema: { type: "string" },
          },
        },
      });
      expect(result.warnings).toEqual([]);
    });

    test("merges differing header schemas with anyOf without a diagnostic", () => {
      const normalizedSpec = aTodoSpecWith({
        operations: [
          anOperationWithDuplicateOkResponses([
            anInlineOkResponse({
              name: "StringHeader",
              header: z.object({ "x-retry-after": z.string() }),
            }),
            anInlineOkResponse({
              name: "ArrayHeader",
              header: z.object({ "x-retry-after": z.array(z.string()) }),
            }),
          ]),
        ],
      });

      const result = buildOpenApiDocument(normalizedSpec, todoApiInfo());

      expect(result.document.paths["/todos"]?.get?.responses["200"]).toEqual({
        description: "StringHeader: OK\n\nArrayHeader: OK",
        headers: {
          "x-retry-after": {
            required: true,
            schema: {
              anyOf: [
                { type: "string" },
                { type: "array", items: { type: "string" } },
              ],
            },
          },
        },
      });
      expect(result.warnings).toEqual([]);
    });

    test("rebases recursive merged header refs to their emitted anyOf branch", () => {
      const treeNodeSchema = aRecursiveTreeNodeSchema();
      const normalizedSpec = aTodoSpecWith({
        operations: [
          anOperationWithDuplicateOkResponses(
            [
              anInlineOkResponse({
                name: "TreeHeader",
                header: aHeaderSchemaForBuilder(
                  z.object({ "x-tree": treeNodeSchema })
                ),
              }),
              anInlineOkResponse({
                name: "TreeSummaryHeader",
                header: aHeaderSchemaForBuilder(
                  z.object({
                    "x-tree": z.object({
                      name: z.string(),
                      depth: z.number(),
                    }),
                  })
                ),
              }),
            ],
            { operationId: "getTree", path: "/trees" }
          ),
        ],
      });

      const result = buildOpenApiDocument(normalizedSpec, todoApiInfo());

      expect(result.document.paths["/trees"]?.get?.responses["200"]).toEqual({
        description: "TreeHeader: OK\n\nTreeSummaryHeader: OK",
        headers: {
          "x-tree": {
            required: true,
            schema: {
              anyOf: [
                {
                  $ref: "#/paths/~1trees/get/responses/200/headers/x-tree/schema/anyOf/0/$defs/__schema0",
                  $defs: {
                    __schema0: {
                      type: "object",
                      properties: {
                        name: { type: "string" },
                        children: {
                          type: "array",
                          items: {
                            $ref: "#/paths/~1trees/get/responses/200/headers/x-tree/schema/anyOf/0/$defs/__schema0",
                          },
                        },
                      },
                      required: ["name", "children"],
                      additionalProperties: false,
                    },
                  },
                },
                {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    depth: { type: "number" },
                  },
                  required: ["name", "depth"],
                  additionalProperties: false,
                },
              ],
            },
          },
        },
      });
      expect(result.warnings).toEqual([]);
    });

    test("rebases schema conversion warnings for merged response headers to the anyOf branch", () => {
      const normalizedSpec = aTodoSpecWith({
        operations: [
          anOperationWithDuplicateOkResponses([
            anInlineOkResponse({
              name: "StringHeader",
              header: z.object({
                "x-retry-after": z
                  .string()
                  .refine(value => value.startsWith("retry")),
              }),
            }),
            anInlineOkResponse({
              name: "NumberHeader",
              header: aHeaderSchemaForBuilder(
                z.object({ "x-retry-after": z.number() })
              ),
            }),
          ]),
        ],
      });

      const result = buildOpenApiDocument(normalizedSpec, todoApiInfo());

      expect(result.document.paths["/todos"]?.get?.responses["200"]).toEqual({
        description: "StringHeader: OK\n\nNumberHeader: OK",
        headers: {
          "x-retry-after": {
            required: true,
            schema: {
              anyOf: [{ type: "string" }, { type: "number" }],
            },
          },
        },
      });
      expect(result.warnings).toEqual([
        {
          origin: "schema-conversion",
          code: "unsupported-check",
          message:
            "Zod string check custom cannot be represented exactly in JSON Schema.",
          schemaType: "string",
          schemaPath: "/properties/x-retry-after",
          documentPath:
            "/paths/~1todos/get/responses/200/headers/x-retry-after/schema/anyOf/0",
          location: {
            resourceName: "Todos",
            operationId: "getTodo",
            method: "GET",
            path: "/todos",
            openApiPath: "/todos",
            part: "response.header",
            parameterName: "x-retry-after",
            responseName: "StringHeader",
            statusCode: "200",
          },
        },
      ]);
    });

    test("does not read inherited properties when merging a constructor header", () => {
      const normalizedSpec = aTodoSpecWith({
        operations: [
          anOperationWithDuplicateOkResponses([
            anInlineOkResponse({
              name: "WithConstructorHeader",
              header: z.object({ constructor: z.string() }),
            }),
            anInlineOkResponse({ name: "WithoutConstructorHeader" }),
          ]),
        ],
      });

      const result = buildOpenApiDocument(normalizedSpec, todoApiInfo());

      expect(result.document.paths["/todos"]?.get?.responses["200"]).toEqual({
        description:
          "WithConstructorHeader: OK\n\nWithoutConstructorHeader: OK",
        headers: {
          constructor: {
            required: false,
            schema: { type: "string" },
          },
        },
      });
      expect(result.warnings).toEqual([]);
    });

    test("marks a merged header optional when only some variants emit it", () => {
      const normalizedSpec = aTodoSpecWith({
        operations: [
          anOperationWithDuplicateOkResponses([
            anInlineOkResponse({
              name: "WithHeader",
              header: z.object({ "x-correlation-id": z.string() }),
            }),
            anInlineOkResponse({ name: "WithoutHeader" }),
          ]),
        ],
      });

      const result = buildOpenApiDocument(normalizedSpec, todoApiInfo());

      expect(result.document.paths["/todos"]?.get?.responses["200"]).toEqual({
        description: "WithHeader: OK\n\nWithoutHeader: OK",
        headers: {
          "x-correlation-id": {
            required: false,
            schema: { type: "string" },
          },
        },
      });
      expect(result.warnings).toEqual([]);
    });

    test("marks a merged header optional when any variant emits it as optional", () => {
      const normalizedSpec = aTodoSpecWith({
        operations: [
          anOperationWithDuplicateOkResponses([
            anInlineOkResponse({
              name: "RequiredHeader",
              header: z.object({ "x-correlation-id": z.string() }),
            }),
            anInlineOkResponse({
              name: "OptionalHeader",
              header: z.object({ "x-correlation-id": z.string().optional() }),
            }),
          ]),
        ],
      });

      const result = buildOpenApiDocument(normalizedSpec, todoApiInfo());

      expect(result.document.paths["/todos"]?.get?.responses["200"]).toEqual({
        description: "RequiredHeader: OK\n\nOptionalHeader: OK",
        headers: {
          "x-correlation-id": {
            required: false,
            schema: { type: "string" },
          },
        },
      });
      expect(result.warnings).toEqual([]);
    });

    test("combines differing merged header descriptions with variant bullets", () => {
      const normalizedSpec = aTodoSpecWith({
        operations: [
          anOperationWithDuplicateOkResponses([
            anInlineOkResponse({
              name: "OkResponse",
              header: z.object({
                "x-correlation-id": z
                  .string()
                  .describe("Correlation ID for successful responses."),
              }),
            }),
            anInlineOkResponse({
              name: "ValidationError",
              header: z.object({
                "x-correlation-id": z
                  .string()
                  .describe("Correlation ID for validation failures."),
              }),
            }),
          ]),
        ],
      });

      const result = buildOpenApiDocument(normalizedSpec, todoApiInfo());

      expect(result.document.paths["/todos"]?.get?.responses["200"]).toEqual({
        description: "OkResponse: OK\n\nValidationError: OK",
        headers: {
          "x-correlation-id": {
            description:
              "Header description merged from response variants:\n" +
              "- OkResponse: Correlation ID for successful responses.\n" +
              "- ValidationError: Correlation ID for validation failures.",
            required: true,
            schema: { type: "string" },
          },
        },
      });
      expect(result.warnings).toEqual([]);
    });

    test("omits merged header descriptions when no variant describes the header", () => {
      const normalizedSpec = aTodoSpecWith({
        operations: [
          anOperationWithDuplicateOkResponses([
            anInlineOkResponse({
              name: "OkResponse",
              header: z.object({ "x-correlation-id": z.string() }),
            }),
            anInlineOkResponse({
              name: "ValidationError",
              header: z.object({ "x-correlation-id": z.string() }),
            }),
          ]),
        ],
      });

      const result = buildOpenApiDocument(normalizedSpec, todoApiInfo());

      expect(result.document.paths["/todos"]?.get?.responses["200"]).toEqual({
        description: "OkResponse: OK\n\nValidationError: OK",
        headers: {
          "x-correlation-id": {
            required: true,
            schema: { type: "string" },
          },
        },
      });
      expect(result.warnings).toEqual([]);
    });
  });

  describe("warning paths", () => {
    test("rebases schema conversion warnings for canonical component response bodies", () => {
      const warningResponse = aCanonicalOkResponse({
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
            "/components/schemas/WarningResponseBody/properties/value",
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
              anInlineOkResponse({
                body: z.object({ value: z.custom<string>() }),
              }),
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
            "/components/schemas/GetTodoOkResponseBody/properties/value",
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
              anInlineOkResponse({
                header: z.object({
                  id: z.string(),
                  identifier: z
                    .string()
                    .refine(value => value.startsWith("ok")),
                }),
              }),
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
  });

  describe("header schema refs", () => {
    test("preserves root definitions used by recursive response header schemas", () => {
      const treeNodeSchema = aRecursiveTreeNodeSchema();
      const normalizedSpec = aTodoSpecWith({
        operations: [
          anOperationWith({
            operationId: "getTree",
            path: "/trees",
            responses: [
              anInlineOkResponse({
                header: aHeaderSchemaForBuilder(
                  z.object({ "x-tree": treeNodeSchema })
                ),
              }),
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
  });
});

function anInlineOkResponse(
  overrides: Partial<NormalizedResponse> = {}
): NormalizedResponseUsage {
  return anInlineResponseUsage(
    aResponseWith({ statusCode: OK_STATUS, ...overrides })
  );
}

function aCanonicalOkResponse(
  overrides: Partial<NormalizedResponse> = {}
): NormalizedResponse {
  return aResponseWith({ statusCode: OK_STATUS, ...overrides });
}

function anOperationWithDuplicateOkResponses(
  responses: readonly NormalizedResponseUsage[],
  overrides: Partial<NormalizedOperation> = {}
): NormalizedOperation {
  return anOperationWith({ ...overrides, responses });
}
