import { describe, expect, test } from "vitest";
import { z } from "zod";
import { buildOpenApiDocument } from "../../../src/index.js";
import {
  aHeaderSchemaForBuilder,
  aTodoSpecWith,
  todoApiOptions,
} from "../../helpers.js";
import {
  anInlineOkResponse,
  anOperationWithDuplicateOkResponses,
} from "./fixtures.js";

describe("buildOpenApiDocument merged header descriptions", () => {
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

    const result = buildOpenApiDocument(normalizedSpec, todoApiOptions());

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

  test("combines only described merged header variants with bullets", () => {
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
            name: "UndescribedResponse",
            header: z.object({ "x-correlation-id": z.string() }),
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

    const result = buildOpenApiDocument(normalizedSpec, todoApiOptions());

    expect(result.document.paths["/todos"]?.get?.responses["200"]).toEqual({
      description:
        "OkResponse: OK\n\nUndescribedResponse: OK\n\nValidationError: OK",
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
});

describe("buildOpenApiDocument undescribed merged headers", () => {
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

    const result = buildOpenApiDocument(normalizedSpec, todoApiOptions());

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

describe("buildOpenApiDocument merged header warnings and prototypes", () => {
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

    const result = buildOpenApiDocument(normalizedSpec, todoApiOptions());

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

    const result = buildOpenApiDocument(normalizedSpec, todoApiOptions());

    expect(result.document.paths["/todos"]?.get?.responses["200"]).toEqual({
      description: "WithConstructorHeader: OK\n\nWithoutConstructorHeader: OK",
      headers: {
        constructor: {
          required: false,
          schema: { type: "string" },
        },
      },
    });
    expect(result.warnings).toEqual([]);
  });
});
