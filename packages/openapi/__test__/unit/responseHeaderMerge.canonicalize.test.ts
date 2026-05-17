import type { JsonSchema } from "@rexeus/typeweaver-zod-to-json-schema";
import { describe, expect, test } from "vitest";
import { stableStringifyJsonSchema } from "../../src/internal/responseHeaderMerge.js";

describe("stableStringifyJsonSchema (canonical key sort)", () => {
  test("sorts ASCII-cased keys by byte order, not Turkish locale order", () => {
    // Turkish locale-aware sorting groups dotless `ı` with `i` and dotted `İ`
    // with `I` in unexpected ways. Lexicographic byte order keeps `İ` < `i`
    // and `ı` after every ASCII letter, which is what the golden-gate output
    // expects regardless of the runtime's default locale.
    const schema = {
      ipsum: 1,
      Iota: 2,
      İnput: 3,
      ınput: 4,
      Input: 5,
    } as unknown as JsonSchema;

    const serialized = stableStringifyJsonSchema(schema);
    const orderedKeys = (JSON.parse(serialized) as Record<string, number>)
      ? Object.keys(JSON.parse(serialized) as Record<string, number>)
      : [];

    expect(orderedKeys).toEqual(
      [...orderedKeys].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
    );
    expect(orderedKeys).toEqual(["Input", "Iota", "ipsum", "İnput", "ınput"]);
  });

  test("produces byte-identical output for schemas that differ only in input key order", () => {
    const a = { foo: 1, bar: 2, baz: 3 } as unknown as JsonSchema;
    const b = { baz: 3, foo: 1, bar: 2 } as unknown as JsonSchema;

    expect(stableStringifyJsonSchema(a)).toBe(stableStringifyJsonSchema(b));
  });
});
