import type {
  JsonSchema,
  JsonSchemaValue,
} from "@rexeus/typeweaver-zod-to-json-schema";

const SCHEMA_CHILD_KEYS: ReadonlySet<string> = new Set([
  "items",
  "additionalProperties",
  "not",
  "if",
  "then",
  "else",
  "contains",
  "propertyNames",
]);

const SCHEMA_CHILD_MAP_KEYS: ReadonlySet<string> = new Set([
  "properties",
  "patternProperties",
  "$defs",
  "definitions",
  "dependentSchemas",
]);

const SCHEMA_CHILD_ARRAY_KEYS: ReadonlySet<string> = new Set([
  "prefixItems",
  "allOf",
  "anyOf",
  "oneOf",
]);

export function normalizeOpenApiSchema(schema: JsonSchema): JsonSchema {
  const hasConst = hasOwnSchemaKeyword(schema, "const");
  const normalizedEntries = Object.entries(schema)
    .filter(([key]) => key !== "const")
    .map(([key, value]) => [key, normalizeSchemaKeyword(key, value)]);
  const constValue = schema.const;

  if (hasConst && constValue !== undefined) {
    normalizedEntries.push(["enum", [constValue]]);
  }

  return Object.fromEntries(normalizedEntries) as JsonSchema;
}

function normalizeSchemaKeyword(
  key: string,
  value: JsonSchemaValue
): JsonSchemaValue {
  if (SCHEMA_CHILD_KEYS.has(key) && isJsonSchema(value)) {
    return normalizeOpenApiSchema(value);
  }

  if (SCHEMA_CHILD_MAP_KEYS.has(key) && isJsonSchema(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([childKey, childValue]) => [
        childKey,
        isJsonSchema(childValue)
          ? normalizeOpenApiSchema(childValue)
          : childValue,
      ])
    );
  }

  if (SCHEMA_CHILD_ARRAY_KEYS.has(key) && Array.isArray(value)) {
    return value.map(entry =>
      isJsonSchema(entry) ? normalizeOpenApiSchema(entry) : entry
    );
  }

  return value;
}

function isJsonSchema(value: JsonSchemaValue): value is JsonSchema {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOwnSchemaKeyword(schema: JsonSchema, keyword: string): boolean {
  return Object.prototype.hasOwnProperty.call(schema, keyword);
}
