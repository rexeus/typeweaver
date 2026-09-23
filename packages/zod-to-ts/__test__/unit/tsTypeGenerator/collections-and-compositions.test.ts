import { describe, expect, test } from "vitest";
import { z } from "zod";
import { toTs } from "./fixtures.js";

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
