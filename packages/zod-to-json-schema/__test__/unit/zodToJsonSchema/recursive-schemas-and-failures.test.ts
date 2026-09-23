import { describe, expect, test } from "vitest";
import { z } from "zod";
import { fromZod } from "../../../src/index.js";

describe("fromZod recursive schemas", () => {
  test("handles recursive lazy schemas without infinite traversal", () => {
    type TreeNode = {
      readonly name: string;
      readonly children: readonly TreeNode[];
    };
    const treeNodeSchema: z.ZodType<TreeNode> = z.lazy(() =>
      z.object({ name: z.string(), children: z.array(treeNodeSchema) })
    );

    const result = fromZod(treeNodeSchema);

    expect(result).toEqual({
      schema: {
        type: "object",
        properties: {
          name: { type: "string" },
          children: { type: "array", items: { $ref: "#" } },
        },
        required: ["name", "children"],
        additionalProperties: false,
      },
      warnings: [],
    });
  });

  test("warns once for unsupported schemas inside recursive lazy schemas", () => {
    type TreeNode = {
      readonly name: string;
      readonly metadata: string;
      readonly children: readonly TreeNode[];
    };
    const unsupportedMetadata = z.custom<string>();
    const treeNodeSchema: z.ZodType<TreeNode> = z.lazy(() =>
      z.object({
        name: z.string(),
        metadata: unsupportedMetadata,
        children: z.array(treeNodeSchema),
      })
    );

    const result = fromZod(treeNodeSchema);

    expect(result.warnings).toEqual([
      {
        code: "unsupported-schema",
        path: "/properties/metadata",
        schemaType: "custom",
        message:
          "Zod custom falls back to a broader JSON Schema representation.",
      },
    ]);
    expect(result.schema).toEqual({
      type: "object",
      properties: {
        name: { type: "string" },
        metadata: {},
        children: { type: "array", items: { $ref: "#" } },
      },
      required: ["name", "metadata", "children"],
      additionalProperties: false,
    });
  });

  test("does not duplicate root conversion warnings when root lazy conversion throws", () => {
    const failingSchema = z.lazy(() => {
      throw new Error("schema failed");
    });

    const result = fromZod(failingSchema);

    expect(result.schema).toEqual({});
    expect(result.warnings).toEqual([
      {
        code: "conversion-error",
        schemaType: "lazy",
        path: "",
        message: "schema failed",
      },
    ]);
  });
});

describe("fromZod conversion failures", () => {
  test("returns a deterministic conversion warning for non-Error throws", () => {
    const failingSchema = z.lazy(() => {
      throw "schema failed";
    });

    const result = fromZod(failingSchema);

    expect(result).toEqual({
      schema: {},
      warnings: [
        {
          code: "conversion-error",
          schemaType: "lazy",
          path: "",
          message: "Failed to convert schema to JSON Schema.",
        },
      ],
    });
  });

  test("adds a root fallback warning when a nested lazy schema throws", () => {
    const result = fromZod(
      z.object({
        broken: z.lazy(() => {
          throw "schema failed";
        }),
      })
    );

    expect(result).toEqual({
      schema: {},
      warnings: [
        {
          code: "conversion-error",
          schemaType: "lazy",
          path: "/properties/broken",
          message: "Failed to convert schema to JSON Schema.",
        },
        {
          code: "conversion-error",
          schemaType: "object",
          path: "",
          message: "Failed to convert schema to JSON Schema.",
        },
      ],
    });
  });

  test("preserves earlier warnings when nested lazy conversion throws", () => {
    const result = fromZod(
      z.object({
        fallback: z.custom<string>(),
        broken: z.lazy(() => {
          throw "schema failed";
        }),
      })
    );

    expect(result).toEqual({
      schema: {},
      warnings: [
        {
          code: "unsupported-schema",
          schemaType: "custom",
          path: "/properties/fallback",
          message:
            "Zod custom falls back to a broader JSON Schema representation.",
        },
        {
          code: "conversion-error",
          schemaType: "lazy",
          path: "/properties/broken",
          message: "Failed to convert schema to JSON Schema.",
        },
        {
          code: "conversion-error",
          schemaType: "object",
          path: "",
          message: "Failed to convert schema to JSON Schema.",
        },
      ],
    });
  });
});
