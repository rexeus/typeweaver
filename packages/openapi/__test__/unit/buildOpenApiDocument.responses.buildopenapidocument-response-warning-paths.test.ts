import type {
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

function anInlineOkResponse(
  overrides: ResponseBuilderOverrides = {}
): NormalizedResponseUsage {
  return anInlineResponseUsage(
    aResponseWith({ statusCode: OK_STATUS, ...overrides })
  );
}

function aCanonicalOkResponse(
  overrides: ResponseBuilderOverrides = {}
): NormalizedResponse {
  return aResponseWith({ statusCode: OK_STATUS, ...overrides });
}

describe("buildOpenApiDocument response warning paths", () => {
  test("rebases schema conversion warnings for canonical component response bodies", () => {
    const warningResponse = aCanonicalOkResponse({
      name: "WarningResponse",
      body: z.object({ value: z.custom<string>() }),
    });
    const normalizedSpec = aTodoSpecWith({ responses: [warningResponse] });

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
          "/components/schemas/WarningResponseBody/properties/value",
        location: {
          resourceName: "components.responses",
          operationId: "WarningResponse",
          openApiPath: "#/components/responses",
          part: "response.body",
          responseName: "WarningResponse",
          statusCode: "200",
        },
      },
    ]);
  });

  test("rebases component response header warnings without operation path fields", () => {
    const warningResponse = aCanonicalOkResponse({
      name: "WarningResponse",
      header: z.object({
        "x-warning": z.string().refine(value => value.startsWith("ok")),
      }),
    });
    const normalizedSpec = aTodoSpecWith({ responses: [warningResponse] });

    const result = buildOpenApiDocument(normalizedSpec, todoApiOptions());

    expect(result.warnings).toEqual([
      {
        origin: "schema-conversion",
        code: "unsupported-check",
        message:
          "Zod string check custom cannot be represented exactly in JSON Schema.",
        schemaType: "string",
        schemaPath: "/properties/x-warning",
        documentPath:
          "/components/responses/WarningResponse/headers/x-warning/schema",
        location: {
          resourceName: "components.responses",
          operationId: "WarningResponse",
          openApiPath: "#/components/responses",
          part: "response.header",
          parameterName: "x-warning",
          responseName: "WarningResponse",
          statusCode: "200",
        },
      },
    ]);
  });
});

describe("buildOpenApiDocument inline response warning paths", () => {
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
                identifier: z.string().refine(value => value.startsWith("ok")),
              }),
            }),
          ],
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
