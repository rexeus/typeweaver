import { describe, expect, test } from "vitest";
import { z } from "zod";
import { buildOpenApiDocument } from "../../../src/index.js";
import {
  aHeaderSchemaForBuilder,
  anOperationWith,
  aTodoSpecWith,
  todoApiOptions,
} from "../../helpers.js";
import {
  anInlineOkResponse,
  anOperationWithDuplicateOkResponses,
} from "./fixtures.js";

describe("buildOpenApiDocument inline response headers", () => {
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

    const result = buildOpenApiDocument(normalizedSpec, todoApiOptions());

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

  test("maps strict response header containers without a false catchall warning", () => {
    const normalizedSpec = aTodoSpecWith({
      operations: [
        anOperationWith({
          responses: [
            anInlineOkResponse({
              header: aHeaderSchemaForBuilder(
                z.strictObject({ etag: z.string() })
              ),
            }),
          ],
        }),
      ],
    });

    const result = buildOpenApiDocument(normalizedSpec, todoApiOptions());

    expect(result.document.paths["/todos"]?.get?.responses).toEqual({
      "200": {
        description: "OK",
        headers: {
          etag: { required: true, schema: { type: "string" } },
        },
      },
    });
    expect(result.warnings).toEqual([]);
  });

  test("marks response headers from catch containers as not required", () => {
    const normalizedSpec = aTodoSpecWith({
      operations: [
        anOperationWith({
          responses: [
            anInlineOkResponse({
              header: aHeaderSchemaForBuilder(
                z.object({ "x-cache": z.string() }).catch({ "x-cache": "miss" })
              ),
            }),
          ],
        }),
      ],
    });

    const result = buildOpenApiDocument(normalizedSpec, todoApiOptions());

    expect(result.document.paths["/todos"]?.get?.responses).toEqual({
      "200": {
        description: "OK",
        headers: {
          "x-cache": { required: false, schema: { type: "string" } },
        },
      },
    });
    expect(result.warnings).toEqual([]);
  });
});

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
