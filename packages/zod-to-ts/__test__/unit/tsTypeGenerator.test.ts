import { describe, expect, test } from "vitest";
import { z } from "zod";
import { EmptyZodLiteralError } from "../../src/errors/EmptyZodLiteralError.js";
import { UnsupportedLiteralValueError } from "../../src/errors/UnsupportedLiteralValueError.js";
import { fromZod } from "../../src/tsTypeGenerator.js";
import { print } from "../../src/tsTypePrinter.js";

function toTs(schema: z.ZodType): string {
  return print(fromZod(schema));
}

const captureError = (action: () => void): unknown => {
  try {
    action();
  } catch (error) {
    return error;
  }

  return undefined;
};

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

  test.each([
    { scenario: "default", key: "default" },
    { scenario: "class", key: "class" },
    { scenario: "function", key: "function" },
    { scenario: "export", key: "export" },
    { scenario: "extends", key: "extends" },
    { scenario: "implements", key: "implements" },
    { scenario: "interface", key: "interface" },
    { scenario: "package", key: "package" },
    { scenario: "private", key: "private" },
    { scenario: "public", key: "public" },
    { scenario: "return", key: "return" },
    { scenario: "const", key: "const" },
    { scenario: "import", key: "import" },
  ])("quotes reserved object key $scenario", ({ key }) => {
    expect(toTs(z.object({ [key]: z.string() }))).toBe(
      ["{", `    "${key}": string;`, "}"].join("\n")
    );
  });

  test.each([
    { scenario: "hyphenated key", key: "x-id", expectedKey: '"x-id"' },
    {
      scenario: "header key",
      key: "content-type",
      expectedKey: '"content-type"',
    },
    { scenario: "leading number key", key: "123abc", expectedKey: '"123abc"' },
    { scenario: "empty key", key: "", expectedKey: '""' },
    {
      scenario: "key with space",
      key: "has space",
      expectedKey: '"has space"',
    },
    {
      scenario: "leading space key",
      key: " leading",
      expectedKey: '" leading"',
    },
    {
      scenario: "trailing space key",
      key: "trailing ",
      expectedKey: '"trailing "',
    },
    { scenario: "dotted key", key: "a.b", expectedKey: '"a.b"' },
    { scenario: "slashed key", key: "a/b", expectedKey: '"a/b"' },
    {
      scenario: "quoted key",
      key: 'quote"key',
      expectedKey: '"quote\\"key"',
    },
    {
      scenario: "line break key",
      key: "line\nbreak",
      expectedKey: '"line\\nbreak"',
    },
  ])("quotes invalid object key for $scenario", ({ key, expectedKey }) => {
    expect(toTs(z.object({ [key]: z.string() }))).toBe(
      ["{", `    ${expectedKey}: string;`, "}"].join("\n")
    );
  });

  test.each([
    { scenario: "default-like key", key: "defaultValue" },
    { scenario: "class-like key", key: "className" },
  ])("keeps normal object key unquoted for $scenario", ({ key }) => {
    expect(toTs(z.object({ [key]: z.string() }))).toBe(
      ["{", `    ${key}: string;`, "}"].join("\n")
    );
  });

  test("quotes optional reserved object keys and preserves the optional marker", () => {
    expect(toTs(z.object({ default: z.string().optional() }))).toBe(
      ["{", '    "default"?: string | undefined;', "}"].join("\n")
    );
  });

  test("quotes optional invalid object keys and preserves the optional marker", () => {
    expect(toTs(z.object({ "x-id": z.string().optional() }))).toBe(
      ["{", '    "x-id"?: string | undefined;', "}"].join("\n")
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

  test("rejects empty Zod literal value sets", () => {
    const schema = z.literal("value");
    Object.defineProperty(schema._zod.def, "values", { value: [] });

    const error = captureError(() => fromZod(schema));

    expect(error).toBeInstanceOf(EmptyZodLiteralError);
    if (!(error instanceof EmptyZodLiteralError)) return;
    expect(error.message).toBe(
      "ZodLiteral must contain at least one literal value."
    );
  });

  test("rejects unsupported Zod literal value types", () => {
    const schema = z.literal("value");
    Object.defineProperty(schema._zod.def, "values", {
      value: [Symbol("unsupported")],
    });

    const error = captureError(() => fromZod(schema));

    expect(error).toBeInstanceOf(UnsupportedLiteralValueError);
    expect(error).toEqual(
      expect.objectContaining({
        valueType: "symbol",
      })
    );
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
    expect(
      toTs(z.tuple([z.string()], z.union([z.number(), z.boolean()])))
    ).toBe(["[", "    string,", "    ...(number | boolean)[]", "]"].join("\n"));
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

describe("wrapper schemas", () => {
  test("maps nonoptional optional schemas without undefined", () => {
    expect(toTs(z.string().optional().nonoptional())).toBe("string");
  });

  test("maps nonoptional undefined schemas to never", () => {
    expect(toTs(z.undefined().nonoptional())).toBe("never");
  });

  test("maps nonoptional undefined object fields to required never properties", () => {
    expect(toTs(z.object({ value: z.undefined().nonoptional() }))).toBe(
      ["{", "    value: never;", "}"].join("\n")
    );
  });

  test("maps nonoptional unions without undefined", () => {
    expect(toTs(z.union([z.string(), z.undefined()]).nonoptional())).toBe(
      "string"
    );
  });

  test("maps nonoptional optional object fields to required TypeScript properties", () => {
    expect(toTs(z.object({ name: z.string().optional().nonoptional() }))).toBe(
      ["{", "    name: string;", "}"].join("\n")
    );
  });

  test("maps nan schemas to number", () => {
    expect(toTs(z.nan())).toBe("number");
  });

  test("maps pipe schemas to the output schema type", () => {
    expect(toTs(z.string().pipe(z.coerce.number()))).toBe("number");
  });

  test("maps pipe schemas with unsupported outputs to unknown", () => {
    expect(toTs(z.string().pipe(z.transform(value => value)))).toBe("unknown");
  });

  test("maps pipe object fields to optional properties from optional outputs", () => {
    expect(
      toTs(z.object({ value: z.string().pipe(z.string().optional()) }))
    ).toBe(["{", "    value?: string | undefined;", "}"].join("\n"));
  });

  test("maps pipe object fields with unsupported outputs to unknown", () => {
    expect(
      toTs(z.object({ value: z.string().pipe(z.transform(value => value)) }))
    ).toBe(["{", "    value: unknown;", "}"].join("\n"));
  });

  test("maps success schemas to boolean", () => {
    expect(toTs(z.success(z.string()))).toBe("boolean");
  });

  test("maps catch schemas to their inner TypeScript type", () => {
    expect(toTs(z.string().catch("fallback"))).toBe("string");
  });

  test("maps optional catch schemas to their optional inner TypeScript type", () => {
    expect(toTs(z.string().optional().catch("fallback"))).toBe(
      "string | undefined"
    );
  });

  test("maps optional catch object fields to optional TypeScript properties", () => {
    expect(
      toTs(z.object({ name: z.string().optional().catch("fallback") }))
    ).toBe(["{", "    name?: string | undefined;", "}"].join("\n"));
  });

  test("maps default catch schemas to their default inner TypeScript type", () => {
    expect(toTs(z.string().default("x").catch("fallback"))).toBe("string");
  });

  test("maps default catch object fields to required TypeScript properties", () => {
    expect(
      toTs(z.object({ name: z.string().default("x").catch("fallback") }))
    ).toBe(["{", "    name: string;", "}"].join("\n"));
  });

  test("maps file schemas to File", () => {
    expect(toTs(z.file())).toBe("File");
  });

  test.each([
    {
      scenario: "primitive readonly schema",
      schema: z.string().readonly(),
      expected: "string",
    },
    {
      scenario: "literal readonly schema",
      schema: z.literal("fixed").readonly(),
      expected: '"fixed"',
    },
    {
      scenario: "date readonly schema",
      schema: z.date().readonly(),
      expected: "Date",
    },
    {
      scenario: "promise readonly schema",
      schema: z.promise(z.string()).readonly(),
      expected: "Promise<string>",
    },
  ])("keeps $scenario unchanged", ({ schema, expected }) => {
    expect(toTs(schema)).toBe(expected);
  });

  test("maps readonly arrays to readonly TypeScript arrays", () => {
    expect(toTs(z.array(z.string()).readonly())).toBe("readonly string[]");
  });

  test("maps optional readonly arrays to readonly array unions", () => {
    expect(toTs(z.array(z.string()).optional().readonly())).toBe(
      "readonly string[] | undefined"
    );
  });

  test("maps readonly objects to Readonly TypeScript utility types", () => {
    expect(toTs(z.object({ id: z.string() }).readonly())).toBe(
      ["Readonly<{", "    id: string;", "}>"].join("\n")
    );
  });

  test("maps nullable readonly objects to Readonly object unions", () => {
    expect(toTs(z.object({ id: z.string() }).nullable().readonly())).toBe(
      ["Readonly<{", "    id: string;", "}> | null"].join("\n")
    );
  });

  test("maps readonly tuples to readonly TypeScript tuples", () => {
    expect(toTs(z.tuple([z.string(), z.number()]).readonly())).toBe(
      ["readonly [", "    string,", "    number", "]"].join("\n")
    );
  });

  test("maps readonly maps to ReadonlyMap", () => {
    expect(toTs(z.map(z.string(), z.number()).readonly())).toBe(
      "ReadonlyMap<string, number>"
    );
  });

  test("maps readonly records to Readonly Record utility types", () => {
    expect(toTs(z.record(z.string(), z.number()).readonly())).toBe(
      "Readonly<Record<string, number>>"
    );
  });

  test("maps readonly sets to ReadonlySet", () => {
    expect(toTs(z.set(z.string()).readonly())).toBe("ReadonlySet<string>");
  });

  test("maps readonly unions branch by branch", () => {
    expect(
      toTs(z.union([z.array(z.string()), z.set(z.number())]).readonly())
    ).toBe("readonly string[] | ReadonlySet<number>");
  });
});

describe("unsupported schemas", () => {
  test.each([
    { scenario: "z.lazy()", schema: z.lazy(() => z.string()) },
    {
      scenario: "z.templateLiteral()",
      schema: z.templateLiteral(["hello ", z.string()]),
    },
    { scenario: "z.custom()", schema: z.custom() },
    {
      scenario: "z.transform()",
      schema: z.string().transform(value => value.length),
    },
  ])(
    "falls back to unknown for unsupported $scenario schemas",
    ({ schema }) => {
      expect(toTs(schema)).toBe("unknown");
    }
  );
});
