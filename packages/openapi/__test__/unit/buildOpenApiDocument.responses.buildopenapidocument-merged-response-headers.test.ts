import type {
  NormalizedOperation,
  NormalizedResponse,
  NormalizedResponseUsage,
} from "@rexeus/typeweaver-gen";
import { describe, expect, test } from "vitest";
import { z } from "zod";
import { buildOpenApiDocument } from "../../src/index.js";
import {
  aHeaderSchemaForBuilder,
  anInlineResponseUsage,
  anOperationWith,
  aRecursiveTreeNodeSchema,
  aResponseWith,
  aTodoSpecWith,
  todoApiOptions,
} from "./buildOpenApiDocument.helpers.js";

const OK_STATUS = 200 as NormalizedResponse["statusCode"];

type ResponseBuilderOverrides = Parameters<typeof aResponseWith>[0];

type OperationBuilderOverrides = Parameters<typeof anOperationWith>[0];

function anInlineOkResponse(
  overrides: ResponseBuilderOverrides = {}
): NormalizedResponseUsage {
  return anInlineResponseUsage(
    aResponseWith({ statusCode: OK_STATUS, ...overrides })
  );
}

function anOperationWithDuplicateOkResponses(
  responses: readonly NormalizedResponseUsage[],
  overrides: OperationBuilderOverrides = {}
): NormalizedOperation {
  return anOperationWith({ ...overrides, responses });
}

describe("buildOpenApiDocument merged response headers", () => {
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

    const result = buildOpenApiDocument(normalizedSpec, todoApiOptions());

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

  test("merges response header names case-insensitively using first casing", () => {
    const normalizedSpec = aTodoSpecWith({
      operations: [
        anOperationWithDuplicateOkResponses([
          anInlineOkResponse({
            name: "UpperHeader",
            header: z.object({ "X-Correlation-ID": z.string() }),
          }),
          anInlineOkResponse({
            name: "LowerHeader",
            header: z.object({ "x-correlation-id": z.string() }),
          }),
        ]),
      ],
    });

    const result = buildOpenApiDocument(normalizedSpec, todoApiOptions());

    expect(result.document.paths["/todos"]?.get?.responses["200"]).toEqual({
      description: "UpperHeader: OK\n\nLowerHeader: OK",
      headers: {
        "X-Correlation-ID": {
          required: true,
          schema: { type: "string" },
        },
      },
    });
    expect(result.warnings).toEqual([]);
  });
});

describe("buildOpenApiDocument case-insensitive merged header schemas", () => {
  test("combines differently-cased response headers with differing schemas", () => {
    const normalizedSpec = aTodoSpecWith({
      operations: [
        anOperationWithDuplicateOkResponses([
          anInlineOkResponse({
            name: "StringHeader",
            header: z.object({ "X-Correlation-ID": z.string() }),
          }),
          anInlineOkResponse({
            name: "NumberHeader",
            header: aHeaderSchemaForBuilder(
              z.object({ "x-correlation-id": z.number() })
            ),
          }),
        ]),
      ],
    });

    const result = buildOpenApiDocument(normalizedSpec, todoApiOptions());

    expect(result.document.paths["/todos"]?.get?.responses["200"]).toEqual({
      description: "StringHeader: OK\n\nNumberHeader: OK",
      headers: {
        "X-Correlation-ID": {
          required: true,
          schema: {
            anyOf: [{ type: "string" }, { type: "number" }],
          },
        },
      },
    });
    expect(result.warnings).toEqual([]);
  });

  test("merges same-variant response header casing collisions without dropping schemas", () => {
    const normalizedSpec = aTodoSpecWith({
      operations: [
        anOperationWithDuplicateOkResponses([
          anInlineOkResponse({
            name: "DualHeader",
            header: z.object({
              "X-Correlation-ID": z
                .string()
                .describe("Primary correlation header."),
              "x-correlation-id": z
                .array(z.string())
                .describe("Alternate correlation header."),
            }),
          }),
          anInlineOkResponse({
            name: "OtherHeader",
            header: z.object({
              "X-Correlation-ID": z
                .string()
                .describe("Primary correlation header."),
            }),
          }),
        ]),
      ],
    });

    const result = buildOpenApiDocument(normalizedSpec, todoApiOptions());

    expect(result.document.paths["/todos"]?.get?.responses["200"]).toEqual({
      description: "DualHeader: OK\n\nOtherHeader: OK",
      headers: {
        "X-Correlation-ID": {
          description:
            "Header description merged from response variants:\n" +
            "- DualHeader: Primary correlation header.\n" +
            "- DualHeader: Alternate correlation header.\n" +
            "- OtherHeader: Primary correlation header.",
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
