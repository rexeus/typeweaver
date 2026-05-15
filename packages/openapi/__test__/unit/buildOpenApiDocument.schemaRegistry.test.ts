import type { NormalizedOperation } from "@rexeus/typeweaver-gen";
import { describe, expect, test } from "vitest";
import { z } from "zod";
import { buildOpenApiDocument } from "../../src/index.js";
import {
  aCanonicalResponseUsage,
  anInlineResponseUsage,
  anOperationWith,
  aRecursiveTreeNodeSchema,
  aResponseWith,
  aTodoSpecWith,
  todoApiInfo,
} from "./buildOpenApiDocument.helpers.js";

describe("buildOpenApiDocument schema registry", () => {
  test("reuses one schema component when the same Zod schema object appears in multiple bodies", () => {
    const todoBody = z.object({ id: z.string() });
    const normalizedSpec = aTodoSpecWith({
      responses: [aResponseWith({ name: "TodoResponse", body: todoBody })],
      operations: [
        anOperationWith({
          operationId: "createTodo",
          method: "POST" as NormalizedOperation["method"],
          request: { body: todoBody },
          responses: [aCanonicalResponseUsage("TodoResponse")],
        }),
      ],
    });

    const result = buildOpenApiDocument(normalizedSpec, todoApiInfo());

    expect(result.document.components?.schemas).toEqual({
      TodoResponseBody: {
        type: "object",
        properties: { id: { type: "string" } },
        required: ["id"],
        additionalProperties: false,
      },
    });
    expect(
      result.document.paths["/todos"]?.post?.requestBody?.content[
        "application/json"
      ]?.schema
    ).toEqual({ $ref: "#/components/schemas/TodoResponseBody" });
    expect(result.warnings).toEqual([]);
  });

  test("suffixes colliding sanitized schema component base names and points refs to each component", () => {
    const normalizedSpec = aTodoSpecWith({
      operations: [
        anOperationWith({
          operationId: "create todo",
          method: "POST" as NormalizedOperation["method"],
          request: { body: z.object({ title: z.string() }) },
        }),
        anOperationWith({
          operationId: "create_todo",
          method: "PUT" as NormalizedOperation["method"],
          request: { body: z.object({ completed: z.boolean() }) },
        }),
        anOperationWith({
          operationId: "create/todo",
          method: "PATCH" as NormalizedOperation["method"],
          request: { body: z.object({ priority: z.number() }) },
        }),
      ],
    });

    const result = buildOpenApiDocument(normalizedSpec, todoApiInfo());

    expect(result.document.paths["/todos"]?.post?.requestBody).toEqual({
      required: true,
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/CreateTodoRequestBody" },
        },
      },
    });
    expect(result.document.paths["/todos"]?.put?.requestBody).toEqual({
      required: true,
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/CreateTodoRequestBody_2" },
        },
      },
    });
    expect(result.document.paths["/todos"]?.patch?.requestBody).toEqual({
      required: true,
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/CreateTodoRequestBody_3" },
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
      CreateTodoRequestBody_2: {
        type: "object",
        properties: { completed: { type: "boolean" } },
        required: ["completed"],
        additionalProperties: false,
      },
      CreateTodoRequestBody_3: {
        type: "object",
        properties: { priority: { type: "number" } },
        required: ["priority"],
        additionalProperties: false,
      },
    });
    expect(result.warnings).toEqual([]);
  });

  describe("local refs", () => {
    test("rebases local JSON Schema refs in recursive request bodies", () => {
      const treeNodeSchema = aRecursiveTreeNodeSchema();
      const normalizedSpec = aTodoSpecWith({
        operations: [
          anOperationWith({
            operationId: "createTree",
            method: "POST" as NormalizedOperation["method"],
            path: "/trees",
            request: { body: treeNodeSchema },
            responses: [anInlineResponseUsage(aResponseWith())],
          }),
        ],
      });

      const result = buildOpenApiDocument(normalizedSpec, todoApiInfo());

      expect(result.document.paths["/trees"]?.post?.requestBody).toEqual({
        required: true,
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/CreateTreeRequestBody" },
          },
        },
      });
      expect(result.document.components?.schemas).toEqual({
        CreateTreeRequestBody: {
          type: "object",
          properties: {
            name: { type: "string" },
            children: {
              type: "array",
              items: { $ref: "#/components/schemas/CreateTreeRequestBody" },
            },
          },
          required: ["name", "children"],
          additionalProperties: false,
        },
      });
      expect(result.warnings).toEqual([]);
    });

    test("rebases local JSON Schema refs in recursive inline response bodies", () => {
      const treeNodeSchema = aRecursiveTreeNodeSchema();
      const normalizedSpec = aTodoSpecWith({
        operations: [
          anOperationWith({
            operationId: "getTree",
            path: "/trees/:id",
            request: { param: z.object({ id: z.string() }) },
            responses: [
              anInlineResponseUsage(aResponseWith({ body: treeNodeSchema })),
            ],
          }),
        ],
      });

      const result = buildOpenApiDocument(normalizedSpec, todoApiInfo());

      expect(
        result.document.paths["/trees/{id}"]?.get?.responses["200"]
      ).toEqual({
        description: "OK",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/GetTreeOkResponseBody" },
          },
        },
      });
      expect(result.document.components?.schemas).toEqual({
        GetTreeOkResponseBody: {
          type: "object",
          properties: {
            name: { type: "string" },
            children: {
              type: "array",
              items: { $ref: "#/components/schemas/GetTreeOkResponseBody" },
            },
          },
          required: ["name", "children"],
          additionalProperties: false,
        },
      });
      expect(result.warnings).toEqual([]);
    });
  });
});
