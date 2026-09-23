import { describe, expect, test } from "vitest";
import { z } from "zod";
import { fromZod } from "../../../src/index.js";

describe("fromZod transforms and refinements", () => {
  test("warns when transforms fall back to broad JSON Schema", () => {
    const result = fromZod(
      z.object({ count: z.string().transform(value => value.length) })
    );

    expect(result).toEqual({
      schema: {
        type: "object",
        properties: { count: {} },
        required: ["count"],
        additionalProperties: false,
      },
      warnings: [
        {
          code: "unsupported-schema",
          path: "/properties/count",
          schemaType: "pipe",
          message:
            "Zod pipe falls back to a broader JSON Schema representation.",
        },
        {
          code: "unsupported-schema",
          path: "/properties/count/x-typeweaver/pipeOut",
          schemaType: "transform",
          message:
            "Zod transform falls back to a broader JSON Schema representation.",
        },
      ],
    });
  });

  test("warns for unsupported pipe inputs at Typeweaver extension paths", () => {
    const result = fromZod(z.custom<string>().pipe(z.string()));

    expect(result).toEqual({
      schema: { type: "string" },
      warnings: [
        {
          code: "unsupported-schema",
          path: "",
          schemaType: "pipe",
          message:
            "Zod pipe falls back to a broader JSON Schema representation.",
        },
        {
          code: "unsupported-schema",
          path: "/x-typeweaver/pipeIn",
          schemaType: "custom",
          message:
            "Zod custom falls back to a broader JSON Schema representation.",
        },
      ],
    });
  });

  test("warns when refinements cannot be represented exactly", () => {
    const result = fromZod(
      z.object({ slug: z.string().refine(value => value.startsWith("ok")) })
    );

    expect(result).toEqual({
      schema: {
        type: "object",
        properties: { slug: { type: "string" } },
        required: ["slug"],
        additionalProperties: false,
      },
      warnings: [
        {
          code: "unsupported-check",
          path: "/properties/slug",
          schemaType: "string",
          message:
            "Zod string check custom cannot be represented exactly in JSON Schema.",
        },
      ],
    });
  });
});

describe("fromZod strict objects", () => {
  test("converts root strict objects without warning for the internal never catchall", () => {
    const result = fromZod(z.strictObject({ value: z.string() }));

    expect(result).toEqual({
      schema: {
        type: "object",
        properties: { value: { type: "string" } },
        required: ["value"],
        additionalProperties: false,
      },
      warnings: [],
    });
  });

  test("converts nested strict objects without warning for the internal never catchall", () => {
    const result = fromZod(
      z.object({ nested: z.strictObject({ value: z.string() }) })
    );

    expect(result).toEqual({
      schema: {
        type: "object",
        properties: {
          nested: {
            type: "object",
            properties: { value: { type: "string" } },
            required: ["value"],
            additionalProperties: false,
          },
        },
        required: ["nested"],
        additionalProperties: false,
      },
      warnings: [],
    });
  });

  test("keeps unsupported-property warnings for strict objects", () => {
    const result = fromZod(z.strictObject({ value: z.custom<string>() }));

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

  test("still warns for standalone never schemas", () => {
    const result = fromZod(z.never());

    expect(result).toEqual({
      schema: { not: {} },
      warnings: [
        {
          code: "unsupported-schema",
          path: "",
          schemaType: "never",
          message:
            "Zod never falls back to a broader JSON Schema representation.",
        },
      ],
    });
  });
});
