import { describe, expect, test } from "vitest";
import { z } from "zod";
import { fromZod } from "../../src/tsTypeGenerator.js";
import { print } from "../../src/tsTypePrinter.js";

function toTs(schema: z.ZodType): string {
  return print(fromZod(schema));
}

describe("primitive schemas", () => {
  test.each([
    { scenario: "z.string()", schema: z.string(), expected: "string" },
    { scenario: "z.number()", schema: z.number(), expected: "number" },
    { scenario: "z.boolean()", schema: z.boolean(), expected: "boolean" },
    { scenario: "z.any()", schema: z.any(), expected: "any" },
    { scenario: "z.date()", schema: z.date(), expected: "Date" },
    { scenario: "z.bigint()", schema: z.bigint(), expected: "bigint" },
    { scenario: "z.symbol()", schema: z.symbol(), expected: "symbol" },
    {
      scenario: "z.undefined()",
      schema: z.undefined(),
      expected: "undefined",
    },
    { scenario: "z.null()", schema: z.null(), expected: "null" },
    { scenario: "z.unknown()", schema: z.unknown(), expected: "unknown" },
    { scenario: "z.never()", schema: z.never(), expected: "never" },
    { scenario: "z.void()", schema: z.void(), expected: "void" },
  ])("maps $scenario to $expected", ({ schema, expected }) => {
    expect(toTs(schema)).toBe(expected);
  });
});

describe("optional and nullable schemas", () => {
  test("maps standalone optional schemas to a union with undefined", () => {
    expect(toTs(z.string().optional())).toBe("string | undefined");
  });

  test("maps standalone nullable schemas to a union with null", () => {
    expect(toTs(z.string().nullable())).toBe("string | null");
  });

  test("preserves optional around nullable schemas", () => {
    expect(toTs(z.string().nullable().optional())).toBe(
      "(string | null) | undefined"
    );
  });

  test("preserves nullable around optional schemas", () => {
    expect(toTs(z.string().optional().nullable())).toBe(
      "(string | undefined) | null"
    );
  });
});

describe("default schemas", () => {
  test("maps default schemas to their inner TypeScript type", () => {
    expect(toTs(z.string().default("fallback"))).toBe("string");
  });

  test("maps default optional schemas without undefined", () => {
    expect(toTs(z.string().optional().default("fallback"))).toBe("string");
  });

  test("maps default nullable optional schemas without undefined", () => {
    expect(toTs(z.string().nullable().optional().default("fallback"))).toBe(
      "string | null"
    );
  });

  test("maps default optional nullable schemas without undefined", () => {
    expect(toTs(z.string().optional().nullable().default("fallback"))).toBe(
      "string | null"
    );
  });

  test("maps default object fields to required properties with inner output types", () => {
    expect(toTs(z.object({ name: z.string().default("Anonymous") }))).toBe(
      ["{", "    name: string;", "}"].join("\n")
    );
  });

  test("maps optional default object fields to required properties without undefined", () => {
    expect(
      toTs(z.object({ name: z.string().optional().default("Anonymous") }))
    ).toBe(["{", "    name: string;", "}"].join("\n"));
  });

  test("maps nullable optional default object fields to required nullable properties", () => {
    expect(
      toTs(
        z.object({
          name: z.string().optional().nullable().default("Anonymous"),
        })
      )
    ).toBe(["{", "    name: string | null;", "}"].join("\n"));
  });
});

describe("object schemas", () => {
  test("maps required object fields to required TypeScript properties", () => {
    expect(toTs(z.object({ id: z.string(), age: z.number() }))).toBe(
      ["{", "    id: string;", "    age: number;", "}"].join("\n")
    );
  });

  test("maps empty objects to empty TypeScript object literals", () => {
    expect(toTs(z.object({}))).toBe("{}");
  });

  test("quotes object keys that are not TypeScript identifiers", () => {
    expect(toTs(z.object({ "x-id": z.string() }))).toBe(
      ["{", '    "x-id": string;', "}"].join("\n")
    );
  });

  test("maps nested objects with arrays to nested TypeScript object output", () => {
    expect(
      toTs(z.object({ user: z.object({ tags: z.array(z.string()) }) }))
    ).toBe(
      ["{", "    user: {", "        tags: string[];", "    };", "}"].join("\n")
    );
  });

  test("maps object optional fields with a property marker and undefined union", () => {
    expect(toTs(z.object({ age: z.number().optional() }))).toBe(
      ["{", "    age?: number | undefined;", "}"].join("\n")
    );
  });

  test("maps object nullable fields as required unions with null", () => {
    expect(toTs(z.object({ name: z.string().nullable() }))).toBe(
      ["{", "    name: string | null;", "}"].join("\n")
    );
  });

  test("maps object fields optional through nullable to optional TypeScript properties", () => {
    expect(toTs(z.object({ name: z.string().optional().nullable() }))).toBe(
      ["{", "    name?: (string | undefined) | null;", "}"].join("\n")
    );
  });

  test("maps object fields unioned with undefined to optional TypeScript properties", () => {
    expect(toTs(z.object({ code: z.union([z.string(), z.undefined()]) }))).toBe(
      ["{", "    code?: string | undefined;", "}"].join("\n")
    );
  });
});

