import type { NormalizedOperation } from "@rexeus/typeweaver-gen";
import { describe, expect, test } from "vitest";
import { z } from "zod";
import { buildOpenApiDocument } from "../../src/index.js";
import {
  anInlineResponseUsage,
  anOperationWith,
  aQuerySchemaForBuilder,
  aResponseWith,
  aTodoSpecWith,
  todoApiOptions,
} from "./buildOpenApiDocument.helpers.js";

function aRequestHeaderSchemaForBuilder(
  schema: z.core.$ZodType
): NonNullable<NormalizedOperation["request"]>["header"] {
  return schema as unknown as NonNullable<
    NormalizedOperation["request"]
  >["header"];
}

describe("buildOpenApiDocument request body wrappers", () => {
  test.each([
    {
      scenario: "default",
      body: z.string().default("fallback"),
    },
    {
      scenario: "prefault",
      body: z.string().prefault("fallback"),
    },
    {
      scenario: "catch",
      body: z.string().catch("fallback"),
    },
  ])(
    "maps $scenario request body fallbacks to non-required inner schemas",
    ({ body }) => {
      const normalizedSpec = aTodoSpecWith({
        operations: [
          anOperationWith({
            operationId: "createTodo",
            method: "POST" as NormalizedOperation["method"],
            request: { body },
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
        CreateTodoRequestBody: { type: "string" },
      });
      expect(result.warnings).toEqual([]);
    }
  );
});

describe("buildOpenApiDocument default request bodies", () => {
  test("maps readonly default request bodies to non-required inner schemas", () => {
    const normalizedSpec = aTodoSpecWith({
      operations: [
        anOperationWith({
          operationId: "createTodo",
          method: "POST" as NormalizedOperation["method"],
          request: { body: z.string().default("fallback").readonly() },
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
      CreateTodoRequestBody: { type: "string" },
    });
    expect(result.warnings).toEqual([]);
  });

  test("maps nonoptional default request bodies to non-required inner schemas", () => {
    const normalizedSpec = aTodoSpecWith({
      operations: [
        anOperationWith({
          operationId: "createTodo",
          method: "POST" as NormalizedOperation["method"],
          request: { body: z.string().default("fallback").nonoptional() },
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
      CreateTodoRequestBody: { type: "string" },
    });
    expect(result.warnings).toEqual([]);
  });

  test("maps nullable optional request bodies to non-required nullable schemas", () => {
    const normalizedSpec = aTodoSpecWith({
      operations: [
        anOperationWith({
          operationId: "createTodo",
          method: "POST" as NormalizedOperation["method"],
          request: { body: z.string().optional().nullable() },
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
        anyOf: [{ type: "string" }, { type: "null" }],
      },
    });
    expect(result.warnings).toEqual([]);
  });
});

describe("buildOpenApiDocument required body semantics", () => {
  test("keeps nullable request bodies required", () => {
    const normalizedSpec = aTodoSpecWith({
      operations: [
        anOperationWith({
          operationId: "createTodo",
          method: "POST" as NormalizedOperation["method"],
          request: { body: z.string().nullable() },
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
        anyOf: [{ type: "string" }, { type: "null" }],
      },
    });
    expect(result.warnings).toEqual([]);
  });

  test("keeps plain nonoptional request bodies required", () => {
    const normalizedSpec = aTodoSpecWith({
      operations: [
        anOperationWith({
          operationId: "createTodo",
          method: "POST" as NormalizedOperation["method"],
          request: { body: z.string().nonoptional() },
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
      CreateTodoRequestBody: { type: "string" },
    });
    expect(result.warnings).toEqual([]);
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

describe("buildOpenApiDocument nested warning paths", () => {
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

    const result = buildOpenApiDocument(normalizedSpec, todoApiOptions());

    expect(result.warnings).toEqual([
      {
        origin: "schema-conversion",
        code: "unsupported-schema",
        message:
          "Zod custom falls back to a broader JSON Schema representation.",
        schemaType: "custom",
        schemaPath: "/properties/value",
        documentPath:
          "/components/schemas/CreateTodoRequestBody/properties/value",
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

    const result = buildOpenApiDocument(normalizedSpec, todoApiOptions());

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
});
