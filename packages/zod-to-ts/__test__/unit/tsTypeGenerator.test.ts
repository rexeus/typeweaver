import { describe, expect, test } from "vitest";
import { z } from "zod";
import { fromZod } from "../../src/tsTypeGenerator.js";
import { print } from "../../src/tsTypePrinter.js";

function zodToTs(schema: z.ZodType): string {
  return print(fromZod(schema)).replace(/\s+/gu, " ").trim();
}

describe("fromZod", () => {
  describe("common supported handlers", () => {
    test.each([
      ["z.string()", z.string(), "string"],
      ["z.number()", z.number(), "number"],
      ["z.bigint()", z.bigint(), "bigint"],
      ["z.boolean()", z.boolean(), "boolean"],
      ["z.date()", z.date(), "Date"],
      ["z.symbol()", z.symbol(), "symbol"],
      ["z.undefined()", z.undefined(), "undefined"],
      ["z.null()", z.null(), "null"],
      ["z.any()", z.any(), "any"],
      ["z.unknown()", z.unknown(), "unknown"],
      ["z.never()", z.never(), "never"],
      ["z.void()", z.void(), "void"],
    ])("%s maps to %s", (_name, schema, expected) => {
      expect(zodToTs(schema)).toBe(expected);
    });

    test("z.nullable() includes null", () => {
      expect(zodToTs(z.string().nullable())).toBe("string | null");
    });

    test("z.optional() includes undefined", () => {
      expect(zodToTs(z.string().optional())).toBe("string | undefined");
    });

    test("z.default() removes undefined from the inner type", () => {
      expect(zodToTs(z.string().optional().default("fallback"))).toBe("string");
    });

    test("z.array() maps its element type", () => {
      expect(zodToTs(z.array(z.string()))).toBe("string[]");
    });

    test("z.object() keeps required and optional fields", () => {
      expect(
        zodToTs(
          z.object({
            id: z.string(),
            age: z.number().optional(),
          })
        )
      ).toBe("{ id: string; age?: number | undefined; }");
    });

    test("z.object() quotes non-identifier property names", () => {
      expect(
        zodToTs(
          z.object({
            "display-name": z.string(),
            class: z.number(),
          })
        )
      ).toBe('{ "display-name": string; "class": number; }');
    });

    test("z.union() maps all options", () => {
      expect(zodToTs(z.union([z.string(), z.number()]))).toBe(
        "string | number"
      );
    });

    test("z.intersection() maps both sides", () => {
      expect(
        zodToTs(
          z.intersection(
            z.object({ id: z.string() }),
            z.object({ name: z.string() })
          )
        )
      ).toBe("{ id: string; } & { name: string; }");
    });

    test("z.tuple() maps each item", () => {
      expect(zodToTs(z.tuple([z.string(), z.number()]))).toBe(
        "[ string, number ]"
      );
    });

    test("z.record() maps key and value types", () => {
      expect(zodToTs(z.record(z.string(), z.number()))).toBe(
        "Record<string, number>"
      );
    });

    test("z.map() maps key and value types", () => {
      expect(zodToTs(z.map(z.string(), z.number()))).toBe(
        "Map<string, number>"
      );
    });

    test("z.set() maps the value type", () => {
      expect(zodToTs(z.set(z.string()))).toBe("Set<string>");
    });

    test("z.literal() maps string literals", () => {
      expect(zodToTs(z.literal("ready"))).toBe('"ready"');
    });

    test("z.enum() maps entry keys", () => {
      expect(zodToTs(z.enum(["pending", "done"]))).toBe('"pending" | "done"');
    });

    test("z.promise() maps the resolved type", () => {
      expect(zodToTs(z.promise(z.string()))).toBe("Promise<string>");
    });
  });

  describe("phase 6 handlers", () => {
    test("z.nan() maps to number", () => {
      expect(zodToTs(z.nan())).toBe("number");
    });

    test("z.nonoptional() unwraps optional undefined", () => {
      expect(zodToTs(z.string().optional().nonoptional())).toBe("string");
    });

    test("z.readonly() maps to Readonly<T>", () => {
      expect(
        zodToTs(
          z
            .object({
              name: z.string(),
            })
            .readonly()
        )
      ).toBe("Readonly<{ name: string; }>");
    });

    test("z.file() maps to File", () => {
      expect(zodToTs(z.file())).toBe("File");
    });

    test("z.catch() maps to the inner type", () => {
      expect(zodToTs(z.string().catch("fallback"))).toBe("string");
    });

    test("z.pipe() maps to the output-side type", () => {
      expect(zodToTs(z.string().pipe(z.number()))).toBe("number");
    });

    test("z.success() maps to boolean", () => {
      expect(zodToTs(z.success(z.string()))).toBe("boolean");
    });
  });

  describe("explicitly deferred handlers", () => {
    test("z.lazy() stays unknown", () => {
      expect(zodToTs(z.lazy(() => z.string()))).toBe("unknown");
    });

    test("z.custom() stays unknown", () => {
      expect(zodToTs(z.custom())).toBe("unknown");
    });

    test("z.templateLiteral() stays unknown", () => {
      expect(zodToTs(z.templateLiteral([z.literal("user-"), z.string()]))).toBe(
        "unknown"
      );
    });

    test("z.transform() stays unknown through z.pipe() output mapping", () => {
      expect(zodToTs(z.string().transform(value => value.length))).toBe(
        "unknown"
      );
    });
  });
});
