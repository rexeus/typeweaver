import { describe, expect, test } from "vitest";
import { z } from "zod";
import { buildOpenApiDocument } from "../../../src/index.js";
import {
  anHttpMethod,
  anInlineResponseUsage,
  anOperationWith,
  aResponseWith,
  aTodoSpecWith,
  todoApiOptions,
} from "../../helpers.js";
import { aTextBody } from "./fixtures.js";

describe("buildOpenApiDocument required request bodies", () => {
  test("maps required request body schemas", () => {
    const normalizedSpec = aTodoSpecWith({
      operations: [
        anOperationWith({
          operationId: "createTodo",
          method: anHttpMethod("POST"),
          request: { body: z.object({ title: z.string() }) },
          responses: [anInlineResponseUsage(aResponseWith())],
        }),
      ],
    });

    const result = buildOpenApiDocument(normalizedSpec, todoApiOptions());

    expect(result.document.paths["/todos"]?.post?.requestBody).toEqual({
      required: true,
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/CreateTodoRequestBody" },
        },
      },
    });
    expect(result.document.components?.schemas).toEqual({
      CreateTodoRequestBody: {
        type: "object",
        properties: { title: { type: "string" } },
        required: ["title"],
        additionalProperties: false,
      },
    });
    expect(result.warnings).toEqual([]);
  });

  test("uses the normalized request body media type as the OpenAPI content key", () => {
    const body = z.string();
    const normalizedSpec = aTodoSpecWith({
      operations: [
        anOperationWith({
          operationId: "uploadCsv",
          method: anHttpMethod("POST"),
          request: { body: aTextBody(body, "text/csv") },
          responses: [anInlineResponseUsage(aResponseWith())],
        }),
      ],
    });

    const result = buildOpenApiDocument(normalizedSpec, todoApiOptions());

    expect(result.document.paths["/todos"]?.post?.requestBody).toEqual({
      required: true,
      content: {
        "text/csv": {
          schema: { $ref: "#/components/schemas/UploadCsvRequestBody" },
        },
      },
    });
  });
});

describe("buildOpenApiDocument optional request bodies", () => {
  test("maps optional request bodies to non-required unwrapped schemas", () => {
    const normalizedSpec = aTodoSpecWith({
      operations: [
        anOperationWith({
          operationId: "createTodo",
          method: anHttpMethod("POST"),
          request: { body: z.object({ title: z.string() }).optional() },
          responses: [anInlineResponseUsage(aResponseWith())],
        }),
      ],
    });

    const result = buildOpenApiDocument(normalizedSpec, todoApiOptions());

    expect(result.document.paths["/todos"]?.post?.requestBody).toEqual({
      required: false,
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/CreateTodoRequestBody" },
        },
      },
    });
    expect(result.document.components?.schemas).toEqual({
      CreateTodoRequestBody: {
        type: "object",
        properties: { title: { type: "string" } },
        required: ["title"],
        additionalProperties: false,
      },
    });
    expect(result.warnings).toEqual([]);
  });

  test("emits literal request body schemas as single-value enums", () => {
    const normalizedSpec = aTodoSpecWith({
      operations: [
        anOperationWith({
          operationId: "uploadJson",
          method: anHttpMethod("POST"),
          request: { body: z.literal("application/json") },
          responses: [anInlineResponseUsage(aResponseWith())],
        }),
      ],
    });

    const result = buildOpenApiDocument(normalizedSpec, todoApiOptions());

    expect(
      result.document.components?.schemas?.["UploadJsonRequestBody"]
    ).toEqual({
      type: "string",
      enum: ["application/json"],
    });
    expect(
      result.document.paths["/todos"]?.post?.requestBody?.content[
        "application/json"
      ]?.schema
    ).toEqual({ $ref: "#/components/schemas/UploadJsonRequestBody" });
    expect(result.warnings).toEqual([]);
  });
});

describe("buildOpenApiDocument request body wrappers", () => {
  test.each([
    {
      scenario: "default",
      body: z.string().default("fallback"),
    },
    {
      scenario: "prefault",
      body: z.string().prefault("fallback"),
    },
    {
      scenario: "catch",
      body: z.string().catch("fallback"),
    },
  ])(
    "maps $scenario request body fallbacks to non-required inner schemas",
    ({ body }) => {
      const normalizedSpec = aTodoSpecWith({
        operations: [
          anOperationWith({
            operationId: "createTodo",
            method: anHttpMethod("POST"),
            request: { body },
            responses: [anInlineResponseUsage(aResponseWith())],
          }),
        ],
      });

      const result = buildOpenApiDocument(normalizedSpec, todoApiOptions());

      expect(result.document.paths["/todos"]?.post?.requestBody).toEqual({
        required: false,
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/CreateTodoRequestBody" },
          },
        },
      });
      expect(result.document.components?.schemas).toEqual({
        CreateTodoRequestBody: { type: "string" },
      });
      expect(result.warnings).toEqual([]);
    }
  );
});

