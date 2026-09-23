import { describe, expect, test } from "vitest";
import { z } from "zod";
import { toTs } from "./fixtures.js";

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
});

describe("nested object schemas", () => {
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

  test("maps object fields unioned with undefined to required TypeScript properties", () => {
    expect(toTs(z.object({ code: z.union([z.string(), z.undefined()]) }))).toBe(
      ["{", "    code: string | undefined;", "}"].join("\n")
    );
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
