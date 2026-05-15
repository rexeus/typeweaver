import { describe, expect, test } from "vitest";
import { z } from "zod";
import {
  getSchemaDefinition,
  getSchemaType,
  isZodSchema,
  isZodTransparentWrapperType,
} from "../../src/internal/zodIntrospection.js";

describe("zod introspection", () => {
  test("accepts real Zod schemas as introspection targets", () => {
    const schema = z.string();

    const result = isZodSchema(schema);

    expect(result).toBe(true);
  });

  test("rejects coincidental objects without Zod definitions", () => {
    expect(isZodSchema({ _zod: null })).toBe(false);
    expect(isZodSchema({ _zod: {} })).toBe(false);
  });

  test("reads schema definitions from supported Zod metadata locations", () => {
    const schema = z.string().default("fallback");

    const result = getSchemaDefinition(schema);

    expect(result?.type).toBe("default");
    expect(getSchemaType(result?.innerType)).toBe("string");
  });

  test("identifies transparent wrappers that expose inner schemas", () => {
    expect(isZodTransparentWrapperType("optional")).toBe(true);
    expect(isZodTransparentWrapperType("readonly")).toBe(true);
    expect(isZodTransparentWrapperType("pipe")).toBe(false);
  });
});