describe("union and intersection schemas", () => {
  test("maps string and number unions", () => {
    expect(toTs(z.union([z.string(), z.number()]))).toBe("string | number");
  });

  test("maps object intersections to TypeScript intersection output", () => {
    const schema = z.intersection(
      z.object({ id: z.string() }),
      z.object({ age: z.number() })
    );

    const typeScript = toTs(schema);

    expect(typeScript).toBe(
      ["{", "    id: string;", "} & {", "    age: number;", "}"].join("\n")
    );
  });
});

describe("literal and enum schemas", () => {
  test.each([
    {
      scenario: "string literal",
      schema: z.literal("success"),
      expected: '"success"',
    },
    { scenario: "number literal", schema: z.literal(200), expected: "200" },
    { scenario: "true literal", schema: z.literal(true), expected: "true" },
    { scenario: "false literal", schema: z.literal(false), expected: "false" },
    { scenario: "bigint literal", schema: z.literal(1n), expected: "1n" },
    {
      scenario: "negative bigint literal",
      schema: z.literal(-1n),
      expected: "-1n",
    },
    {
      scenario: "multi-value string literal",
      schema: z.literal(["draft", "done"]),
      expected: '"draft" | "done"',
    },
    {
      scenario: "mixed multi-value literal",
      schema: z.literal(["draft", 200, true, null, undefined, 1n]),
      expected: '"draft" | 200 | true | null | undefined | 1n',
    },
    { scenario: "null literal", schema: z.literal(null), expected: "null" },
    {
      scenario: "undefined literal",
      schema: z.literal(undefined),
      expected: "undefined",
    },
  ])("maps $scenario to $expected", ({ schema, expected }) => {
    expect(toTs(schema)).toBe(expected);
  });

  test("maps z.enum() to a union of string literals", () => {
    expect(toTs(z.enum(["draft", "done"]))).toBe('"draft" | "done"');
  });

  test("maps z.enum() object values to a union of string literals", () => {
    expect(toTs(z.enum({ Draft: "draft", Done: "done" }))).toBe(
      '"draft" | "done"'
    );
  });

  test("maps z.enum() numeric object values to a union of numeric literals", () => {
    expect(toTs(z.enum({ One: 1, Two: 2 }))).toBe("1 | 2");
  });

  test("maps TypeScript numeric enum values without reverse-map names", () => {
    enum Status {
      Draft,
      Done,
    }

    expect(toTs(z.enum(Status))).toBe("0 | 1");
  });

  test("maps TypeScript heterogeneous enum values without reverse-map names", () => {
    enum Status {
      Draft = "draft",
      Done = 1,
    }

    expect(toTs(z.enum(Status))).toBe('"draft" | 1');
  });
});

describe("collection schemas", () => {
  test("maps arrays to TypeScript array syntax", () => {
    expect(toTs(z.array(z.string()))).toBe("string[]");
  });

  test("maps array element unions with TypeScript parentheses", () => {
    expect(toTs(z.array(z.union([z.string(), z.number()])))).toBe(
      "(string | number)[]"
    );
  });

  test("maps tuples to TypeScript tuple syntax", () => {
    expect(toTs(z.tuple([z.string(), z.number()]))).toBe(
      ["[", "    string,", "    number", "]"].join("\n")
    );
  });

  test("maps variadic tuples to TypeScript rest tuple syntax", () => {
    expect(toTs(z.tuple([z.string()], z.number()))).toBe(
      ["[", "    string,", "    ...number[]", "]"].join("\n")
    );
  });

  test("maps variadic tuple union rests with TypeScript parentheses", () => {
    expect(toTs(z.tuple([z.string()], z.union([z.number(), z.boolean()])))).toBe(
      ["[", "    string,", "    ...(number | boolean)[]", "]"].join("\n")
    );
  });

  test("maps records to TypeScript Record types", () => {
    expect(toTs(z.record(z.string(), z.number()))).toBe(
      "Record<string, number>"
    );
  });

  test("maps maps to TypeScript Map types", () => {
    expect(toTs(z.map(z.string(), z.number()))).toBe("Map<string, number>");
  });

  test("maps sets to TypeScript Set types", () => {
    expect(toTs(z.set(z.string()))).toBe("Set<string>");
  });

  test("maps promises to TypeScript Promise types", () => {
    expect(toTs(z.promise(z.string()))).toBe("Promise<string>");
  });
});

describe("unsupported schemas", () => {
  test.each([
    { scenario: "z.file()", schema: z.file() },
    { scenario: "z.lazy()", schema: z.lazy(() => z.string()) },
    {
      scenario: "z.templateLiteral()",
      schema: z.templateLiteral(["hello ", z.string()]),
    },
    { scenario: "z.custom()", schema: z.custom() },
    {
      scenario: "z.transform()",
      schema: z.string().transform((value) => value.length),
    },
    {
      scenario: "z.pipe()",
      schema: z.string().pipe(z.transform((value) => value)),
    },
    {
      scenario: "z.nonoptional()",
      schema: z.string().optional().nonoptional(),
    },
    {
      scenario: "z.readonly()",
      schema: z.object({ id: z.string() }).readonly(),
    },
    { scenario: "z.nan()", schema: z.nan() },
    { scenario: "z.catch()", schema: z.string().catch("fallback") },
    { scenario: "z.success()", schema: z.success(z.string()) },
  ])("falls back to unknown for unsupported $scenario schemas", ({ schema }) => {
    expect(toTs(schema)).toBe("unknown");
  });
});
