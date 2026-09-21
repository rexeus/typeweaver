import { describe, expect, test } from "vitest";
import { z } from "zod";
import { buildOpenApiDocument } from "../../src/index.js";
import {
  aNormalizedSpecWith,
  anInlineResponseUsage,
  anOperationWith,
  aQuerySchemaForBuilder,
  aRecursiveTreeNodeSchema,
  aResponseWith,
  aTodoSpecWith,
  todoApiOptions,
} from "./buildOpenApiDocument.helpers.js";

describe("buildOpenApiDocument root warning paths", () => {
  test("keeps root query container warnings at the parameter list boundary", () => {
    const normalizedSpec = aTodoSpecWith({
      operations: [
        anOperationWith({
          request: {
            query: aQuerySchemaForBuilder(z.custom<Record<string, string>>()),
          },
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
        schemaPath: "",
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
      {
        origin: "openapi-builder",
        code: "unrepresentable-parameter-container",
        message:
          "request.query must be a finite object schema to become OpenAPI parameters.",
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

describe("buildOpenApiDocument recursive schemas and determinism", () => {
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

    const result = buildOpenApiDocument(normalizedSpec, todoApiOptions());

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

  test("returns deterministic output for the same normalized spec", () => {
    const normalizedSpec = aTodoSpecWith({
      operations: [
        anOperationWith({
          responses: [anInlineResponseUsage(aResponseWith())],
        }),
      ],
    });

    const firstResult = buildOpenApiDocument(normalizedSpec, todoApiOptions());
    const secondResult = buildOpenApiDocument(normalizedSpec, todoApiOptions());

    expect(secondResult).toEqual(firstResult);
  });

  test("does not mutate the normalized spec", () => {
    const operation = anOperationWith({
      path: "/todos//",
      responses: [anInlineResponseUsage(aResponseWith())],
    });
    const resources = [
      {
        name: "Todos",
        tags: [],
        security: { requirements: [], source: "none" as const },
        operations: [operation],
      },
    ];
    const normalizedSpec = aNormalizedSpecWith({ resources });

    buildOpenApiDocument(normalizedSpec, todoApiOptions());

    expect(normalizedSpec.resources).toBe(resources);
    expect(normalizedSpec.resources[0]?.operations[0]).toBe(operation);
    expect(operation.path).toBe("/todos//");
  });
});

describe("buildOpenApiDocument normalized paths and canonical responses", () => {
  test("normalizes duplicate and trailing path slashes", () => {
    const normalizedSpec = aTodoSpecWith({
      operations: [
        anOperationWith({
          path: "/todos//",
          responses: [anInlineResponseUsage(aResponseWith())],
        }),
      ],
    });

    const result = buildOpenApiDocument(normalizedSpec, todoApiOptions());

    expect(result.document.paths).toEqual({
      "/todos": {
        get: {
          operationId: "getTodo",
          tags: [],
          responses: { "200": { description: "OK" } },
        },
      },
    });
  });

  test("warns when two canonical responses share a name", () => {
    const normalizedSpec = aTodoSpecWith({
      responses: [
        aResponseWith({ name: "TodoFound", description: "first" }),
        aResponseWith({ name: "TodoFound", description: "second" }),
      ],
    });

    const result = buildOpenApiDocument(normalizedSpec, todoApiOptions());

    expect(result.warnings).toEqual([
      {
        origin: "openapi-builder",
        code: "duplicate-canonical-response",
        message:
          "Canonical response 'TodoFound' is defined more than once; the entry at index 1 overrides the entry at index 0.",
        documentPath: "/components/responses/TodoFound",
        location: {
          responseName: "TodoFound",
          part: "components.responses",
        },
      },
    ]);
  });
});
