import { describe, expect, test } from "vitest";
import { z } from "zod";
import { buildOpenApiDocument } from "../../../src/index.js";
import {
  aCanonicalResponseUsage,
  aTodoSpecWith,
  todoApiOptions,
} from "../../helpers.js";
import {
  aCanonicalOkResponse,
  anInlineOkResponse,
  anOperationWithDuplicateOkResponses,
  aTextBody,
} from "./fixtures.js";

describe("buildOpenApiDocument duplicate inline and canonical bodies", () => {
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

    const result = buildOpenApiDocument(normalizedSpec, todoApiOptions());

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

    const result = buildOpenApiDocument(normalizedSpec, todoApiOptions());

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
});

describe("buildOpenApiDocument mixed and deduplicated response bodies", () => {
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

    const result = buildOpenApiDocument(normalizedSpec, todoApiOptions());

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

    const result = buildOpenApiDocument(normalizedSpec, todoApiOptions());

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
});

describe("buildOpenApiDocument duplicate response media types", () => {
  test("emits separate content entries for duplicate responses with different media types", () => {
    const normalizedSpec = aTodoSpecWith({
      operations: [
        anOperationWithDuplicateOkResponses([
          anInlineOkResponse({
            name: "TodoFound",
            description: "Todo found",
            body: z.object({ id: z.string() }),
          }),
          anInlineOkResponse({
            name: "TodoText",
            description: "Todo text",
            body: aTextBody(z.string(), "text/plain"),
          }),
        ]),
      ],
    });

    const result = buildOpenApiDocument(normalizedSpec, todoApiOptions());

    expect(result.document.paths["/todos"]?.get?.responses["200"]).toEqual({
      description: "TodoFound: Todo found\n\nTodoText: Todo text",
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/GetTodoTodoFoundBody" },
        },
        "text/plain": {
          schema: { $ref: "#/components/schemas/GetTodoTodoTextBody" },
        },
      },
    });
    expect(result.warnings).toEqual([]);
  });

  test("keeps anyOf within one media type for duplicate responses with distinct schemas", () => {
    const normalizedSpec = aTodoSpecWith({
      operations: [
        anOperationWithDuplicateOkResponses([
          anInlineOkResponse({
            name: "PlainText",
            description: "Plain text",
            body: aTextBody(z.string(), "text/plain"),
          }),
          anInlineOkResponse({
            name: "StructuredText",
            description: "Structured text",
            body: aTextBody(z.object({ value: z.string() }), "text/plain"),
          }),
        ]),
      ],
    });

    const result = buildOpenApiDocument(normalizedSpec, todoApiOptions());

    expect(result.document.paths["/todos"]?.get?.responses["200"]).toEqual({
      description: "PlainText: Plain text\n\nStructuredText: Structured text",
      content: {
        "text/plain": {
          schema: {
            anyOf: [
              { $ref: "#/components/schemas/GetTodoPlainTextBody" },
              { $ref: "#/components/schemas/GetTodoStructuredTextBody" },
            ],
          },
        },
      },
    });
    expect(result.warnings).toEqual([]);
  });
});

describe("buildOpenApiDocument duplicate body warnings and bodyless variants", () => {
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

    const result = buildOpenApiDocument(normalizedSpec, todoApiOptions());

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

    const result = buildOpenApiDocument(normalizedSpec, todoApiOptions());

    expect(result.document.paths["/todos"]?.get?.responses["200"]).toEqual({
      description: "OkResponse: OK\n\nNoBody: OK",
    });
    expect(result.warnings).toEqual([]);
  });
});
