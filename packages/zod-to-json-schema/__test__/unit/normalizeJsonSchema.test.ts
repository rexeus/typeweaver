import { describe, expect, test } from "vitest";
import { normalizeJsonSchema } from "../../src/internal/normalizeJsonSchema.js";
import type { JsonSchema } from "../../src/index.js";

describe("normalizeJsonSchema", () => {
  test("adds array bounds to tuple-shaped root schemas", () => {
    const result = normalizeJsonSchema({
      type: "array",
      prefixItems: [{ type: "string" }, { type: "number" }],
    });

    expect(result).toEqual({
      type: "array",
      prefixItems: [{ type: "string" }, { type: "number" }],
      items: {},
      minItems: 2,
      maxItems: 2,
    });
  });

  test("preserves existing tuple items and item bounds", () => {
    const result = normalizeJsonSchema({
      type: "array",
      prefixItems: [{ type: "string" }, { type: "number" }],
      items: { type: "boolean" },
      minItems: 1,
      maxItems: 3,
    });

    expect(result).toEqual({
      type: "array",
      prefixItems: [{ type: "string" }, { type: "number" }],
      items: { type: "boolean" },
      minItems: 1,
      maxItems: 3,
    });
  });

  test("preserves rest tuple item schemas without adding fixed bounds", () => {
    const result = normalizeJsonSchema({
      type: "array",
      prefixItems: [{ type: "string" }],
      items: { type: "number" },
    });

    expect(result).toEqual({
      type: "array",
      prefixItems: [{ type: "string" }],
      items: { type: "number" },
      minItems: 1,
    });
  });

  test("preserves permissive rest tuple items without adding fixed bounds", () => {
    const result = normalizeJsonSchema({
      type: "array",
      prefixItems: [{ type: "string" }],
      items: {},
    });

    expect(result).toEqual({
      type: "array",
      prefixItems: [{ type: "string" }],
      items: {},
      minItems: 1,
    });
  });

  test("normalizes nested tuples under object properties", () => {
    const result = normalizeJsonSchema({
      type: "object",
      properties: {
        tuple: {
          type: "array",
          prefixItems: [{ type: "string" }],
        },
      },
    });

    expect(result).toEqual({
      type: "object",
      properties: {
        tuple: {
          type: "array",
          prefixItems: [{ type: "string" }],
          items: {},
          minItems: 1,
          maxItems: 1,
        },
      },
    });
  });

  test.each([
    { scenario: "anyOf", keyword: "anyOf" },
    { scenario: "oneOf", keyword: "oneOf" },
    { scenario: "allOf", keyword: "allOf" },
  ])("normalizes nested tuples under $scenario", ({ keyword }) => {
    const result = normalizeJsonSchema({
      [keyword]: [
        {
          type: "array",
          prefixItems: [{ type: "string" }, { type: "number" }],
        },
      ],
    });

    expect(result).toEqual({
      [keyword]: [
        {
          type: "array",
          prefixItems: [{ type: "string" }, { type: "number" }],
          items: {},
          minItems: 2,
          maxItems: 2,
        },
      ],
    });
  });

  const conditionalThenKeyword = ["th", "en"].join("");
  const schemaContainerCases: ReadonlyArray<{
    readonly scenario: string;
    readonly input: JsonSchema;
    readonly expected: JsonSchema;
  }> = [
    {
      scenario: "additionalProperties",
      input: {
        type: "object",
        additionalProperties: {
          type: "array",
          prefixItems: [{ type: "string" }],
        },
      },
      expected: {
        type: "object",
        additionalProperties: {
          type: "array",
          prefixItems: [{ type: "string" }],
          items: {},
          minItems: 1,
          maxItems: 1,
        },
      },
    },
    {
      scenario: "patternProperties",
      input: {
        patternProperties: {
          "^x-": {
            type: "array",
            prefixItems: [{ type: "number" }],
          },
        },
      },
      expected: {
        patternProperties: {
          "^x-": {
            type: "array",
            prefixItems: [{ type: "number" }],
            items: {},
            minItems: 1,
            maxItems: 1,
          },
        },
      },
    },
    {
      scenario: "$defs",
      input: {
        $defs: {
          tuple: {
            type: "array",
            prefixItems: [{ type: "boolean" }],
          },
        },
      },
      expected: {
        $defs: {
          tuple: {
            type: "array",
            prefixItems: [{ type: "boolean" }],
            items: {},
            minItems: 1,
            maxItems: 1,
          },
        },
      },
    },
    {
      scenario: "propertyNames",
      input: {
        propertyNames: {
          type: "array",
          prefixItems: [{ type: "string" }],
        },
      },
      expected: {
        propertyNames: {
          type: "array",
          prefixItems: [{ type: "string" }],
          items: {},
          minItems: 1,
          maxItems: 1,
        },
      },
    },
    {
      scenario: "if",
      input: {
        if: {
          type: "array",
          prefixItems: [{ type: "string" }],
        },
      },
      expected: {
        if: {
          type: "array",
          prefixItems: [{ type: "string" }],
          items: {},
          minItems: 1,
          maxItems: 1,
        },
      },
    },
    {
      scenario: "then",
      input: {
        [conditionalThenKeyword]: {
          type: "array",
          prefixItems: [{ type: "string" }],
        },
      },
      expected: {
        [conditionalThenKeyword]: {
          type: "array",
          prefixItems: [{ type: "string" }],
          items: {},
          minItems: 1,
          maxItems: 1,
        },
      },
    },
    {
      scenario: "else",
      input: {
        else: {
          type: "array",
          prefixItems: [{ type: "string" }],
        },
      },
      expected: {
        else: {
          type: "array",
          prefixItems: [{ type: "string" }],
          items: {},
          minItems: 1,
          maxItems: 1,
        },
      },
    },
    {
      scenario: "not",
      input: {
        not: {
          type: "array",
          prefixItems: [{ type: "string" }],
        },
      },
      expected: {
        not: {
          type: "array",
          prefixItems: [{ type: "string" }],
          items: {},
          minItems: 1,
          maxItems: 1,
        },
      },
    },
    {
      scenario: "contains",
      input: {
        contains: {
          type: "array",
          prefixItems: [{ type: "string" }],
        },
      },
      expected: {
        contains: {
          type: "array",
          prefixItems: [{ type: "string" }],
          items: {},
          minItems: 1,
          maxItems: 1,
        },
      },
    },
  ];

  test.each(schemaContainerCases)(
    "normalizes tuples under $scenario",
    ({ input, expected }) => {
      const result = normalizeJsonSchema(input);

      expect(result).toEqual(expected);
    }
  );

  test("does not normalize schema-shaped payload fields", () => {
    const payload = {
      type: "array",
      prefixItems: [{ type: "string" }],
    };

    const result = normalizeJsonSchema({
      type: "string",
      default: payload,
      const: payload,
      examples: [payload],
      enum: [payload],
    });

    expect(result).toEqual({
      type: "string",
      default: payload,
      const: payload,
      examples: [payload],
      enum: [payload],
    });
  });

  test("returns normalized copies without mutating the input schema", () => {
    const input: JsonSchema = {
      type: "object",
      properties: {
        tuple: {
          type: "array",
          prefixItems: [{ type: "string" }],
        },
      },
    };

    const result = normalizeJsonSchema(input);

    expect(result).not.toBe(input);
    expect(result.properties).not.toBe(input.properties);
    expect(input).toEqual({
      type: "object",
      properties: {
        tuple: {
          type: "array",
          prefixItems: [{ type: "string" }],
        },
      },
    });
  });
});
