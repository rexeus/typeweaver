import { describe, expect, test } from "vitest";
import { z } from "zod";
import { fromZod } from "../../../src/index.js";

describe("fromZod collection warnings", () => {
  test("warns for unsupported map keys and values at Typeweaver extension paths", () => {
    const result = fromZod(
      z.map(
        z.string().refine(value => value.startsWith("ok")),
        z.custom<string>()
      )
    );

    expect(result).toEqual({
      schema: {},
      warnings: [
        {
          code: "unsupported-schema",
          path: "",
          schemaType: "map",
          message:
            "Zod map falls back to a broader JSON Schema representation.",
        },
        {
          code: "unsupported-check",
          path: "/x-typeweaver/mapKey",
          schemaType: "string",
          message:
            "Zod string check custom cannot be represented exactly in JSON Schema.",
        },
        {
          code: "unsupported-schema",
          path: "/x-typeweaver/mapValue",
          schemaType: "custom",
          message:
            "Zod custom falls back to a broader JSON Schema representation.",
        },
      ],
    });
  });

  test("warns for unsupported object catchall schemas", () => {
    const result = fromZod(z.object({}).catchall(z.custom<string>()));

    expect(result).toEqual({
      schema: {
        type: "object",
        properties: {},
        additionalProperties: {},
      },
      warnings: [
        {
          code: "unsupported-schema",
          path: "/additionalProperties",
          schemaType: "custom",
          message:
            "Zod custom falls back to a broader JSON Schema representation.",
        },
      ],
    });
  });

  test("does not duplicate warnings for reused schema instances", () => {
    const reusedCustomSchema = z.custom<string>();

    const result = fromZod(
      z.object({ first: reusedCustomSchema, second: reusedCustomSchema })
    );

    expect(result.warnings).toEqual([
      {
        code: "unsupported-schema",
        path: "/properties/first",
        schemaType: "custom",
        message:
          "Zod custom falls back to a broader JSON Schema representation.",
      },
    ]);
  });
});

describe("fromZod warning paths", () => {
  test("encodes warning paths as JSON Pointers", () => {
    const result = fromZod(
      z.object({
        "a/b": z.custom<string>(),
        "a~b": z.custom<string>(),
        "a.b": z.custom<string>(),
      })
    );

    expect(result.warnings).toEqual([
      {
        code: "unsupported-schema",
        path: "/properties/a~1b",
        schemaType: "custom",
        message:
          "Zod custom falls back to a broader JSON Schema representation.",
      },
      {
        code: "unsupported-schema",
        path: "/properties/a~0b",
        schemaType: "custom",
        message:
          "Zod custom falls back to a broader JSON Schema representation.",
      },
      {
        code: "unsupported-schema",
        path: "/properties/a.b",
        schemaType: "custom",
        message:
          "Zod custom falls back to a broader JSON Schema representation.",
      },
    ]);
  });

  test("warns for unsupported record keys and values at JSON Schema paths", () => {
    const result = fromZod(
      z.record(
        z.string().refine(value => value.startsWith("ok")),
        z.custom<string>()
      )
    );

    expect(result).toEqual({
      schema: {
        type: "object",
        propertyNames: { type: "string" },
        additionalProperties: {},
      },
      warnings: [
        {
          code: "unsupported-check",
          path: "/propertyNames",
          schemaType: "string",
          message:
            "Zod string check custom cannot be represented exactly in JSON Schema.",
        },
        {
          code: "unsupported-schema",
          path: "/additionalProperties",
          schemaType: "custom",
          message:
            "Zod custom falls back to a broader JSON Schema representation.",
        },
      ],
    });
  });
});

describe("fromZod nested warning preservation", () => {
  test("preserves nested warnings through prefault schemas", () => {
    const result = fromZod(
      z.object({ value: z.custom<string>().prefault("fallback") })
    );

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

  test.each([
    {
      scenario: "date",
      schema: z.date(),
      schemaType: "date",
      expectedPropertySchema: {},
    },
    {
      scenario: "file",
      schema: z.file(),
      schemaType: "file",
      expectedPropertySchema: {
        type: "string",
        format: "binary",
        contentEncoding: "binary",
      },
    },
    {
      scenario: "map",
      schema: z.map(z.string(), z.number()),
      schemaType: "map",
      expectedPropertySchema: {},
    },
    {
      scenario: "set",
      schema: z.set(z.string()),
      schemaType: "set",
      expectedPropertySchema: {},
    },
  ])(
    "warns when $scenario schemas fall back to broader JSON Schema",
    ({ schema, schemaType, expectedPropertySchema }) => {
      const result = fromZod(z.object({ value: schema }));

      expect(result).toEqual({
        schema: {
          type: "object",
          properties: { value: expectedPropertySchema },
          required: ["value"],
          additionalProperties: false,
        },
        warnings: [
          {
            code: "unsupported-schema",
            path: "/properties/value",
            schemaType,
            message: `Zod ${schemaType} falls back to a broader JSON Schema representation.`,
          },
        ],
      });
    }
  );
});
