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
