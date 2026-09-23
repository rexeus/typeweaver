import { describe, expect, test } from "vitest";
import { z } from "zod";
import { fromZod } from "../../../src/index.js";

describe("fromZod", () => {
  test("converts string schemas to JSON Schema strings", () => {
    const result = fromZod(z.string());

    expect(result).toEqual({
      schema: { type: "string" },
      warnings: [],
    });
  });

  test("preserves string formats emitted by Zod", () => {
    const result = fromZod(z.object({ email: z.email(), id: z.uuid() }));

    expect(result).toEqual({
      schema: {
        type: "object",
        properties: {
          email: {
            type: "string",
            format: "email",
            pattern:
              "^(?!\\.)(?!.*\\.\\.)([A-Za-z0-9_'+\\-\\.]*)[A-Za-z0-9_+-]@([A-Za-z0-9][A-Za-z0-9\\-]*\\.)+[A-Za-z]{2,}$",
          },
          id: {
            type: "string",
            format: "uuid",
            pattern:
              "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
          },
        },
        required: ["email", "id"],
        additionalProperties: false,
      },
      warnings: [],
    });
  });

  test.each([
    { scenario: "number", schema: z.number(), expected: { type: "number" } },
    {
      scenario: "integer",
      schema: z.int(),
      expected: {
        type: "integer",
        minimum: -9007199254740991,
        maximum: 9007199254740991,
      },
    },
    {
      scenario: "boolean",
      schema: z.boolean(),
      expected: { type: "boolean" },
    },
    { scenario: "null", schema: z.null(), expected: { type: "null" } },
  ])("converts $scenario schemas to JSON Schema", ({ schema, expected }) => {
    const result = fromZod(schema);

    expect(result).toEqual({ schema: expected, warnings: [] });
  });

  test.each([
    {
      scenario: "string literal",
      schema: z.literal("x"),
      expected: { type: "string", const: "x" },
    },
    {
      scenario: "numeric literal",
      schema: z.literal(7),
      expected: { type: "number", const: 7 },
    },
    {
      scenario: "boolean literal",
      schema: z.literal(false),
      expected: { type: "boolean", const: false },
    },
    {
      scenario: "null literal",
      schema: z.literal(null),
      expected: { type: "null", const: null },
    },
  ])("converts $scenario schemas to const schemas", ({ schema, expected }) => {
    const result = fromZod(schema);

    expect(result).toEqual({ schema: expected, warnings: [] });
  });

  test("converts enum schemas to JSON Schema enums", () => {
    const result = fromZod(z.enum(["draft", "published"]));

    expect(result).toEqual({
      schema: { type: "string", enum: ["draft", "published"] },
      warnings: [],
    });
  });
});

describe("fromZod collections and checks", () => {
  test("converts array schemas with item schemas", () => {
    const result = fromZod(z.array(z.string()));

    expect(result).toEqual({
      schema: { type: "array", items: { type: "string" } },
      warnings: [],
    });
  });

  test("converts supported string checks without warnings", () => {
    const result = fromZod(z.string().min(2).max(5).regex(/^a+$/));

    expect(result).toEqual({
      schema: {
        type: "string",
        minLength: 2,
        maxLength: 5,
        pattern: "^a+$",
      },
      warnings: [],
    });
  });

  test("converts supported number checks without warnings", () => {
    const result = fromZod(z.number().min(1).max(10).multipleOf(2));

    expect(result).toEqual({
      schema: {
        type: "number",
        minimum: 1,
        maximum: 10,
        multipleOf: 2,
      },
      warnings: [],
    });
  });

  test("converts supported array checks without warnings", () => {
    const result = fromZod(z.array(z.string()).min(1).max(3));

    expect(result).toEqual({
      schema: {
        minItems: 1,
        maxItems: 3,
        type: "array",
        items: { type: "string" },
      },
      warnings: [],
    });
  });

  test("keeps optional object properties out of required", () => {
    const result = fromZod(
      z.object({ id: z.string(), name: z.string().optional() })
    );

    expect(result).toEqual({
      schema: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
        },
        required: ["id"],
        additionalProperties: false,
      },
      warnings: [],
    });
  });

  test("converts union schemas to anyOf", () => {
    const result = fromZod(z.union([z.string(), z.number()]));

    expect(result).toEqual({
      schema: { anyOf: [{ type: "string" }, { type: "number" }] },
      warnings: [],
    });
  });
});
