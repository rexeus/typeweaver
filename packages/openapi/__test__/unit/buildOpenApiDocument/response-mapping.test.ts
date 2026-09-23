import type { NormalizedResponse } from "@rexeus/typeweaver-gen";
import { describe, expect, test } from "vitest";
import { z } from "zod";
import { buildOpenApiDocument } from "../../../src/index.js";
import {
  aCanonicalResponseUsage,
  anInlineResponseUsage,
  anOperationWith,
  aResponseWith,
  aTodoSpecWith,
  todoApiOptions,
} from "../../helpers.js";
import {
  aCanonicalOkResponse,
  anInlineOkResponse,
  anOperationWithDuplicateOkResponses,
  aTextBody,
  OK_STATUS,
} from "./fixtures.js";

const NOT_FOUND_STATUS = 404 as NormalizedResponse["statusCode"];

describe("buildOpenApiDocument canonical response references", () => {
  test("maps canonical response references", () => {
    const successResponse = aCanonicalOkResponse({
      name: "TodoResponse",
      description: "Todo found",
      body: z.object({ id: z.string() }),
    });
    const normalizedSpec = aTodoSpecWith({
      responses: [successResponse],
      operations: [
        anOperationWith({
          operationId: "getTodo",
          path: "/todos/:id",
          request: { param: z.object({ id: z.string() }) },
          responses: [aCanonicalResponseUsage("TodoResponse")],
        }),
      ],
    });

    const result = buildOpenApiDocument(normalizedSpec, todoApiOptions());

    expect(result.document.components?.responses).toEqual({
      TodoResponse: {
        description: "Todo found",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/TodoResponseBody" },
          },
        },
      },
    });
    expect(result.document.components?.schemas).toEqual({
      TodoResponseBody: {
        type: "object",
        properties: { id: { type: "string" } },
        required: ["id"],
        additionalProperties: false,
      },
    });
    expect(result.document.paths["/todos/{id}"]?.get?.responses).toEqual({
      "200": { $ref: "#/components/responses/TodoResponse" },
    });
    expect(result.warnings).toEqual([]);
  });

  test("escapes canonical response references without changing component keys", () => {
    const successResponse = aCanonicalOkResponse({
      name: "Todo/Success~Response",
    });
    const normalizedSpec = aTodoSpecWith({
      responses: [successResponse],
      operations: [
        anOperationWith({
          responses: [aCanonicalResponseUsage("Todo/Success~Response")],
        }),
      ],
    });

    const result = buildOpenApiDocument(normalizedSpec, todoApiOptions());

    expect(result.document.components?.responses).toEqual({
      "Todo/Success~Response": { description: "OK" },
    });
    expect(result.document.paths["/todos"]?.get?.responses).toEqual({
      "200": { $ref: "#/components/responses/Todo~1Success~0Response" },
    });
    expect(result.warnings).toEqual([]);
  });
});

describe("buildOpenApiDocument inline response bodies", () => {
  test("maps inline response bodies", () => {
    const normalizedSpec = aTodoSpecWith({
      operations: [
        anOperationWith({
          responses: [
            anInlineOkResponse({
              description: "Todo found",
              body: z.object({ id: z.string() }),
            }),
          ],
        }),
      ],
    });

    const result = buildOpenApiDocument(normalizedSpec, todoApiOptions());

    expect(result.document.paths["/todos"]?.get?.responses).toEqual({
      "200": {
        description: "Todo found",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/GetTodoOkResponseBody" },
          },
        },
      },
    });
    expect(result.document.components?.schemas).toEqual({
      GetTodoOkResponseBody: {
        type: "object",
        properties: { id: { type: "string" } },
        required: ["id"],
        additionalProperties: false,
      },
    });
    expect(result.warnings).toEqual([]);
  });

  test("uses the normalized response body media type as the OpenAPI content key", () => {
    const normalizedSpec = aTodoSpecWith({
      operations: [
        anOperationWith({
          responses: [
            anInlineOkResponse({
              description: "Todo found",
              body: aTextBody(z.string(), "text/plain"),
            }),
          ],
        }),
      ],
    });

    const result = buildOpenApiDocument(normalizedSpec, todoApiOptions());

    expect(result.document.paths["/todos"]?.get?.responses).toEqual({
      "200": {
        description: "Todo found",
        content: {
          "text/plain": {
            schema: { $ref: "#/components/schemas/GetTodoOkResponseBody" },
          },
        },
      },
    });
    expect(result.warnings).toEqual([]);
  });
});

describe("buildOpenApiDocument response status grouping", () => {
  test("omits missing canonical response usages and emits a diagnostic", () => {
    const normalizedSpec = aTodoSpecWith({
      operations: [
        anOperationWith({
          responses: [{ responseName: "MissingResponse", source: "canonical" }],
        }),
      ],
    });

    const result = buildOpenApiDocument(normalizedSpec, todoApiOptions());

    expect(result.document.paths["/todos"]?.get?.responses).toEqual({});
    expect(result.warnings).toEqual([
      {
        origin: "openapi-builder",
        code: "missing-canonical-response",
        message: "Canonical response 'MissingResponse' is not defined.",
        documentPath: "/paths/~1todos/get/responses",
        location: {
          resourceName: "Todos",
          operationId: "getTodo",
          method: "GET",
          path: "/todos",
          openApiPath: "/todos",
          part: "response",
          responseName: "MissingResponse",
          statusCode: undefined,
        },
      },
    ]);
  });

  test("merges duplicate inline response statuses without a diagnostic", () => {
    const normalizedSpec = aTodoSpecWith({
      operations: [
        anOperationWithDuplicateOkResponses([
          anInlineOkResponse({ description: "First" }),
          anInlineOkResponse({ description: "Second" }),
        ]),
      ],
    });

    const result = buildOpenApiDocument(normalizedSpec, todoApiOptions());

    expect(result.document.paths["/todos"]?.get?.responses).toEqual({
      "200": { description: "OkResponse: First\n\nOkResponse: Second" },
    });
    expect(result.warnings).toEqual([]);
  });

  test("keeps different response status codes separate", () => {
    const normalizedSpec = aTodoSpecWith({
      operations: [
        anOperationWith({
          responses: [
            anInlineResponseUsage(
              aResponseWith({
                name: "TodoFound",
                statusCode: OK_STATUS,
                description: "Todo found",
              })
            ),
            anInlineResponseUsage(
              aResponseWith({
                name: "TodoMissing",
                statusCode: NOT_FOUND_STATUS,
                description: "Todo missing",
              })
            ),
          ],
        }),
      ],
    });

    const result = buildOpenApiDocument(normalizedSpec, todoApiOptions());

    expect(result.document.paths["/todos"]?.get?.responses).toEqual({
      "200": { description: "Todo found" },
      "404": { description: "Todo missing" },
    });
    expect(result.warnings).toEqual([]);
  });
});
