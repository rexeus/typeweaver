import { describe, expect, test } from "vitest";
import { z } from "zod";
import { EmptyZodLiteralError } from "../../../src/errors/EmptyZodLiteralError.js";
import { UnsupportedLiteralValueError } from "../../../src/errors/UnsupportedLiteralValueError.js";
import { fromZod } from "../../../src/tsTypeGenerator.js";
import { captureError, toTs } from "./fixtures.js";

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
      }) as unknown
    );
  });
});
