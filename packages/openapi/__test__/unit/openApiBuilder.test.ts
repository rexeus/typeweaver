import { HttpMethod, HttpStatusCode } from "@rexeus/typeweaver-core";
import type { NormalizedSpec } from "@rexeus/typeweaver-gen";
import { describe, expect, test } from "vitest";
import { z } from "zod";
import {
  buildOpenApiDocument,
  MERGED_DUPLICATE_STATUS_RESPONSE,
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

  test("merges multiple responses at the same status code into a oneOf body", () => {
    const normalizedSpec: NormalizedSpec = {
      resources: [
        {
          name: "todo",
          operations: [
            {
              operationId: "createTodo",
              method: HttpMethod.POST,
              path: "/todos",
              summary: "create todo",
              request: {},
              responses: [
                {
                  source: "inline",
                  responseName: "ValidationError",
                  response: {
                    name: "ValidationError",
                    statusCode: HttpStatusCode.BAD_REQUEST,
                    statusCodeName: "BAD_REQUEST",
                    description: "validation failed",
                    body: z.object({ kind: z.literal("validation") }),
                    kind: "response",
                  },
                },
                {
                  source: "inline",
                  responseName: "BadInputError",
                  response: {
                    name: "BadInputError",
                    statusCode: HttpStatusCode.BAD_REQUEST,
                    statusCodeName: "BAD_REQUEST",
                    description: "bad input",
                    body: z.object({ kind: z.literal("badInput") }),
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
    const operation = (
      result.document as {
        readonly paths: {
          readonly "/todos": {
            readonly post: {
              readonly responses: Record<string, unknown>;
            };
          };
        };
      }
    ).paths["/todos"].post;
    const merged = operation.responses["400"] as {
      readonly description: string;
      readonly content: {
        readonly "application/json": {
          readonly schema: { readonly oneOf: readonly unknown[] };
        };
      };
    };

    expect(merged.description).toMatch(/ValidationError/);
    expect(merged.description).toMatch(/BadInputError/);
    expect(merged.content["application/json"].schema.oneOf).toHaveLength(2);
    expect(result.warnings.map(warning => warning.code)).toContain(
      MERGED_DUPLICATE_STATUS_RESPONSE
    );
  });

  test("drops headers when divergent header schemas at same status code", () => {
    const headerSchemaA = z.object({ "X-Rate-Limit": z.number() });
    const headerSchemaB = z.object({ "X-Request-Id": z.string() });

    const normalizedSpec: NormalizedSpec = {
      resources: [
        {
          name: "todo",
          operations: [
            {
              operationId: "getTodos",
              method: HttpMethod.GET,
              path: "/todos",
              summary: "get todos",
              request: {},
              responses: [
                {
                  source: "inline",
                  responseName: "RateLimited",
                  response: {
                    name: "RateLimited",
                    statusCode: HttpStatusCode.TOO_MANY_REQUESTS,
                    statusCodeName: "TOO_MANY_REQUESTS",
                    description: "rate limited",
                    header: headerSchemaA,
                    kind: "response",
                  },
                },
                {
                  source: "inline",
                  responseName: "ServiceUnavailable",
                  response: {
                    name: "ServiceUnavailable",
                    statusCode: HttpStatusCode.TOO_MANY_REQUESTS,
                    statusCodeName: "TOO_MANY_REQUESTS",
                    description: "service unavailable",
                    header: headerSchemaB,
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
    const operation = (
      result.document as {
        readonly paths: {
          readonly "/todos": {
            readonly get: {
              readonly responses: Record<string, unknown>;
            };
          };
        };
      }
    ).paths["/todos"].get;
    const merged = operation.responses["429"] as {
      readonly headers: undefined;
    };

    expect(merged.headers).toBeUndefined();

    const headerWarnings = result.warnings.filter(warning =>
      warning.message.includes("Dropped headers")
    );
    expect(headerWarnings).toHaveLength(1);
    expect(headerWarnings[0]!.message).toMatch(
      /variants: RateLimited, ServiceUnavailable/
    );
  });

  test("preserves headers when all variants share identical header schema instance", () => {
    const sharedHeaderSchema = z.object({
      "X-Request-Id": z.string().uuid(),
    });

    const normalizedSpec: NormalizedSpec = {
      resources: [
        {
          name: "todo",
          operations: [
            {
              operationId: "getTodos",
              method: HttpMethod.GET,
              path: "/todos",
              summary: "get todos",
              request: {},
              responses: [
                {
                  source: "inline",
                  responseName: "SuccessA",
                  response: {
                    name: "SuccessA",
                    statusCode: HttpStatusCode.OK,
                    statusCodeName: "OK",
                    description: "first success variant",
                    header: sharedHeaderSchema,
                    body: z.object({ id: z.string() }),
                    kind: "response",
                  },
                },
                {
                  source: "inline",
                  responseName: "SuccessB",
                  response: {
                    name: "SuccessB",
                    statusCode: HttpStatusCode.OK,
                    statusCodeName: "OK",
                    description: "second success variant",
                    header: sharedHeaderSchema,
                    body: z.object({ name: z.string() }),
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
    const operation = (
      result.document as {
        readonly paths: {
          readonly "/todos": {
            readonly get: {
              readonly responses: Record<string, unknown>;
            };
          };
        };
      }
    ).paths["/todos"].get;
    const merged = operation.responses["200"] as {
      readonly headers: Record<string, unknown> | undefined;
    };

    expect(merged.headers).toBeDefined();
    expect(merged.headers).toHaveProperty("X-Request-Id");

    const headerDropWarnings = result.warnings.filter(warning =>
      warning.message.includes("Dropped headers")
    );
    expect(headerDropWarnings).toHaveLength(0);
  });

  test("merges canonical and inline responses - both registered as component schemas", () => {
    const normalizedSpec: NormalizedSpec = {
      resources: [
        {
          name: "todo",
          operations: [
            {
              operationId: "updateTodo",
              method: HttpMethod.PUT,
              path: "/todos/:todoId",
              summary: "update todo",
              request: {},
              responses: [
                {
                  source: "canonical",
                  responseName: "Success",
                },
                {
                  source: "inline",
                  responseName: "PartialSuccess",
                  response: {
                    name: "PartialSuccess",
                    statusCode: HttpStatusCode.OK,
                    statusCodeName: "OK",
                    description: "partial success",
                    body: z.object({ updatedFields: z.array(z.string()) }),
                    kind: "response",
                  },
                },
              ],
            },
          ],
        },
      ],
      responses: [
        {
          name: "Success",
          statusCode: HttpStatusCode.OK,
          statusCodeName: "OK",
          description: "success",
          body: z.object({ id: z.string(), title: z.string() }),
          kind: "response",
        },
      ],
    };

    const result = buildOpenApiDocument({ normalizedSpec });
    const operation = (
      result.document as {
        readonly paths: {
          readonly "/todos/{todoId}": {
            readonly put: {
              readonly responses: Record<string, unknown>;
            };
          };
        };
      }
    ).paths["/todos/{todoId}"].put;
    const merged = operation.responses["200"] as {
      readonly content: {
        readonly "application/json": {
          readonly schema: {
            readonly oneOf: readonly { readonly $ref: string }[];
          };
        };
      };
    };

    const oneOf = merged.content["application/json"].schema.oneOf;
    expect(oneOf).toHaveLength(2);

    // Canonical body uses canonical component schema name (SuccessBody)
    const canonicalRef = oneOf.find(
      schema => schema.$ref === "#/components/schemas/SuccessBody"
    );
    expect(canonicalRef).toBeDefined();

    // Inline body is registered as a component schema with operation prefix (TodoUpdateTodoPartialSuccessBody)
    const inlineRef = oneOf.find(
      schema =>
        schema.$ref === "#/components/schemas/TodoUpdateTodoPartialSuccessBody"
    );
    expect(inlineRef).toBeDefined();

    // Verify both schemas exist in components
    const components = (
      result.document as {
        readonly components: { readonly schemas: Record<string, unknown> };
      }
    ).components.schemas;
    expect(components).toHaveProperty("SuccessBody");
    expect(components).toHaveProperty("TodoUpdateTodoPartialSuccessBody");
  });

  test("merges bodyless and body-bearing at same status code - only body schema appears", () => {
    const normalizedSpec: NormalizedSpec = {
      resources: [
        {
          name: "todo",
          operations: [
            {
              operationId: "deleteTodo",
              method: HttpMethod.DELETE,
              path: "/todos/:todoId",
              summary: "delete todo",
              request: {},
              responses: [
                {
                  source: "inline",
                  responseName: "NoContent",
                  response: {
                    name: "NoContent",
                    statusCode: HttpStatusCode.ACCEPTED,
                    statusCodeName: "ACCEPTED",
                    description: "no content",
                    kind: "response",
                  },
                },
                {
                  source: "inline",
                  responseName: "Accepted",
                  response: {
                    name: "Accepted",
                    statusCode: HttpStatusCode.ACCEPTED,
                    statusCodeName: "ACCEPTED",
                    description: "accepted with body",
                    body: z.object({ message: z.string() }),
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
    const document = result.document as {
      readonly paths: {
        readonly "/todos/{todoId}": {
          readonly delete: {
            readonly responses: Record<string, unknown>;
          };
        };
      };
      readonly components: {
        readonly schemas: Record<string, unknown>;
      };
    };

    const mergedResponse = document.paths["/todos/{todoId}"].delete.responses[
      "202"
    ] as {
      readonly content?: {
        readonly "application/json": {
          readonly schema: { readonly $ref?: string };
        };
      };
    };

    // When one response has no body and another has a body at the same status code,
    // the merged response should only contain the body schema (not a oneOf with undefined).
    // Since there's only one body, it's registered as a component schema and referenced via $ref.
    expect(mergedResponse.content).toBeDefined();
    expect(mergedResponse.content?.["application/json"].schema.$ref).toBe(
      "#/components/schemas/TodoDeleteTodoAcceptedBody"
    );

    // Verify the component schema exists with the message property
    const acceptedBodySchema = document.components.schemas
      .TodoDeleteTodoAcceptedBody as Record<string, unknown>;
    expect(acceptedBodySchema).toHaveProperty("properties.message");
  });
});
