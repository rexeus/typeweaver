import { describe, expect, test } from "vitest";
import { z } from "zod";
import { TsTypeNode } from "../../src/TsTypeGenerator";
import { TsTypePrinter } from "../../src/TsTypePrinter";

function zodToTs(schema: z.ZodType): string {
  return TsTypePrinter.print(TsTypeNode.fromZod(schema));
}

describe("TsTypeNode", () => {
  test("z.file() maps to unknown", () => {
    expect(zodToTs(z.file())).toBe("unknown");
  });

  test("z.string() maps to string", () => {
    expect(zodToTs(z.string())).toBe("string");
  });

  test("z.number() maps to number", () => {
    expect(zodToTs(z.number())).toBe("number");
  });

  test("z.boolean() maps to boolean", () => {
    expect(zodToTs(z.boolean())).toBe("boolean");
  });

  test("z.any() maps to any", () => {
    expect(zodToTs(z.any())).toBe("any");
  });

  test("z.date() maps to Date", () => {
    expect(zodToTs(z.date())).toBe("Date");
  });
});
