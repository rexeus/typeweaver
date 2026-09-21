import { describe, expect, test } from "vitest";
import { z } from "zod";
import { UnsupportedZodTypeError } from "../../src/index.js";
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

  test("rejects pipe schemas with unsupported transform outputs", () => {
    expect(() =>
      toTs(z.string().pipe(z.transform(value => value)))
    ).toThrowError(UnsupportedZodTypeError);
  });

  test("maps pipe object fields to optional properties from optional outputs", () => {
    expect(
      toTs(
        z.object({
          // @ts-expect-error Zod's invariant pipe target rejects a wider input although this required string can safely feed it.
          value: z.string().pipe(z.string().optional()),
        })
      )
    ).toBe(["{", "    value?: string | undefined;", "}"].join("\n"));
  });

  test("rejects object fields with unsupported transform outputs", () => {
    expect(() =>
      toTs(z.object({ value: z.string().pipe(z.transform(value => value)) }))
    ).toThrowError(UnsupportedZodTypeError);
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
});

describe("file and readonly wrapper schemas", () => {
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
    {
      scenario: "z.lazy()",
      schema: z.lazy(() => z.string()),
      schemaKind: "lazy",
      reason: "recursive schemas require named TypeScript declarations",
    },
    {
      scenario: "z.templateLiteral()",
      schema: z.templateLiteral(["hello ", z.string()]),
      schemaKind: "template-literal",
      reason: "template-literal schemas are not represented",
    },
    {
      scenario: "z.custom()",
      schema: z.custom(),
      schemaKind: "custom",
      reason: "custom validators do not expose",
    },
    {
      scenario: "z.transform()",
      schema: z.string().transform(value => value.length),
      schemaKind: "transform",
      reason: "transforms do not expose",
    },
  ])(
    "$scenario throws a stable actionable error",
    ({ schema, schemaKind, reason }) => {
      const error = captureError(() => toTs(schema));

      expect(error).toBeInstanceOf(UnsupportedZodTypeError);
      expect(error).toEqual(
        expect.objectContaining({
          code: "UNSUPPORTED_ZOD_TYPE",
          schemaKind,
          reason: expect.stringContaining(reason) as unknown,
        }) as unknown
      );
      if (!(error instanceof UnsupportedZodTypeError)) {
        throw new Error("Expected UnsupportedZodTypeError");
      }
      expect(error.message).toContain(
        "Restructure the schema to a supported shape"
      );
    }
  );

  test("continues to support intentional z.unknown()", () => {
    expect(toTs(z.unknown())).toBe("unknown");
  });
});
