import { describe, expect, test } from "vitest";
import { normalizeJsonSchema } from "../../src/internal/normalizeJsonSchema.js";
import type { JsonSchema } from "../../src/types.js";

describe("normalizeJsonSchema", () => {
  test("fills items/minItems/maxItems for tuple-shaped array schemas", () => {
    const schema: JsonSchema = {
      type: "array",
      prefixItems: [{ type: "string" }, { type: "number" }],
    };

    expect(normalizeJsonSchema(schema)).toEqual({
      type: "array",
      prefixItems: [{ type: "string" }, { type: "number" }],
      items: {},
      minItems: 2,
      maxItems: 2,
    });
  });

  test("leaves data-carrying keywords untouched even when they resemble tuple schemas", () => {
    const tupleShapedDefault = {
      type: "array",
      prefixItems: [1, 2],
    };
    const schema: JsonSchema = {
      type: "string",
      default: tupleShapedDefault,
      examples: [tupleShapedDefault],
      const: tupleShapedDefault,
    };

    const normalized = normalizeJsonSchema(schema);

    expect(normalized.default).toEqual(tupleShapedDefault);
    expect(normalized.examples).toEqual([tupleShapedDefault]);
    expect(normalized.const).toEqual(tupleShapedDefault);
  });

  test("preserves $ref targets inside properties without recursing into them", () => {
    const schema: JsonSchema = {
      type: "object",
      properties: {
        parent: { $ref: "#/$defs/Node" },
      },
      $defs: {
        Node: {
          type: "object",
          properties: {
            children: {
              type: "array",
              prefixItems: [{ type: "string" }],
            },
          },
        },
      },
    };

    const normalized = normalizeJsonSchema(schema);

    expect(normalized.properties).toMatchObject({
      parent: { $ref: "#/$defs/Node" },
    });
    expect(normalized.$defs).toMatchObject({
      Node: {
        properties: {
          children: {
            items: {},
            minItems: 1,
            maxItems: 1,
          },
        },
      },
    });
  });

  test("recurses through anyOf/allOf/oneOf arrays", () => {
    const schema: JsonSchema = {
      anyOf: [
        { type: "array", prefixItems: [{ type: "string" }] },
        { type: "string" },
      ],
    };

    const normalized = normalizeJsonSchema(schema) as {
      anyOf: readonly { items?: JsonSchema; minItems?: number }[];
    };

    expect(normalized.anyOf[0]).toMatchObject({
      items: {},
      minItems: 1,
      maxItems: 1,
    });
    expect(normalized.anyOf[1]).toEqual({ type: "string" });
  });
});
