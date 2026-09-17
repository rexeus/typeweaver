import type {
  HttpQuerySchema,
  HttpRequestHeaderSchema,
} from "@rexeus/typeweaver-core";
import { describe, expect, test } from "vitest";
import { z } from "zod";
import { Validator } from "../../src/lib/Validator.js";

class ProbeValidator extends Validator {
  public coerceQuery(query: unknown, schema: HttpQuerySchema): unknown {
    return this.coerceQueryToSchema(query, schema);
  }

  public coerceHeader(
    header: unknown,
    schema: HttpRequestHeaderSchema
  ): unknown {
    return this.coerceHeaderToSchema(header, schema);
  }
}

function ownValue(target: unknown, key: string): unknown {
  return typeof target === "object" && target !== null
    ? Object.getOwnPropertyDescriptor(target, key)?.value
    : undefined;
}

function inputWithOwnProtoKey(
  entries: readonly (readonly [string, unknown])[]
): Record<string, unknown> {
  const input: Record<string, unknown> = {};
  for (const [key, value] of entries) {
    Object.defineProperty(input, key, {
      value,
      writable: true,
      enumerable: true,
      configurable: true,
    });
  }
  return input;
}

describe("Validator prototype-safe dynamic keys", () => {
  const validator = new ProbeValidator();

  test("keeps constructor and toString as own record query keys", () => {
    const schema = z.record(z.string(), z.string());
    const input = JSON.parse('{"constructor":"c","toString":"t"}');

    const coerced = validator.coerceQuery(input, schema);

    expect(ownValue(coerced, "constructor")).toBe("c");
    expect(ownValue(coerced, "toString")).toBe("t");
    expect(Object.getPrototypeOf(coerced)).toBeNull();
    expect(schema.parse(coerced)).toEqual({
      constructor: "c",
      toString: "t",
    });
  });

  test("keeps constructor and toString as own record header keys", () => {
    const schema = z.record(z.string(), z.string());
    const input = JSON.parse('{"constructor":"c","toString":"t"}');

    const coerced = validator.coerceHeader(input, schema);

    expect(ownValue(coerced, "constructor")).toBe("c");
    expect(ownValue(coerced, "toString")).toBe("t");
    expect(Object.getPrototypeOf(coerced)).toBeNull();
  });

  test("handles prototype-named record keys with scalar and array values", () => {
    const schema = z.record(z.string(), z.array(z.string()));
    const input = JSON.parse('{"constructor":["c"],"toString":"t"}');

    const coerced = validator.coerceQuery(input, schema);

    expect(ownValue(coerced, "constructor")).toEqual(["c"]);
    expect(ownValue(coerced, "toString")).toEqual(["t"]);
    expect(schema.parse(coerced)).toEqual({
      constructor: ["c"],
      toString: ["t"],
    });
  });

  test("stores a JSON.parse __proto__ key as an own data property", () => {
    const schema = z.record(z.string(), z.string());
    const input = JSON.parse('{"__proto__":"p","constructor":"c"}');

    const coerced = validator.coerceQuery(input, schema);

    expect(ownValue(coerced, "__proto__")).toBe("p");
    expect(ownValue(coerced, "constructor")).toBe("c");
    expect(Object.getPrototypeOf(coerced)).toBeNull();
    expect(Object.getPrototypeOf({})).toBe(Object.prototype);
    expect(ownValue({}, "polluted")).toBeUndefined();
  });

  test("stores a defineProperty __proto__ key as an own data property", () => {
    const schema = z.record(z.string(), z.string());
    const input = inputWithOwnProtoKey([
      ["__proto__", "p"],
      ["constructor", "c"],
    ]);

    const coerced = validator.coerceQuery(input, schema);

    expect(ownValue(coerced, "__proto__")).toBe("p");
    expect(ownValue(coerced, "constructor")).toBe("c");
    expect(Object.getPrototypeOf(coerced)).toBeNull();
  });

  test("splits comma lists for prototype-named record array headers", () => {
    const schema = z.record(z.string(), z.array(z.string()));
    const input = inputWithOwnProtoKey([
      ["constructor", "a, b"],
      ["__proto__", ["c", "d"]],
    ]);

    const coerced = validator.coerceHeader(input, schema);

    expect(ownValue(coerced, "constructor")).toEqual(["a", "b"]);
    expect(ownValue(coerced, "__proto__")).toEqual(["c", "d"]);
    expect(Object.getPrototypeOf(coerced)).toBeNull();
  });

  test("keeps prototype-named object query fields as own keys", () => {
    const schema = z.object({
      ["constructor"]: z.string(),
      ["toString"]: z.string(),
    });
    const input = inputWithOwnProtoKey([
      ["constructor", "c"],
      ["toString", "t"],
    ]);

    const coerced = validator.coerceQuery(input, schema);

    expect(ownValue(coerced, "constructor")).toBe("c");
    expect(ownValue(coerced, "toString")).toBe("t");
    expect(Object.getPrototypeOf(coerced)).toBeNull();
    expect(schema.parse(coerced)).toEqual({
      constructor: "c",
      toString: "t",
    });
  });

  test("maps prototype-named object header keys back to schema casing", () => {
    const schema = z.object({ ["Constructor"]: z.string() });
    const input = inputWithOwnProtoKey([["constructor", "c"]]);

    const coerced = validator.coerceHeader(input, schema);

    expect(ownValue(coerced, "Constructor")).toBe("c");
    expect(ownValue(coerced, "constructor")).toBeUndefined();
    expect(Object.getPrototypeOf(coerced)).toBeNull();
    expect(schema.parse(coerced)).toEqual({ Constructor: "c" });
  });
});
