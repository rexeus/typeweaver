import { z } from "zod";
import { describe, expect, test } from "vitest";
import { fromZod } from "../../src/zodToJsonSchema.js";

describe("fromZod", () => {
  test("converts common supported schemas", () => {
    const schema = z.object({
      id: z.string().uuid(),
      title: z.string().min(1).max(100),
      count: z.number().int().min(0),
      tags: z.array(z.string()).min(1),
      status: z.enum(["draft", "published"]),
      metadata: z.record(z.string(), z.union([z.string(), z.number()])),
      tuple: z.tuple([z.string(), z.number()]),
      nullable: z.string().nullable(),
      optional: z.string().optional(),
      withDefault: z.number().default(1),
    });

    const result = fromZod(schema);

    expect(result.warnings).toEqual([]);
    expect(result.schema).toMatchObject({
      type: "object",
      required: [
        "id",
        "title",
        "count",
        "tags",
        "status",
        "metadata",
        "tuple",
        "nullable",
        "withDefault",
      ],
      additionalProperties: false,
      properties: {
        id: {
          type: "string",
          format: "uuid",
        },
        title: {
          type: "string",
          minLength: 1,
          maxLength: 100,
        },
        count: {
          type: "integer",
          minimum: 0,
        },
        tags: {
          type: "array",
          minItems: 1,
          items: {
            type: "string",
          },
        },
        status: {
          type: "string",
          enum: ["draft", "published"],
        },
        metadata: {
          type: "object",
          additionalProperties: {
            anyOf: [{ type: "string" }, { type: "number" }],
          },
        },
        tuple: {
          type: "array",
          prefixItems: [{ type: "string" }, { type: "number" }],
        },
        nullable: {
          anyOf: [{ type: "string" }, { type: "null" }],
        },
        optional: {
          type: "string",
        },
        withDefault: {
          type: "number",
          default: 1,
        },
      },
    });
  });

  test("emits warnings and broad fallback schemas for unsupported constructs", () => {
    const schema = z.object({
      createdAt: z.date(),
      transformed: z.string().transform(value => value.length),
      refined: z.string().refine(value => value.startsWith("ok")),
      mapped: z.map(z.string(), z.number()),
    });

    const result = fromZod(schema);

    expect(result.schema).toMatchObject({
      type: "object",
      properties: {
        createdAt: {},
        transformed: {},
        refined: {
          type: "string",
        },
        mapped: {},
      },
    });
    expect(result.warnings).toEqual([
      expect.objectContaining({
        code: "unsupported-schema",
        path: "$.createdAt",
        schemaType: "date",
      }),
      expect.objectContaining({
        code: "unsupported-schema",
        path: "$.transformed",
        schemaType: "pipe",
      }),
      expect.objectContaining({
        code: "unsupported-schema",
        path: "$.transformed.out",
        schemaType: "transform",
      }),
      expect.objectContaining({
        code: "unsupported-check",
        path: "$.refined",
        schemaType: "string",
      }),
      expect.objectContaining({
        code: "unsupported-schema",
        path: "$.mapped",
        schemaType: "map",
      }),
    ]);
  });

  test("preserves lazy schemas while warning only when the resolved schema needs it", () => {
    type Node = {
      readonly name: string;
      readonly children: readonly Node[];
    };

    const nodeSchema: z.ZodType<Node> = z.lazy(() =>
      z.object({
        name: z.string(),
        children: z.array(nodeSchema),
      })
    );

    const result = fromZod(nodeSchema);

    expect(result.warnings).toEqual([]);
    expect(result.schema).toMatchObject({
      type: "object",
      properties: {
        name: { type: "string" },
        children: {
          type: "array",
        },
      },
    });
  });
});
