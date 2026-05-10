import type {
  JsonSchema,
  JsonSchemaValue,
} from "@rexeus/typeweaver-zod-to-json-schema";
import { describe, expect, test } from "vitest";
import { normalizeOpenApiSchema } from "../../src/internal/openApiSchemaNormalization.js";

type SchemaNormalizationCase = {
  readonly label: string;
  readonly schema: JsonSchema;
  readonly expected: JsonSchema;
};

describe("normalizeOpenApiSchema", () => {
  describe("single schema child keywords", () => {
    test.each([
      singleSchemaKeywordCase("items", "item"),
      singleSchemaKeywordCase("additionalProperties", "additional"),
      singleSchemaKeywordCase("not", "not"),
      singleSchemaKeywordCase("if", "if"),
      singleSchemaKeywordCase("then", "then"),
      singleSchemaKeywordCase("else", "else"),
      singleSchemaKeywordCase("contains", "contains"),
      singleSchemaKeywordCase("propertyNames", "property"),
    ] satisfies readonly SchemaNormalizationCase[])(
      "converts const in $label to a single-value enum",
      ({ schema, expected }) => {
        const result = normalizeOpenApiSchema(schema);

        expect(result).toEqual(expected);
      }
    );
  });

  describe("schema map keywords", () => {
    test.each([
      schemaMapKeywordCase("properties", "contentType", "application/json"),
      schemaMapKeywordCase("patternProperties", "^x-", "header"),
      schemaMapKeywordCase("$defs", "local", "local"),
      schemaMapKeywordCase("definitions", "legacy", "legacy"),
      schemaMapKeywordCase("dependentSchemas", "mode", "dependent"),
    ] satisfies readonly SchemaNormalizationCase[])(
      "converts const in $label to a single-value enum",
      ({ schema, expected }) => {
        const result = normalizeOpenApiSchema(schema);

        expect(result).toEqual(expected);
      }
    );
  });

  describe("schema array keywords", () => {
    test.each([
      schemaArrayKeywordCase("prefixItems", "prefix"),
      schemaArrayKeywordCase("allOf", "all"),
      schemaArrayKeywordCase("anyOf", "any"),
      schemaArrayKeywordCase("oneOf", "one"),
    ] satisfies readonly SchemaNormalizationCase[])(
      "converts const in $label to a single-value enum",
      ({ schema, expected }) => {
        const result = normalizeOpenApiSchema(schema);

        expect(result).toEqual(expected);
      }
    );
  });

  test("preserves schema-shaped data payloads under const enum default and examples", () => {
    const schema: JsonSchema = {
      const: { kind: "schema-like", const: "payload" },
      properties: {
        payloads: {
          enum: [{ const: "existing-enum-payload" }],
          default: { const: "default-payload" },
          examples: [{ const: "example-payload" }],
        },
      },
    };

    const result = normalizeOpenApiSchema(schema);

    expect(result).toEqual({
      properties: {
        payloads: {
          enum: [{ const: "existing-enum-payload" }],
          default: { const: "default-payload" },
          examples: [{ const: "example-payload" }],
        },
      },
      enum: [{ kind: "schema-like", const: "payload" }],
    });
  });
});

function singleSchemaKeywordCase(
  keyword: string,
  value: string
): SchemaNormalizationCase {
  return {
    label: keyword,
    schema: schemaKeyword(keyword, { const: value }),
    expected: schemaKeyword(keyword, { enum: [value] }),
  };
}

function schemaMapKeywordCase(
  keyword: string,
  key: string,
  value: string
): SchemaNormalizationCase {
  return {
    label: `${keyword}.${key}`,
    schema: schemaKeyword(keyword, { [key]: { const: value } }),
    expected: schemaKeyword(keyword, { [key]: { enum: [value] } }),
  };
}

function schemaArrayKeywordCase(
  keyword: string,
  value: string
): SchemaNormalizationCase {
  return {
    label: keyword,
    schema: schemaKeyword(keyword, [{ const: value }]),
    expected: schemaKeyword(keyword, [{ enum: [value] }]),
  };
}

function schemaKeyword(key: string, value: JsonSchemaValue): JsonSchema {
  return { [key]: value };
}
