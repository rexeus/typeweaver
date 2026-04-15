import { HttpMethod, HttpStatusCode } from "@rexeus/typeweaver-core";
import { describe, expect, test } from "vitest";
import { z } from "zod";
import type { NormalizedSpec } from "@rexeus/typeweaver-gen";
import { buildOpenApiDocument, toOpenApiPath } from "../../src/openApiBuilder.js";

describe("openApiBuilder", () => {
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
    const normalizedSpec: NormalizedSpec = {
      resources: [
        {
          name: "todo",
          operations: [
            {
              operationId: "createTodo",
              method: HttpMethod.POST,
              path: "/todos",
              summary: "Create a todo",
              request: {
                body: z.object({
                  scheduledAt: z.date(),
                }),
              },
              responses: [
                {
                  source: "inline",
                  responseName: "CreateTodoSuccess",
                  response: {
                    name: "CreateTodoSuccess",
                    statusCode: HttpStatusCode.CREATED,
                    statusCodeName: "CREATED",
                    description: "Created",
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

    expect(result.warnings).toEqual([
      expect.objectContaining({
        code: "unsupported-schema",
        location: "operation:createTodo:requestBody",
      }),
    ]);
  });
});
