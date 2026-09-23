import { describe, expect, test } from "vitest";
import { z } from "zod";
import { buildOpenApiDocument } from "../../../src/index.js";
import {
  aHeaderSchemaForBuilder,
  anInlineResponseUsage,
  anOperationWith,
  aNormalizedSpecWith,
  aQuerySchemaForBuilder,
  aRecursiveTreeNodeSchema,
  aResponseWith,
  aTodoSpecWith,
  todoApiOptions,
} from "../../helpers.js";
import { anInlineOkResponse } from "./fixtures.js";

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

describe("buildOpenApiDocument header schema refs", () => {
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

    const result = buildOpenApiDocument(normalizedSpec, todoApiOptions());

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
