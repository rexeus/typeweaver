import { describe, expect, test } from "vitest";
import { z } from "zod";
import { fromZod } from "../../src/tsTypeGenerator.js";
import { print } from "../../src/tsTypePrinter.js";

function zodToTs(schema: z.ZodType): string {
  return print(fromZod(schema));
}

describe("fromZod reserved keyword property quoting", () => {
  test("quotes reserved keyword 'delete' in object property", () => {
    const result = zodToTs(z.object({ delete: z.string() }));
    expect(result).toContain('"delete"');
  });

  test("quotes reserved keyword 'class' in object property", () => {
    const result = zodToTs(z.object({ class: z.string() }));
    expect(result).toContain('"class"');
  });

  test("quotes reserved keyword 'default' in object property", () => {
    const result = zodToTs(z.object({ default: z.number() }));
    expect(result).toContain('"default"');
  });

  test("quotes reserved keyword 'function' in object property", () => {
    const result = zodToTs(z.object({ function: z.boolean() }));
    expect(result).toContain('"function"');
  });

  test("does not quote regular identifier 'name'", () => {
    const result = zodToTs(z.object({ name: z.string() }));
    expect(result).toContain("name:");
    expect(result).not.toContain('"name"');
  });

  test("does not quote regular identifier 'userId'", () => {
    const result = zodToTs(z.object({ userId: z.string() }));
    expect(result).toContain("userId:");
    expect(result).not.toContain('"userId"');
  });

  test("handles mixed regular and reserved keyword properties", () => {
    const result = zodToTs(
      z.object({
        name: z.string(),
        delete: z.boolean(),
        age: z.number(),
        class: z.string(),
      })
    );

    expect(result).toContain("name:");
    expect(result).not.toContain('"name"');
    expect(result).toContain('"delete"');
    expect(result).toContain("age:");
    expect(result).not.toContain('"age"');
    expect(result).toContain('"class"');
  });

  test("still quotes non-identifier keys", () => {
    const result = zodToTs(z.object({ "with-dash": z.string() }));
    expect(result).toContain('"with-dash"');
  });
});