describe("buildOpenApiDocument default request bodies", () => {
  test("maps readonly default request bodies to non-required inner schemas", () => {
    const normalizedSpec = aTodoSpecWith({
      operations: [
        anOperationWith({
          operationId: "createTodo",
          method: anHttpMethod("POST"),
          request: { body: z.string().default("fallback").readonly() },
          responses: [anInlineResponseUsage(aResponseWith())],
        }),
      ],
    });

    const result = buildOpenApiDocument(normalizedSpec, todoApiOptions());

    expect(result.document.paths["/todos"]?.post?.requestBody).toEqual({
      required: false,
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/CreateTodoRequestBody" },
        },
      },
    });
    expect(result.document.components?.schemas).toEqual({
      CreateTodoRequestBody: { type: "string" },
    });
    expect(result.warnings).toEqual([]);
  });

  test("maps nonoptional default request bodies to non-required inner schemas", () => {
    const normalizedSpec = aTodoSpecWith({
      operations: [
        anOperationWith({
          operationId: "createTodo",
          method: anHttpMethod("POST"),
          request: { body: z.string().default("fallback").nonoptional() },
          responses: [anInlineResponseUsage(aResponseWith())],
        }),
      ],
    });

    const result = buildOpenApiDocument(normalizedSpec, todoApiOptions());

    expect(result.document.paths["/todos"]?.post?.requestBody).toEqual({
      required: false,
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/CreateTodoRequestBody" },
        },
      },
    });
    expect(result.document.components?.schemas).toEqual({
      CreateTodoRequestBody: { type: "string" },
    });
    expect(result.warnings).toEqual([]);
  });

  test("maps nullable optional request bodies to non-required nullable schemas", () => {
    const normalizedSpec = aTodoSpecWith({
      operations: [
        anOperationWith({
          operationId: "createTodo",
          method: anHttpMethod("POST"),
          request: { body: z.string().optional().nullable() },
          responses: [anInlineResponseUsage(aResponseWith())],
        }),
      ],
    });

    const result = buildOpenApiDocument(normalizedSpec, todoApiOptions());

    expect(result.document.paths["/todos"]?.post?.requestBody).toEqual({
      required: false,
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/CreateTodoRequestBody" },
        },
      },
    });
    expect(result.document.components?.schemas).toEqual({
      CreateTodoRequestBody: {
        anyOf: [{ type: "string" }, { type: "null" }],
      },
    });
    expect(result.warnings).toEqual([]);
  });
});

describe("buildOpenApiDocument required body semantics", () => {
  test("keeps nullable request bodies required", () => {
    const normalizedSpec = aTodoSpecWith({
      operations: [
        anOperationWith({
          operationId: "createTodo",
          method: anHttpMethod("POST"),
          request: { body: z.string().nullable() },
          responses: [anInlineResponseUsage(aResponseWith())],
        }),
      ],
    });

    const result = buildOpenApiDocument(normalizedSpec, todoApiOptions());

    expect(result.document.paths["/todos"]?.post?.requestBody).toEqual({
      required: true,
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/CreateTodoRequestBody" },
        },
      },
    });
    expect(result.document.components?.schemas).toEqual({
      CreateTodoRequestBody: {
        anyOf: [{ type: "string" }, { type: "null" }],
      },
    });
    expect(result.warnings).toEqual([]);
  });

  test("keeps plain nonoptional request bodies required", () => {
    const normalizedSpec = aTodoSpecWith({
      operations: [
        anOperationWith({
          operationId: "createTodo",
          method: anHttpMethod("POST"),
          request: { body: z.string().nonoptional() },
          responses: [anInlineResponseUsage(aResponseWith())],
        }),
      ],
    });

    const result = buildOpenApiDocument(normalizedSpec, todoApiOptions());

    expect(result.document.paths["/todos"]?.post?.requestBody).toEqual({
      required: true,
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/CreateTodoRequestBody" },
        },
      },
    });
    expect(result.document.components?.schemas).toEqual({
      CreateTodoRequestBody: { type: "string" },
    });
    expect(result.warnings).toEqual([]);
  });
});
