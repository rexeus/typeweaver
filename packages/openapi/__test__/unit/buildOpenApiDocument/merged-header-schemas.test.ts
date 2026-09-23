import { describe, expect, test } from "vitest";
import { z } from "zod";
import { buildOpenApiDocument } from "../../../src/index.js";
import {
  aHeaderSchemaForBuilder,
  aRecursiveTreeNodeSchema,
  aTodoSpecWith,
  todoApiOptions,
} from "../../helpers.js";
import {
  anInlineOkResponse,
  anOperationWithDuplicateOkResponses,
} from "./fixtures.js";

describe("buildOpenApiDocument differing merged header schemas", () => {
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

    const result = buildOpenApiDocument(normalizedSpec, todoApiOptions());

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
});

describe("buildOpenApiDocument recursive merged header refs", () => {
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

    const result = buildOpenApiDocument(normalizedSpec, todoApiOptions());

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
});

describe("buildOpenApiDocument equivalent and optional merged headers", () => {
  test("does not create anyOf for matching header schemas with different keyword order", () => {
    const normalizedSpec = aTodoSpecWith({
      operations: [
        anOperationWithDuplicateOkResponses([
          anInlineOkResponse({
            name: "MinimumFirst",
            header: aHeaderSchemaForBuilder(
              z.object({ "x-limit": z.number().min(1).max(10) })
            ),
          }),
          anInlineOkResponse({
            name: "MaximumFirst",
            header: aHeaderSchemaForBuilder(
              z.object({ "x-limit": z.number().max(10).min(1) })
            ),
          }),
        ]),
      ],
    });

    const result = buildOpenApiDocument(normalizedSpec, todoApiOptions());

    expect(result.document.paths["/todos"]?.get?.responses["200"]).toEqual({
      description: "MinimumFirst: OK\n\nMaximumFirst: OK",
      headers: {
        "x-limit": {
          required: true,
          schema: { type: "number", minimum: 1, maximum: 10 },
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

    const result = buildOpenApiDocument(normalizedSpec, todoApiOptions());

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
});

describe("buildOpenApiDocument omitted merged header variants", () => {
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

    const result = buildOpenApiDocument(normalizedSpec, todoApiOptions());

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

  test("keeps a single merged header description direct when other variants omit it", () => {
    const normalizedSpec = aTodoSpecWith({
      operations: [
        anOperationWithDuplicateOkResponses([
          anInlineOkResponse({
            name: "DescribedHeader",
            header: z.object({
              "x-correlation-id": z
                .string()
                .describe("Correlation ID for the response."),
            }),
          }),
          anInlineOkResponse({
            name: "UndescribedHeader",
            header: z.object({ "x-correlation-id": z.string() }),
          }),
        ]),
      ],
    });

    const result = buildOpenApiDocument(normalizedSpec, todoApiOptions());

    expect(result.document.paths["/todos"]?.get?.responses["200"]).toEqual({
      description: "DescribedHeader: OK\n\nUndescribedHeader: OK",
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
});
