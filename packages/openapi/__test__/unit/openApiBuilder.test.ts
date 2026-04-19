import { HttpMethod, HttpStatusCode } from "@rexeus/typeweaver-core";
import type { NormalizedSpec } from "@rexeus/typeweaver-gen";
import { describe, expect, test } from "vitest";
import { z } from "zod";
import {
  buildOpenApiDocument,
  toOpenApiPath,
} from "../../src/openApiBuilder.js";
import { createOperationFixture } from "../fixtures/operationFixture.js";

describe("openApiBuilder", () => {
  test("leaves OpenAPI-style paths unchanged", () => {
    expect(toOpenApiPath("/todos/{todoId}/sub-todos")).toBe(
      "/todos/{todoId}/sub-todos"
    );
  });

  test("converts express-style paths to OpenAPI paths", () => {
    expect(toOpenApiPath("/todos/:todoId/sub-todos/:subTodoId")).toBe(
      "/todos/{todoId}/sub-todos/{subTodoId}"
    );
  });

  test("builds a practical OpenAPI 3.1 document", () => {
    const normalizedSpec: NormalizedSpec = {
      resources: [
        {
          name: "todo",
          operations: [
            {
              operationId: "getTodo",
              method: HttpMethod.GET,
              path: "/todos/:todoId",
              summary: "Get a todo",
              request: {
                param: z.object({
                  todoId: z.string().uuid(),
                }),
                query: z.object({
                  includeHistory: z.enum(["true", "false"]).optional(),
                }),
                header: z.object({
                  "X-Trace-Id": z.string().min(1).optional(),
                }),
              },
              responses: [
                {
                  source: "inline",
                  responseName: "GetTodoSuccess",
                  response: {
                    name: "GetTodoSuccess",
                    statusCode: HttpStatusCode.OK,
                    statusCodeName: "OK",
                    description: "Todo returned successfully",
                    body: z.object({
                      id: z.string().uuid(),
                      title: z.string(),
                    }),
                    kind: "response",
                  },
                },
                {
                  source: "canonical",
                  responseName: "ForbiddenError",
                },
              ],
            },
          ],
        },
      ],
      responses: [
        {
          name: "ForbiddenError",
          statusCode: HttpStatusCode.FORBIDDEN,
          statusCodeName: "FORBIDDEN",
          description: "Forbidden",
          body: z.object({
            error: z.literal("Forbidden"),
          }),
          kind: "response",
        },
      ],
    };

    const result = buildOpenApiDocument({
      normalizedSpec,
      config: {
        info: {
          title: "Todo API",
          version: "1.2.3",
        },
        servers: [{ url: "https://api.example.com" }],
      },
    });

    expect(result.warnings).toEqual([]);
    expect(result.document).toMatchObject({
      openapi: "3.1.1",
      jsonSchemaDialect: "https://json-schema.org/draft/2020-12/schema",
      info: {
        title: "Todo API",
        version: "1.2.3",
      },
      servers: [{ url: "https://api.example.com" }],
      paths: {
        "/todos/{todoId}": {
          get: {
            operationId: "getTodo",
            summary: "Get a todo",
            parameters: [
              {
                in: "path",
                name: "todoId",
                required: true,
                schema: {
                  type: "string",
                  format: "uuid",
                },
              },
              {
                in: "query",
                name: "includeHistory",
                required: false,
                schema: {
                  type: "string",
                  enum: ["true", "false"],
                },
              },
              {
                in: "header",
                name: "X-Trace-Id",
                required: false,
                schema: {
                  type: "string",
                  minLength: 1,
                },
              },
            ],
            responses: {
              "200": {
                description: "Todo returned successfully",
              },
              "403": {
                $ref: "#/components/responses/ForbiddenError",
              },
            },
          },
        },
      },
      components: {
        responses: {
          ForbiddenError: {
            description: "Forbidden",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ForbiddenErrorBody",
                },
              },
            },
          },
        },
      },
    });
  });

  test("surfaces warnings for broadened schemas", () => {
    const normalizedSpec = createOperationFixture({
      operationId: "createTodo",
      method: HttpMethod.POST,
      request: {
        body: z.object({
          scheduledAt: z.date(),
        }),
      },
    });

    const result = buildOpenApiDocument({ normalizedSpec });

    expect(result.warnings).toEqual([
      expect.objectContaining({
        code: "unsupported-schema",
        location: "operation:createTodo:requestBody",
      }),
    ]);
  });

  test("keeps tuple response schemas validator-friendly end to end", () => {
    const normalizedSpec = createOperationFixture({
      operationId: "getTupleTodo",
      path: "/todos/:todoId/tuple",
      request: {
        param: z.object({
          todoId: z.string(),
        }),
      },
      responseBody: z.object({
        coordinates: z.tuple([z.number(), z.number()]),
      }),
    });

    const result = buildOpenApiDocument({ normalizedSpec });

    expect(result.warnings).toEqual([]);
    expect(result.document).toMatchObject({
      components: {
        schemas: {
          TodoGetTupleTodoGetTupleTodoSuccessBody: {
            type: "object",
            properties: {
              coordinates: {
                type: "array",
                prefixItems: [{ type: "number" }, { type: "number" }],
                items: {},
                minItems: 2,
                maxItems: 2,
              },
            },
          },
        },
      },
    });
  });

  test("falls back to DEFAULT_INFO when no plugin config is supplied", () => {
    const normalizedSpec = createOperationFixture({
      operationId: "listTodos",
      responseBody: z.object({ items: z.array(z.string()) }),
    });

    const result = buildOpenApiDocument({ normalizedSpec });
    const document = result.document as {
      readonly info: { readonly title: string; readonly version: string };
    };

    expect(document.info).toEqual({
      title: "Typeweaver API",
      version: "0.0.0",
    });
  });

  test("uses disambiguated component names when two resources share an operationId", () => {
    const normalizedSpec: NormalizedSpec = {
      resources: [
        {
          name: "todo",
          operations: [
            {
              operationId: "get",
              method: HttpMethod.GET,
              path: "/todos/:id",
              summary: "get todo",
              request: {},
              responses: [
                {
                  source: "inline",
                  responseName: "GetSuccess",
                  response: {
                    name: "GetSuccess",
                    statusCode: HttpStatusCode.OK,
                    statusCodeName: "OK",
                    description: "ok",
                    body: z.object({ kind: z.literal("todo") }),
                    kind: "response",
                  },
                },
              ],
            },
          ],
        },
        {
          name: "user",
          operations: [
            {
              operationId: "get",
              method: HttpMethod.GET,
              path: "/users/:id",
              summary: "get user",
              request: {},
              responses: [
                {
                  source: "inline",
                  responseName: "GetSuccess",
                  response: {
                    name: "GetSuccess",
                    statusCode: HttpStatusCode.OK,
                    statusCodeName: "OK",
                    description: "ok",
                    body: z.object({ kind: z.literal("user") }),
                    kind: "response",
                  },
                },
              ],
            },
          ],
        },
      ],
      responses: [],
    };

    const result = buildOpenApiDocument({ normalizedSpec });
    const schemas = (
      result.document as {
        readonly components: {
          readonly schemas: Record<string, unknown>;
        };
      }
    ).components.schemas;

    expect(schemas).toHaveProperty("TodoGetGetSuccessBody");
    expect(schemas).toHaveProperty("UserGetGetSuccessBody");
  });
});
