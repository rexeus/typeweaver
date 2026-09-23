import { describe, expect, test } from "vitest";
import { z } from "zod";
import { fromZod } from "../../../src/index.js";

describe("fromZod compositions", () => {
  test("converts intersection schemas to allOf", () => {
    const result = fromZod(
      z.intersection(
        z.object({ id: z.string() }),
        z.object({ name: z.string() })
      )
    );

    expect(result).toEqual({
      schema: {
        allOf: [
          {
            type: "object",
            properties: { id: { type: "string" } },
            required: ["id"],
            additionalProperties: false,
          },
          {
            type: "object",
            properties: { name: { type: "string" } },
            required: ["name"],
            additionalProperties: false,
          },
        ],
      },
      warnings: [],
    });
  });

  test("converts nullable schemas to an anyOf null union", () => {
    const result = fromZod(z.string().nullable());

    expect(result).toEqual({
      schema: { anyOf: [{ type: "string" }, { type: "null" }] },
      warnings: [],
    });
  });

  test.each([
    { scenario: "default", schema: z.string().default("fallback") },
    { scenario: "catch", schema: z.string().catch("fallback") },
  ])("preserves $scenario fallback values emitted by Zod", ({ schema }) => {
    const result = fromZod(schema);

    expect(result).toEqual({
      schema: { default: "fallback", type: "string" },
      warnings: [],
    });
  });

  test("converts prefault schemas without warnings", () => {
    const result = fromZod(z.string().prefault("fallback"));

    expect(result).toEqual({
      schema: { type: "string" },
      warnings: [],
    });
  });

  test("normalizes root tuples to fixed-length array schemas", () => {
    const result = fromZod(z.tuple([z.string(), z.number()]));

    expect(result).toEqual({
      schema: {
        type: "array",
        prefixItems: [{ type: "string" }, { type: "number" }],
        items: {},
        minItems: 2,
        maxItems: 2,
      },
      warnings: [],
    });
  });
});

describe("fromZod tuple normalization", () => {
  test("normalizes rest tuples without fixed-length array bounds", () => {
    const result = fromZod(z.tuple([z.string()]).rest(z.number()));

    expect(result).toEqual({
      schema: {
        type: "array",
        prefixItems: [{ type: "string" }],
        items: { type: "number" },
        minItems: 1,
      },
      warnings: [],
    });
  });

  test.each([
    { scenario: "any", restSchema: z.any() },
    { scenario: "unknown", restSchema: z.unknown() },
  ])(
    "normalizes $scenario rest tuples as variable-length array schemas",
    ({ restSchema }) => {
      const result = fromZod(z.tuple([z.string()]).rest(restSchema));

      expect(result.schema).toEqual({
        type: "array",
        prefixItems: [{ type: "string" }],
        items: {},
        minItems: 1,
      });
      expect(Object.prototype.hasOwnProperty.call(result.schema, "items")).toBe(
        true
      );
      expect(
        Object.prototype.hasOwnProperty.call(result.schema, "maxItems")
      ).toBe(false);
      expect(result.warnings).toEqual([]);
    }
  );

  test("normalizes tuples under object properties", () => {
    const result = fromZod(
      z.object({ point: z.tuple([z.number(), z.number()]) })
    );

    expect(result).toEqual({
      schema: {
        type: "object",
        properties: {
          point: {
            type: "array",
            prefixItems: [{ type: "number" }, { type: "number" }],
            items: {},
            minItems: 2,
            maxItems: 2,
          },
        },
        required: ["point"],
        additionalProperties: false,
      },
      warnings: [],
    });
  });

  test("does not warn for broad any and unknown schemas", () => {
    const result = fromZod(z.union([z.any(), z.unknown()]));

    expect(result).toEqual({
      schema: { anyOf: [{}, {}] },
      warnings: [],
    });
  });

  test("warns when custom schemas fall back to broad JSON Schema", () => {
    const result = fromZod(z.object({ value: z.custom<string>() }));

    expect(result).toEqual({
      schema: {
        type: "object",
        properties: { value: {} },
        required: ["value"],
        additionalProperties: false,
      },
      warnings: [
        {
          code: "unsupported-schema",
          path: "/properties/value",
          schemaType: "custom",
          message:
            "Zod custom falls back to a broader JSON Schema representation.",
        },
      ],
    });
  });
});
